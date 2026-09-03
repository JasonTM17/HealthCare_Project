package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.service.AdminArticleService;
import com.healthcare.hospital.service.ArticleService;
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
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public DoctorArticleController(
            AdminArticleService adminArticleService,
            ArticleService articleService,
            DoctorRepository doctorRepository,
            UserRepository userRepository) {
        this.adminArticleService = adminArticleService;
        this.articleService = articleService;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public Page<ArticleResponse> listArticles(
            @RequestParam(required = false) String contentKind,
            @PageableDefault(size = 20) Pageable pageable) {
        return articleService.listPublished(contentKind, pageable);
    }

    @PostMapping
    public ResponseEntity<Article> createArticle(
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        // If author name is blank, default to Doctor's registered full name
        ArticleRequest effectiveRequest = request;
        if (request.authorName() == null || request.authorName().isBlank()) {
            String doctorName = resolveDoctorName(actor);
            effectiveRequest = new ArticleRequest(
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
        return ResponseEntity.status(HttpStatus.CREATED).body(adminArticleService.create(effectiveRequest, actor));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Article> updateArticle(
            @PathVariable String slug,
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminArticleService.update(slug, request, actor));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable String slug,
            @AuthenticationPrincipal UserDetails actor) {
        adminArticleService.delete(slug, actor);
        return ResponseEntity.noContent().build();
    }

    private String resolveDoctorName(UserDetails actor) {
        User user = userRepository.findByEmail(actor.getUsername()).orElse(null);
        if (user != null) {
            Doctor doctor = doctorRepository.findByUserId(user.getId()).orElse(null);
            if (doctor != null && doctor.getFullName() != null) {
                return doctor.getFullName();
            }
            return user.getDisplayName();
        }
        return "Bác sĩ Chuyên khoa";
    }
}
