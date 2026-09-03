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

    @Transactional(readOnly = true)
    public List<ArticleCommentResponse> getComments(String articleSlug) {
        return commentRepository.findByArticleSlugAndActiveTrueOrderByCreatedAtAsc(articleSlug)
                .stream()
                .map(ArticleCommentResponse::from)
                .toList();
    }

    @Transactional
    public ArticleCommentResponse addComment(String articleSlug, CreateCommentRequest request, UserDetails actor) {
        if (!articleRepository.findBySlug(articleSlug).isPresent()) {
            throw new ResourceNotFoundException("Article not found: " + articleSlug);
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
        comment.setContent(request.content().strip());
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
