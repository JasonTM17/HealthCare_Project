package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.service.AdminFaqService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/faqs")
@PreAuthorize("hasRole('ADMIN')")
public class AdminFaqController {

    private final AdminFaqService adminFaqService;

    public AdminFaqController(AdminFaqService adminFaqService) {
        this.adminFaqService = adminFaqService;
    }

    @GetMapping
    public Page<Faq> list(@PageableDefault(size = 20, sort = "question") Pageable pageable) {
        return adminFaqService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<Faq> create(
            @Valid @RequestBody FaqRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminFaqService.create(request, actor));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Faq> update(
            @PathVariable UUID id,
            @Valid @RequestBody FaqRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(adminFaqService.update(id, request, actor));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails actor) {
        adminFaqService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }
}
