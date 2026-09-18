package com.healthcare.hospital.controller;

import com.healthcare.exception.ForbiddenException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.service.AdminArticleService;
import com.healthcare.hospital.service.ArticleService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/doctor/articles")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorArticleController {

    private final AdminArticleService adminArticleService;
    private final ArticleService articleService;
    private final ArticleRepository articleRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public DoctorArticleController(
            AdminArticleService adminArticleService,
            ArticleService articleService,
            ArticleRepository articleRepository,
            DoctorRepository doctorRepository,
            UserRepository userRepository) {
        this.adminArticleService = adminArticleService;
        this.articleService = articleService;
        this.articleRepository = articleRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public Page<ArticleResponse> listArticles(
            @RequestParam(required = false) String contentKind,
            @PageableDefault(size = 20) Pageable pageable,
            @AuthenticationPrincipal UserDetails actor) {
        String doctorName = resolveDoctorName(actor);
        String altName = resolveDoctorAltName(actor);
        String pureName = stripAcademicTitles(doctorName);
        return articleService.listByAuthor(doctorName, altName, pureName, contentKind, pageable);
    }

    @PostMapping
    public ResponseEntity<Article> createArticle(
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        String doctorName = resolveDoctorName(actor);
        ArticleRequest effectiveRequest = enforceDoctorAuthor(request, doctorName);
        return ResponseEntity.status(HttpStatus.CREATED).body(adminArticleService.create(effectiveRequest, actor));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Article> updateArticle(
            @PathVariable String slug,
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        Article existing = articleRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Article not found: " + slug));
        assertAuthorOwnership(existing, actor);
        String doctorName = resolveDoctorName(actor);
        ArticleRequest effectiveRequest = enforceDoctorAuthor(request, doctorName);
        return ResponseEntity.ok(adminArticleService.update(slug, effectiveRequest, actor));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable String slug,
            @AuthenticationPrincipal UserDetails actor) {
        Article existing = articleRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Article not found: " + slug));
        assertAuthorOwnership(existing, actor);
        adminArticleService.delete(slug, actor);
        return ResponseEntity.noContent().build();
    }

    private void assertAuthorOwnership(Article article, UserDetails actor) {
        String doctorName = resolveDoctorName(actor);
        String altName = resolveDoctorAltName(actor);
        String pureName = stripAcademicTitles(doctorName);
        if (!isAuthorMatch(article.getAuthorName(), doctorName, altName, pureName)) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác");
        }
    }

    private boolean isAuthorMatch(String articleAuthor, String doctorName, String altName, String pureName) {
        if (articleAuthor == null || articleAuthor.isBlank()) {
            return false;
        }
        String author = articleAuthor.trim();
        if (doctorName != null && author.equalsIgnoreCase(doctorName.trim())) {
            return true;
        }
        if (altName != null && author.equalsIgnoreCase(altName.trim())) {
            return true;
        }
        if (pureName != null && !pureName.isBlank()) {
            String strippedAuthor = stripAcademicTitles(author);
            if (strippedAuthor.equalsIgnoreCase(pureName)) {
                return true;
            }
            if (strippedAuthor.toLowerCase().contains(pureName.toLowerCase())
                    || pureName.toLowerCase().contains(strippedAuthor.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    private String stripAcademicTitles(String name) {
        if (name == null) return "";
        return name.replaceAll("(?i)^(GS\\.TS\\.BS|PGS\\.TS\\.BS|TS\\.BS|ThS\\.BS|BS\\.CKII|BS\\.CKI|GS|PGS|TS|ThS|BS|Bác sĩ)\\.?\\s*", "").trim();
    }

    private ArticleRequest enforceDoctorAuthor(ArticleRequest request, String doctorName) {
        return new ArticleRequest(
            request.title(), request.slug(), request.summary(), request.body(),
            request.category(), doctorName, request.readingMinutes(),
            request.relatedSpecialtySlug(), request.contentKind(), request.coverImageUrl(),
            request.seoTitle(), request.seoDescription(), request.tags(), request.scheduledPublishAt(),
            request.version(), request.sections(), request.contentLanguage(), request.audience(),
            request.topicTags(), request.keyTakeaways(), request.warningSigns(), request.preventionTips(),
            request.whenToSeekCare(), request.sourceReferences(), request.clinicalMetadata(),
            request.clinicalDisclaimer(), request.featured(), request.active()
        );
    }

    private String resolveDoctorName(UserDetails actor) {
        if (actor == null) {
            return "Bác sĩ Chuyên khoa";
        }
        User user = findUserFromActor(actor);
        if (user != null) {
            Doctor doctor = doctorRepository.findByUserId(user.getId()).orElse(null);
            if (doctor != null && doctor.getFullName() != null && !doctor.getFullName().isBlank()) {
                return doctor.getFullName();
            }
            if (user.getDisplayName() != null && !user.getDisplayName().isBlank()) {
                return user.getDisplayName();
            }
        }
        return "Bác sĩ Chuyên khoa";
    }

    private String resolveDoctorAltName(UserDetails actor) {
        if (actor == null) {
            return null;
        }
        User user = findUserFromActor(actor);
        return (user != null && user.getDisplayName() != null && !user.getDisplayName().isBlank())
                ? user.getDisplayName() : null;
    }

    private User findUserFromActor(UserDetails actor) {
        if (actor instanceof HealthcareUserPrincipal principal) {
            return userRepository.findById(principal.getUserId()).orElse(null);
        }
        return userRepository.findByEmail(actor.getUsername()).orElse(null);
    }
}
