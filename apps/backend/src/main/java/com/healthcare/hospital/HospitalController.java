package com.healthcare.hospital;

import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.dto.BranchResponse;
import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.dto.FaqResponse;
import com.healthcare.hospital.dto.PackageResponse;
import com.healthcare.hospital.dto.SpecialtyResponse;
import com.healthcare.hospital.service.ArticleService;
import com.healthcare.hospital.service.BranchService;
import com.healthcare.hospital.service.DoctorService;
import com.healthcare.hospital.service.FaqService;
import com.healthcare.hospital.service.PackageService;
import com.healthcare.hospital.service.SpecialtyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Public hospital domain API — all endpoints are unauthenticated.
 *
 * <p>Provides read-only access to specialties, doctors, branches (facilities),
 * health-care packages, published articles, and FAQs.
 *
 * <p>Responses come from the active/published catalog managed through the admin APIs.
 */
@Tag(name = "Hospital Domain", description = "Public read-only hospital domain endpoints")
public class HospitalController {

    private final SpecialtyService specialtyService;
    private final DoctorService doctorService;
    private final BranchService branchService;
    private final PackageService packageService;
    private final ArticleService articleService;
    private final FaqService faqService;

    public HospitalController(SpecialtyService specialtyService,
                               DoctorService doctorService,
                               BranchService branchService,
                               PackageService packageService,
                               ArticleService articleService,
                               FaqService faqService) {
        this.specialtyService = specialtyService;
        this.doctorService = doctorService;
        this.branchService = branchService;
        this.packageService = packageService;
        this.articleService = articleService;
        this.faqService = faqService;
    }

    // ── Specialties ────────────────────────────────────────────────────────────

    @GetMapping("/specialties")
    @Operation(summary = "List active specialties (paginated)")
    public ResponseEntity<Page<SpecialtyResponse>> listSpecialties(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("name"));
        return ResponseEntity.ok(specialtyService.listActive(pageable));
    }

    @GetMapping("/specialties/{slug}")
    @Operation(summary = "Get specialty by slug")
    public ResponseEntity<SpecialtyResponse> getSpecialty(@PathVariable String slug) {
        SpecialtyResponse specialty = specialtyService.getBySlug(slug);
        return specialty != null ? ResponseEntity.ok(specialty) : ResponseEntity.notFound().build();
    }

    // ── Doctors ───────────────────────────────────────────────────────────────

    @GetMapping("/doctors")
    @Operation(summary = "List active doctors (paginated)")
    public ResponseEntity<Page<DoctorResponse>> listDoctors(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("fullName"));
        return ResponseEntity.ok(doctorService.listActive(pageable));
    }

    @GetMapping("/doctors/{slug}")
    @Operation(summary = "Get doctor by slug")
    public ResponseEntity<DoctorResponse> getDoctor(@PathVariable String slug) {
        DoctorResponse doctor = doctorService.getBySlug(slug);
        return doctor != null ? ResponseEntity.ok(doctor) : ResponseEntity.notFound().build();
    }

    // ── Branches (Facilities) ─────────────────────────────────────────────────

    @GetMapping("/branches")
    @Operation(summary = "List active branches / facilities (paginated)")
    public ResponseEntity<Page<BranchResponse>> listBranches(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("name"));
        return ResponseEntity.ok(branchService.listActive(pageable));
    }

    @GetMapping("/branches/{slug}")
    @Operation(summary = "Get branch by slug")
    public ResponseEntity<BranchResponse> getBranch(@PathVariable String slug) {
        BranchResponse branch = branchService.getBySlug(slug);
        return branch != null ? ResponseEntity.ok(branch) : ResponseEntity.notFound().build();
    }

    // ── Packages ──────────────────────────────────────────────────────────────

    @GetMapping("/packages")
    @Operation(summary = "List active health-care packages (paginated)")
    public ResponseEntity<Page<PackageResponse>> listPackages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("name"));
        return ResponseEntity.ok(packageService.listActive(pageable));
    }

    @GetMapping("/packages/{slug}")
    @Operation(summary = "Get package by slug")
    public ResponseEntity<PackageResponse> getPackage(@PathVariable String slug) {
        PackageResponse pkg = packageService.getBySlug(slug);
        return pkg != null ? ResponseEntity.ok(pkg) : ResponseEntity.notFound().build();
    }

    // ── Articles ──────────────────────────────────────────────────────────────

    @GetMapping("/articles")
    @Operation(summary = "List published articles, newest first (paginated)")
    public ResponseEntity<Page<ArticleResponse>> listArticles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        return ResponseEntity.ok(articleService.listPublished(pageable));
    }

    @GetMapping("/articles/{slug}")
    @Operation(summary = "Get article by slug")
    public ResponseEntity<ArticleResponse> getArticle(@PathVariable String slug) {
        ArticleResponse article = articleService.getBySlug(slug);
        return article != null ? ResponseEntity.ok(article) : ResponseEntity.notFound().build();
    }

    // ── FAQs ──────────────────────────────────────────────────────────────────

    @GetMapping("/faqs")
    @Operation(summary = "List active FAQs (paginated)")
    public ResponseEntity<Page<FaqResponse>> listFaqs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return ResponseEntity.ok(faqService.listActive(pageable));
    }
}
