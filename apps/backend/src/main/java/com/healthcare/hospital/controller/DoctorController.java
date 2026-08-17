package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.service.DoctorService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping
    public Page<DoctorResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return doctorService.listActive(pageable);
    }

    @GetMapping("/{slug}")
    public DoctorResponse getBySlug(@PathVariable String slug) {
        return doctorService.getBySlug(slug);
    }
}
