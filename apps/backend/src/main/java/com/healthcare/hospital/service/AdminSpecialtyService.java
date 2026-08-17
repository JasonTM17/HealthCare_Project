package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSpecialtyService {

    private final SpecialtyRepository specialtyRepository;

    public AdminSpecialtyService(SpecialtyRepository specialtyRepository) {
        this.specialtyRepository = specialtyRepository;
    }

    @Transactional
    public Specialty create(SpecialtyRequest request) {
        if (specialtyRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Specialty slug already exists: " + request.slug());
        }
        Specialty specialty = new Specialty();
        specialty.setName(request.name());
        specialty.setSlug(request.slug());
        specialty.setDescription(request.description());
        specialty.setActive(request.active());
        return specialtyRepository.save(specialty);
    }

    @Transactional
    public Specialty update(String slug, SpecialtyRequest request) {
        Specialty specialty = specialtyRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Specialty not found: " + slug));
        if (!slug.equals(request.slug()) && specialtyRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Specialty slug already exists: " + request.slug());
        }
        specialty.setName(request.name());
        specialty.setSlug(request.slug());
        specialty.setDescription(request.description());
        specialty.setActive(request.active());
        return specialtyRepository.save(specialty);
    }

    @Transactional
    public void delete(String slug) {
        Specialty specialty = specialtyRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Specialty not found: " + slug));
        specialtyRepository.delete(specialty);
    }
}
