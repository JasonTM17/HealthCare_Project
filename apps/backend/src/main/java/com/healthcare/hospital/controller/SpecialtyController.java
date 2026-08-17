package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.SpecialtyResponse;
import com.healthcare.hospital.service.SpecialtyService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital/specialties")
public class SpecialtyController {

    private final SpecialtyService specialtyService;

    public SpecialtyController(SpecialtyService specialtyService) {
        this.specialtyService = specialtyService;
    }

    @GetMapping
    public Page<SpecialtyResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return specialtyService.listActive(pageable);
    }

    @GetMapping("/{slug}")
    public SpecialtyResponse getBySlug(@PathVariable String slug) {
        return specialtyService.getBySlug(slug);
    }
}
