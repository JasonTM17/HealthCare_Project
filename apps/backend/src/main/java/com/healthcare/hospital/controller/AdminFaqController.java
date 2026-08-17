package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.service.AdminFaqService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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

    @PostMapping
    public ResponseEntity<Faq> create(@Valid @RequestBody FaqRequest request) {
        return ResponseEntity.ok(adminFaqService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Faq> update(@PathVariable UUID id, @Valid @RequestBody FaqRequest request) {
        return ResponseEntity.ok(adminFaqService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        adminFaqService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
