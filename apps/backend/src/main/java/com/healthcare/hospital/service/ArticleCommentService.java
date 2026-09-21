package com.healthcare.hospital.service;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.ArticleCommentResponse;
import com.healthcare.hospital.dto.CreateCommentRequest;
import com.healthcare.hospital.entity.ArticleComment;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.ArticleCommentRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ArticleCommentService {

    private final ArticleCommentRepository commentRepository;
    private final ArticleRepository articleRepository;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PatientProfileRepository patientProfileRepository;

    public ArticleCommentService(
            ArticleCommentRepository commentRepository,
            ArticleRepository articleRepository,
            UserRepository userRepository,
            DoctorRepository doctorRepository,
            PatientProfileRepository patientProfileRepository) {
        this.commentRepository = commentRepository;
        this.articleRepository = articleRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.patientProfileRepository = patientProfileRepository;
    }

    /**
     * Soft-deleted comments stay in the payload as thread anchors: a reply to a
     * deleted parent must still render, under a "[Bình luận đã xóa]" tombstone,
     * instead of silently disappearing with its parent. The tombstone carries
     * only the structural fields — authorship and content never leak after
     * deletion.
     */
    @Transactional(readOnly = true)
    public List<ArticleCommentResponse> getComments(String articleSlug) {
        // Threads are only readable while their article is publicly visible.
        // Reading by slug alone would let an anonymous caller enumerate the
        // comments of a pending or rejected submission through this endpoint.
        boolean publiclyVisible = articleRepository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
                articleSlug, "APPROVED", OffsetDateTime.now()).isPresent();
        if (!publiclyVisible) {
            return List.of();
        }
        return commentRepository.findByArticleSlugOrderByCreatedAtAsc(articleSlug)
                .stream()
                .map(comment -> comment.isActive()
                        ? ArticleCommentResponse.from(comment)
                        : ArticleCommentResponse.tombstone(comment))
                .toList();
    }

    @Transactional
    public ArticleCommentResponse addComment(String articleSlug, CreateCommentRequest request, UserDetails actor) {
        // Comments were the one authored field on an article with no content
        // gate at all: the request carried a length limit and nothing else, so
        // a comment could store markup that the article body itself would have
        // had scrubbed. It is checked before anything is looked up, so a
        // rejected comment reveals nothing about whether the slug exists.
        //
        // Rejecting outright rather than silently scrubbing is deliberate: the
        // author is told, and clinical prose keeps working — "huyết áp < 140/90"
        // carries a "<" but no construct this gate recognises.
        String content = request.content().strip();
        if (ArticleBodySanitizer.containsExecutableContent(content)) {
            throw new BusinessException(
                400,
                com.healthcare.exception.ErrorCodes.VALIDATION_ERROR,
                "Bình luận chứa mã hoặc thẻ HTML không an toàn. Vui lòng chỉ nhập nội dung văn bản.");
        }

        // A comment must land on something readers can actually open AND that
        // has passed the publication gate. The predicate here is the public
        // read contract, so comments can never attach to (or confirm the
        // existence of) a pending or rejected doctor submission.
        articleRepository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
                articleSlug, "APPROVED", OffsetDateTime.now())
            .orElseThrow(() -> new ResourceNotFoundException("Article not found: " + articleSlug));

        if (request.parentCommentId() != null) {
            ArticleComment parent = commentRepository.findById(request.parentCommentId())
                .filter(ArticleComment::isActive)
                .filter(candidate -> articleSlug.equals(candidate.getArticleSlug()))
                .orElseThrow(() -> new BusinessException(
                    400,
                    com.healthcare.exception.ErrorCodes.VALIDATION_ERROR,
                    "Câu trả lời không thuộc bài viết này hoặc đã bị gỡ."));
        }

        User user = userRepository.findByEmail(actor.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actor.getUsername()));

        String authorRole = "PATIENT";
        String authorName = user.getDisplayName();

        boolean isDoctor = actor.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_DOCTOR"));
        boolean isAdmin = actor.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (isAdmin) {
            authorRole = "ADMIN";
            authorName = "Ban Biên Tập Bệnh Viện";
        } else if (isDoctor) {
            authorRole = "DOCTOR";
            Doctor doctor = doctorRepository.findByUserId(user.getId()).orElse(null);
            if (doctor != null) {
                authorName = doctor.getFullName() + " - Bác sĩ Chuyên khoa";
            } else {
                authorName = "BS. " + user.getDisplayName();
            }
        } else {
            authorRole = "PATIENT";
            PatientProfile profile = patientProfileRepository.findByUserId(user.getId()).orElse(null);
            if (profile != null && profile.getFullName() != null && !profile.getFullName().isBlank()) {
                authorName = profile.getFullName();
            }
        }

        ArticleComment comment = new ArticleComment();
        comment.setArticleSlug(articleSlug);
        comment.setAuthorUserId(user.getId());
        comment.setAuthorName(authorName);
        comment.setAuthorRole(authorRole);
        // Defence in depth behind the gate above, and the same call the article
        // body goes through, so the two fields cannot diverge on what is stored.
        comment.setContent(ArticleBodySanitizer.sanitize(content));
        comment.setParentCommentId(request.parentCommentId());
        comment.setActive(true);

        ArticleComment saved = commentRepository.save(comment);
        return ArticleCommentResponse.from(saved);
    }

    @Transactional
    public void deleteComment(UUID commentId, UserDetails actor) {
        ArticleComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found: " + commentId));

        User user = userRepository.findByEmail(actor.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actor.getUsername()));

        boolean isAdmin = actor.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin && !comment.getAuthorUserId().equals(user.getId())) {
            throw new BusinessException(403, "FORBIDDEN", "You can only delete your own comments");
        }

        comment.setActive(false);
        commentRepository.save(comment);
    }
}
