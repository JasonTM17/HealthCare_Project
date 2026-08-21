package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.BranchRequest;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.service.AdminBranchService;
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
@RequestMapping("/api/v1/admin/branches")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBranchController {

    private final AdminBranchService adminBranchService;

    public AdminBranchController(AdminBranchService adminBranchService) {
        this.adminBranchService = adminBranchService;
    }

    @GetMapping
    public Page<Branch> list(@PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminBranchService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<Branch> create(@Valid @RequestBody BranchRequest request) {
        return ResponseEntity.ok(adminBranchService.create(request));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Branch> update(@PathVariable String slug, @Valid @RequestBody BranchRequest request) {
        return ResponseEntity.ok(adminBranchService.update(slug, request));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminBranchService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
