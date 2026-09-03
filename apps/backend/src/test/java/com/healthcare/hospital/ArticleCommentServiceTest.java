package com.healthcare.hospital;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.hospital.dto.ArticleCommentResponse;
import com.healthcare.hospital.dto.CreateCommentRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.ArticleComment;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.ArticleCommentRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.service.ArticleCommentService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class ArticleCommentServiceTest {

    private ArticleCommentRepository commentRepository;
    private ArticleRepository articleRepository;
    private UserRepository userRepository;
    private DoctorRepository doctorRepository;
    private PatientProfileRepository patientProfileRepository;
    private ArticleCommentService commentService;

    @BeforeEach
    void setUp() {
        commentRepository = Mockito.mock(ArticleCommentRepository.class);
        articleRepository = Mockito.mock(ArticleRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        doctorRepository = Mockito.mock(DoctorRepository.class);
        patientProfileRepository = Mockito.mock(PatientProfileRepository.class);

        commentService = new ArticleCommentService(
                commentRepository,
                articleRepository,
                userRepository,
                doctorRepository,
                patientProfileRepository
        );
    }

    @Test
    @DisplayName("Patient can add comment to article and authorName is derived from PatientProfile")
    void patientCanAddComment() {
        String slug = "cham-soc-tim-mach";
        Article article = new Article();
        article.setSlug(slug);
        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(article));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("patient@healthcare.local");
        user.setDisplayName("Patient Display");
        when(userRepository.findByEmail("patient@healthcare.local")).thenReturn(Optional.of(user));

        PatientProfile profile = new PatientProfile();
        profile.setFullName("Nguyen Van A");
        profile.setUserId(userId);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        when(commentRepository.save(any(ArticleComment.class))).thenAnswer(inv -> {
            ArticleComment c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        UserDetails actor = Mockito.mock(UserDetails.class);
        when(actor.getUsername()).thenReturn("patient@healthcare.local");
        when(actor.getAuthorities()).thenAnswer(inv -> List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));

        CreateCommentRequest request = new CreateCommentRequest("Bác sĩ cho em hỏi...", null);
        ArticleCommentResponse response = commentService.addComment(slug, request, actor);

        assertNotNull(response);
        assertEquals(slug, response.articleSlug());
        assertEquals("PATIENT", response.authorRole());
        assertEquals("Nguyen Van A", response.authorName());
        assertEquals("Bác sĩ cho em hỏi...", response.content());
    }

    @Test
    @DisplayName("Doctor can reply to comment with doctor badge and title")
    void doctorCanReplyToComment() {
        String slug = "cham-soc-tim-mach";
        Article article = new Article();
        article.setSlug(slug);
        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(article));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("doctor@healthcare.local");
        user.setDisplayName("BS Khoi");
        when(userRepository.findByEmail("doctor@healthcare.local")).thenReturn(Optional.of(user));

        Doctor doctor = new Doctor();
        doctor.setFullName("TS.BS Nguyễn Minh Khôi");
        doctor.setUserId(userId);
        when(doctorRepository.findByUserId(userId)).thenReturn(Optional.of(doctor));

        when(commentRepository.save(any(ArticleComment.class))).thenAnswer(inv -> {
            ArticleComment c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        UserDetails actor = Mockito.mock(UserDetails.class);
        when(actor.getUsername()).thenReturn("doctor@healthcare.local");
        when(actor.getAuthorities()).thenAnswer(inv -> List.of(new SimpleGrantedAuthority("ROLE_DOCTOR")));

        UUID parentId = UUID.randomUUID();
        CreateCommentRequest request = new CreateCommentRequest("Chào bạn, bạn nên đo huyết áp...", parentId);
        ArticleCommentResponse response = commentService.addComment(slug, request, actor);

        assertNotNull(response);
        assertEquals("DOCTOR", response.authorRole());
        assertTrue(response.authorName().contains("TS.BS Nguyễn Minh Khôi"));
        assertEquals(parentId, response.parentCommentId());
    }
}
