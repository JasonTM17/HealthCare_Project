package com.healthcare.hospital.service;

import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.SpecialtyResponse;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class SpecialtyService {

    private final SpecialtyRepository specialtyRepository;

    public SpecialtyService(SpecialtyRepository specialtyRepository) {
        this.specialtyRepository = specialtyRepository;
    }

    public Page<SpecialtyResponse> listActive(Pageable pageable) {
        return specialtyRepository.findByActiveTrue(pageable).map(this::toResponse);
    }

    public SpecialtyResponse getBySlug(String slug) {
        return specialtyRepository.findBySlugAndActiveTrue(slug)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Specialty not found: " + slug));
    }

    private SpecialtyResponse toResponse(Specialty specialty) {
        return new SpecialtyResponse(
            specialty.getId().toString(),
            specialty.getName(),
            specialty.getSlug(),
            specialty.getDescription()
        );
    }
}
