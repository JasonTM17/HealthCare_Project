package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSpecialtyService {

    private final SpecialtyRepository specialtyRepository;
    private final com.healthcare.ai.service.AiClinicalContentRevisionService revisionService;

    public AdminSpecialtyService(SpecialtyRepository specialtyRepository) {
        this(specialtyRepository, null);
    }

    @Autowired
    public AdminSpecialtyService(
            SpecialtyRepository specialtyRepository,
            com.healthcare.ai.service.AiClinicalContentRevisionService revisionService) {
        this.specialtyRepository = specialtyRepository;
        this.revisionService = revisionService;
    }

    @Transactional(readOnly = true)
    public Page<Specialty> list(Pageable pageable) {
        return specialtyRepository.findAll(pageable);
    }

    @Transactional
    public Specialty create(SpecialtyRequest request) {
        return create(request, null);
    }

    @Transactional
    public Specialty create(SpecialtyRequest request, UserDetails actor) {
        if (specialtyRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Specialty slug already exists: " + request.slug());
        }
        Specialty specialty = new Specialty();
        specialty.setName(request.name());
        specialty.setSlug(request.slug());
        specialty.setDescription(request.description());
        applyRichFields(specialty, request);
        specialty.setActive(request.active());
        Specialty saved = specialtyRepository.saveAndFlush(specialty);
        if (revisionService != null) revisionService.recordSpecialty(saved, actor);
        return saved;
    }

    @Transactional
    public Specialty update(String slug, SpecialtyRequest request) {
        return update(slug, request, null);
    }

    @Transactional
    public Specialty update(String slug, SpecialtyRequest request, UserDetails actor) {
        Specialty specialty = specialtyRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Specialty not found: " + slug));
        if (!slug.equals(request.slug()) && specialtyRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Specialty slug already exists: " + request.slug());
        }
        specialty.setName(request.name());
        specialty.setSlug(request.slug());
        specialty.setDescription(request.description());
        applyRichFields(specialty, request);
        specialty.setActive(request.active());
        Specialty saved = specialtyRepository.saveAndFlush(specialty);
        if (revisionService != null) revisionService.recordSpecialty(saved, actor);
        return saved;
    }

    @Transactional
    public void delete(String slug) {
        delete(slug, null);
    }

    @Transactional
    public void delete(String slug, UserDetails actor) {
        Specialty specialty = specialtyRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Specialty not found: " + slug));
        if (revisionService != null) revisionService.recordSpecialtyDeletion(specialty, actor);
        specialtyRepository.delete(specialty);
    }

    private void applyRichFields(Specialty specialty, SpecialtyRequest request) {
        // Preserve omitted additive fields for source-compatible legacy admin
        // clients; an explicitly supplied empty list intentionally clears it.
        if (request.commonSymptoms() != null) {
            specialty.setCommonSymptoms(HospitalJsonMapper.stringArray(request.commonSymptoms()));
        }
        if (request.preparationSteps() != null) {
            specialty.setPreparationSteps(HospitalJsonMapper.stringArray(request.preparationSteps()));
        }
        if (request.carePathway() != null) {
            specialty.setCarePathway(request.carePathway().strip());
        }
        if (request.clinicalOverview() != null) specialty.setClinicalOverview(request.clinicalOverview().strip());
        if (request.commonConditions() != null) specialty.setCommonConditions(HospitalJsonMapper.stringArray(request.commonConditions()));
        if (request.redFlags() != null) specialty.setRedFlags(HospitalJsonMapper.stringArray(request.redFlags()));
        if (request.preventiveCare() != null) specialty.setPreventiveCare(HospitalJsonMapper.stringArray(request.preventiveCare()));
        if (request.whenToSeekCare() != null) specialty.setWhenToSeekCare(request.whenToSeekCare().strip());
        if (request.sourceReferences() != null) specialty.setSourceReferences(HospitalJsonMapper.stringArray(request.sourceReferences()));
        if (request.clinicalMetadata() != null) specialty.setClinicalMetadata(HospitalJsonMapper.stringObject(request.clinicalMetadata()));
    }
}
