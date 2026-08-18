package com.healthcare.hospital.service;

import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.SpecialtyResponse;
import com.healthcare.hospital.dto.DoctorSummaryResponse;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SpecialtyService {

    private final SpecialtyRepository specialtyRepository;
    private final DoctorSpecialtyRepository doctorSpecialtyRepository;

    public SpecialtyService(SpecialtyRepository specialtyRepository, DoctorSpecialtyRepository doctorSpecialtyRepository) {
        this.specialtyRepository = specialtyRepository;
        this.doctorSpecialtyRepository = doctorSpecialtyRepository;
    }

    public Page<SpecialtyResponse> listActive(Pageable pageable) {
        return specialtyRepository.findByActiveTrue(pageable).map(specialty -> toResponse(specialty, false));
    }

    public SpecialtyResponse getBySlug(String slug) {
        return specialtyRepository.findBySlugAndActiveTrue(slug)
            .map(specialty -> toResponse(specialty, true))
            .orElseThrow(() -> new ResourceNotFoundException("Specialty not found: " + slug));
    }

    private SpecialtyResponse toResponse(Specialty specialty, boolean includeDoctors) {
        List<DoctorSummaryResponse> relatedDoctors = includeDoctors
            ? doctorSpecialtyRepository.findBySpecialtyId(specialty.getId()).stream()
                .filter(link -> link.getDoctor().isActive())
                .map(link -> {
                    var doctor = link.getDoctor();
                    return new DoctorSummaryResponse(
                        doctor.getId().toString(),
                        doctor.getFullName(),
                        doctor.getSlug(),
                        doctor.getPhotoUrl(),
                        specialty.getName(),
                        null
                    );
                })
                .toList()
            : List.of();
        return new SpecialtyResponse(
            specialty.getId().toString(),
            specialty.getName(),
            specialty.getSlug(),
            specialty.getDescription(),
            HospitalJsonMapper.strings(specialty.getCommonSymptoms()),
            HospitalJsonMapper.strings(specialty.getPreparationSteps()),
            specialty.getCarePathway(),
            relatedDoctors
        );
    }
}
