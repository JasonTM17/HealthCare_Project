package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.service.AdminDoctorService;
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
@RequestMapping("/api/v1/admin/doctors")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDoctorController {

    private final AdminDoctorService adminDoctorService;

    public AdminDoctorController(AdminDoctorService adminDoctorService) {
        this.adminDoctorService = adminDoctorService;
    }

    @GetMapping
    public Page<Doctor> list(@PageableDefault(size = 20, sort = "fullName") Pageable pageable) {
        return adminDoctorService.list(pageable);
    }

    @PostMapping
    public ResponseEntity<Doctor> create(@Valid @RequestBody DoctorRequest request) {
        return ResponseEntity.ok(adminDoctorService.create(request));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Doctor> update(@PathVariable String slug, @Valid @RequestBody DoctorRequest request) {
        return ResponseEntity.ok(adminDoctorService.update(slug, request));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        adminDoctorService.delete(slug);
        return ResponseEntity.noContent().build();
    }
}
