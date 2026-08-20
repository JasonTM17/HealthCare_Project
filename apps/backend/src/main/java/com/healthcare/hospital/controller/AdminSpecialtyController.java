package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.service.AdminSpecialtyService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/specialties")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSpecialtyController {

    private final AdminSpecialtyService adminSpecialtyService;

    public AdminSpecialtyController(AdminSpecialtyService adminSpecialtyService) {
        this.adminSpecialtyService = adminSpecialtyService;
    }

    @GetMapping
    public Page<Specialty> list(@PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminSpecialtyService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<Specialty> create(@Valid @RequestBody SpecialtyRequest request) {
        return ResponseEntity.ok(adminSpecialtyService.create(request));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Specialty> update(@PathVariable String slug, @Valid @RequestBody SpecialtyRequest request) {
        return ResponseEntity.ok(adminSpecialtyService.update(slug, request));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminSpecialtyService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
