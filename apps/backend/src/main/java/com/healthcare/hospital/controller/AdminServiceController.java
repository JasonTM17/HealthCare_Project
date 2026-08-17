package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.ServiceRequest;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.service.AdminServiceService;
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

@RestController
@RequestMapping("/api/v1/admin/services")
@PreAuthorize("hasRole('ADMIN')")
public class AdminServiceController {

    private final AdminServiceService adminServiceService;

    public AdminServiceController(AdminServiceService adminServiceService) {
        this.adminServiceService = adminServiceService;
    }

    @PostMapping
    public ResponseEntity<MedicalService> create(@Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.ok(adminServiceService.create(request));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<MedicalService> update(@PathVariable String slug, @Valid @RequestBody ServiceRequest request) {
        return ResponseEntity.ok(adminServiceService.update(slug, request));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminServiceService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
