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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.UUID;

@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ, bài viết)")
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

    /**
     * The doctor's own article list.
     *
     * <p>Read ownership uses the same authority as PUT/DELETE: the caller's
     * doctor id.  Matching on the free-text {@code author_name} here would let
     * two doctors that share a display name read each other's rows, and rows
     * the V93 backfill deliberately left unbound because their name was
     * ambiguous are never resurrected through fuzzy matching. A caller with no
     * resolvable ACTIVE {@code doctors} row is denied outright.
     */
    @Operation(summary = "Bài viết y khoa của bác sĩ", description = "Lấy danh sách các bài viết cẩm nang sức khỏe do chính bác sĩ biên soạn")
    @GetMapping
    public Page<ArticleResponse> listArticles(
            @RequestParam(required = false) String contentKind,
            @PageableDefault(size = 20) Pageable pageable,
            @AuthenticationPrincipal UserDetails actor) {
        Doctor doctor = requireActiveDoctor(actor);
        return articleService.listByAuthorDoctorId(doctor.getId(), contentKind, pageable);
    }

    @Operation(summary = "Đăng bài viết y khoa mới", description = "Bác sĩ tạo và xuất bản bài viết hướng dẫn phòng bệnh hoặc cẩm nang sức khỏe")
    @PostMapping
    public ResponseEntity<Article> createArticle(
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        Doctor doctor = requireActiveDoctor(actor);
        ArticleRequest effectiveRequest = enforceDoctorAuthor(request, displayName(doctor));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminArticleService.create(effectiveRequest, actor, doctor.getId()));
    }

    @Operation(summary = "Chỉnh sửa bài viết của bác sĩ", description = "Cập nhật nội dung chuyên môn bài viết của chính bác sĩ")
    @PutMapping("/{slug}")
    public ResponseEntity<Article> updateArticle(
            @PathVariable String slug,
            @Valid @RequestBody ArticleRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        Doctor doctor = requireActiveDoctor(actor);
        Article existing = articleRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Article not found: " + slug));
        assertAuthorOwnership(existing, doctor.getId());
        ArticleRequest effectiveRequest = enforceDoctorAuthor(request, displayName(doctor));
        return ResponseEntity.ok(adminArticleService.update(slug, effectiveRequest, actor, doctor.getId()));
    }

    @Operation(summary = "Xóa bài viết của bác sĩ", description = "Gỡ bài viết của chính bác sĩ khỏi chuyên trang cẩm nang")
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable String slug,
            @AuthenticationPrincipal UserDetails actor) {
        Doctor doctor = requireActiveDoctor(actor);
        Article existing = articleRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Article not found: " + slug));
        assertAuthorOwnership(existing, doctor.getId());
        adminArticleService.delete(slug, actor, doctor.getId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Ownership is decided by the durable {@code author_doctor_id} binding
     * alone: a rename no longer revokes access, two doctors sharing a display
     * name can no longer claim each other's articles, and rows the backfill
     * deliberately left unbound stay locked until an admin re-binds them —
     * display-name matching is not an authorization authority.
     */
    private void assertAuthorOwnership(Article article, UUID doctorId) {
        if (!doctorId.equals(article.getAuthorDoctorId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác");
        }
    }

    /**
     * Every portal operation requires an ACTIVE doctor profile bound to the
     * caller. Without it there is no ownership authority to evaluate, so the
     * request is denied before any article access — including the legacy
     * display-name paths that previously let an unlinked account slip through.
     */
    private Doctor requireActiveDoctor(UserDetails actor) {
        User user = actor == null ? null : findUserFromActor(actor);
        Doctor doctor = user == null
                ? null
                : doctorRepository.findByUserId(user.getId()).orElse(null);
        if (doctor == null || !doctor.isActive()) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác");
        }
        return doctor;
    }

    private static String displayName(Doctor doctor) {
        String fullName = doctor.getFullName();
        return (fullName != null && !fullName.isBlank()) ? fullName : "Bác sĩ Chuyên khoa";
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

    private User findUserFromActor(UserDetails actor) {
        if (actor instanceof HealthcareUserPrincipal principal) {
            return userRepository.findById(principal.getUserId()).orElse(null);
        }
        return userRepository.findByEmail(actor.getUsername()).orElse(null);
    }
}
