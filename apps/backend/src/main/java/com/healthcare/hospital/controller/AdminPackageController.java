package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.service.AdminPackageService;
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
@RequestMapping("/api/v1/admin/packages")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPackageController {

    private final AdminPackageService adminPackageService;

    public AdminPackageController(AdminPackageService adminPackageService) {
        this.adminPackageService = adminPackageService;
    }

    @GetMapping
    public Page<Package> list(@PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminPackageService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<Package> create(@Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(adminPackageService.create(request));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Package> update(@PathVariable String slug, @Valid @RequestBody PackageRequest request) {
        return ResponseEntity.ok(adminPackageService.update(slug, request));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminPackageService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
