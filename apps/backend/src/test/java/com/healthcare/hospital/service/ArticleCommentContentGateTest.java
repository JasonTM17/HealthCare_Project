package com.healthcare.hospital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.dto.ArticleCommentResponse;
import com.healthcare.hospital.dto.CreateCommentRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.ArticleComment;
import com.healthcare.hospital.repository.ArticleCommentRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * The server-side content gate on article comments.
 *
 * <p>A comment was the one authored field on an article with no content gate:
 * the request carried a length limit and nothing else, so a comment could store
 * markup the article body itself would have had scrubbed. These tests pin the
 * gate, the copy a rejected author is shown, and the two ways it must not
 * over-reach — clinical prose containing a comparison sign, and the length cap
 * that stays the request's own contract.
 */
class ArticleCommentContentGateTest {

    private static final String SLUG = "cham-soc-tim-mach";
    private static final String REJECTION_MESSAGE =
        "Bình luận chứa mã hoặc thẻ HTML không an toàn. Vui lòng chỉ nhập nội dung văn bản.";

    private ArticleCommentRepository commentRepository;
    private ArticleRepository articleRepository;
    private UserRepository userRepository;
    private DoctorRepository doctorRepository;
    private PatientProfileRepository patientProfileRepository;
    private ArticleCommentService commentService;

    @BeforeEach
    void setUp() {
        commentRepository = mock(ArticleCommentRepository.class);
        articleRepository = mock(ArticleRepository.class);
        userRepository = mock(UserRepository.class);
        doctorRepository = mock(DoctorRepository.class);
        patientProfileRepository = mock(PatientProfileRepository.class);

        commentService = new ArticleCommentService(
            commentRepository,
            articleRepository,
            userRepository,
            doctorRepository,
            patientProfileRepository
        );
    }

    /** The happy path a valid comment needs, so each test only adds its own twist. */
    private UserDetails openCommentThread() {
        Article article = new Article();
        article.setSlug(SLUG);
        when(articleRepository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(eq(SLUG), eq("APPROVED"), any()))
            .thenReturn(Optional.of(article));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("patient@healthcare.local");
        user.setDisplayName("Nguyen Van A");
        when(userRepository.findByEmail("patient@healthcare.local")).thenReturn(Optional.of(user));

        when(commentRepository.save(any(ArticleComment.class))).thenAnswer(invocation -> {
            ArticleComment comment = invocation.getArgument(0);
            comment.setId(UUID.randomUUID());
            return comment;
        });

        UserDetails actor = mock(UserDetails.class);
        when(actor.getUsername()).thenReturn("patient@healthcare.local");
        when(actor.getAuthorities()).thenAnswer(invocation -> List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));
        return actor;
    }

    @Test
    void rejectsAScriptBlockBeforeAnythingElseIsLookedUp() {
        UserDetails actor = openCommentThread();

        assertThatThrownBy(() -> commentService.addComment(
            SLUG, new CreateCommentRequest("<script>alert(1)</script> Bác sĩ cho hỏi", null), actor))
            .isInstanceOf(BusinessException.class)
            .satisfies(thrown -> assertThat(((BusinessException) thrown).getStatus()).isEqualTo(400))
            .hasMessage(REJECTION_MESSAGE);

        // Nothing was persisted and no lookup ran: a rejected comment cannot
        // reveal whether the article exists.
        verify(commentRepository, never()).save(any());
        verify(articleRepository, never())
            .findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(anyString(), eq("APPROVED"), any());
    }

    @Test
    void rejectsEventHandlersAndScriptUrls() {
        UserDetails actor = openCommentThread();

        for (String content : List.of(
            "<img src=x onerror=alert(1)> đọc kết quả xét nghiệm",
            "<a href=\"javascript:alert(1)\">Bấm vào đây</a>",
            "<svg/onload=alert(1)>",
            "<iframe src=\"https://evil.test\"></iframe>")) {

            assertThatThrownBy(() -> commentService.addComment(SLUG, new CreateCommentRequest(content, null), actor))
                .as("comment payload: %s", content)
                .isInstanceOf(BusinessException.class)
                .hasMessage(REJECTION_MESSAGE);
        }

        verify(commentRepository, never()).save(any());
    }

    @Test
    void acceptsClinicalProseThatContainsALessThanSign() {
        // A comparison sign is ordinary clinical prose. Rejecting every "<"
        // would refuse "huyết áp < 140/90" — the reason this field is scrubbed
        // rather than refused.
        UserDetails actor = openCommentThread();
        String content = "Bác sĩ cho em hỏi: huyết áp < 140/90 và đường huyết < 7 mmol/L có sao không ạ?";

        ArticleCommentResponse response = commentService.addComment(
            SLUG, new CreateCommentRequest(content, null), actor);

        assertThat(response.content()).isEqualTo(content);
    }

    @Test
    void storesTheScrubbedValueBehindTheGate() {
        // Defence in depth: the gate above rejects what it recognises, and the
        // same sanitizer the article body uses still cleans what it does not —
        // here a stray control character.
        UserDetails actor = openCommentThread();

        ArticleCommentResponse response = commentService.addComment(
            SLUG, new CreateCommentRequest("Đau" + (char) 7 + " đầu nhiều ngày", null), actor);

        assertThat(response.content()).isEqualTo("Đau đầu nhiều ngày");
    }

    @Test
    void ordinaryMarkupIsStoredAsTextBecauseTheRendererEscapesIt() {
        // The gate does not police ordinary markup, and it does not need to:
        // the comment is rendered as a React text node, so a stored tag is a
        // string on screen rather than an element in the document.
        UserDetails actor = openCommentThread();
        String content = "Nhớ nhập <b>đúng liều</b> bác sĩ nhé";

        ArticleCommentResponse response = commentService.addComment(
            SLUG, new CreateCommentRequest(content, null), actor);

        assertThat(response.content()).isEqualTo(content);
    }

    @Test
    void keepsTheTwoThousandCharacterCap() {
        // The gate is additive: the length limit stays the request's own
        // contract, enforced by bean validation on the DTO.
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();

            assertThat(validator.validate(new CreateCommentRequest("x".repeat(2000), null))).isEmpty();
            assertThat(validator.validate(new CreateCommentRequest("x".repeat(2001), null)))
                .as("a comment over the cap must still be rejected")
                .isNotEmpty();
        }
    }
}
