package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.dto.DoctorSummaryResponse;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final DoctorSpecialtyRepository doctorSpecialtyRepository;

    public DoctorService(
        DoctorRepository doctorRepository,
        DoctorBranchRepository doctorBranchRepository,
        DoctorSpecialtyRepository doctorSpecialtyRepository
    ) {
        this.doctorRepository = doctorRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.doctorSpecialtyRepository = doctorSpecialtyRepository;
    }

    public Page<DoctorResponse> listActive(Pageable pageable) {
        return doctorRepository.findByActiveTrue(pageable).map(this::toResponse);
    }

    public Page<DoctorResponse> listActive(Pageable pageable, String specialtySlug, String branchSlug, String query) {
        return doctorRepository.findActiveWithFilters(
            normalizeFilter(specialtySlug),
            normalizeFilter(branchSlug),
            normalizeFilter(query),
            pageable
        ).map(this::toResponse);
    }

    public DoctorResponse getBySlug(String slug) {
        return doctorRepository.findBySlugAndActiveTrue(slug)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + slug));
    }

    public DoctorResponse getByUserId(java.util.UUID userId) {
        return doctorRepository.findByUserId(userId)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for the authenticated user"));
    }

    private String normalizeFilter(String value) {
        if (value == null) return "";
        String normalized = value.trim();
        return normalized;
    }

    private DoctorResponse toResponse(Doctor doctor) {
        List<com.healthcare.hospital.entity.DoctorBranch> branchLinks = doctorBranchRepository.findByDoctorId(doctor.getId());
        List<com.healthcare.hospital.entity.DoctorSpecialty> specialtyLinks = doctorSpecialtyRepository.findByDoctorId(doctor.getId());
        String branchId = branchLinks.stream()
            .findFirst()
            .map(link -> link.getBranch().getId().toString())
            .orElse(null);
        String specialtyName = specialtyLinks.stream()
            .findFirst()
            .map(link -> link.getSpecialty().getName())
            .orElse(null);

        return new DoctorResponse(
            doctor.getId().toString(),
            doctor.getFullName(),
            doctor.getSlug(),
            doctor.getBio(),
            doctor.getPhotoUrl(),
            specialtyName,
            branchId,
            branchLinks.stream().map(link -> link.getBranch().getId().toString()).toList(),
            branchLinks.stream().map(link -> link.getBranch().getName()).toList(),
            specialtyLinks.stream().map(link -> link.getSpecialty().getSlug()).toList()
        );
    }

    DoctorSummaryResponse toSummary(Doctor doctor) {
        String branchId = doctorBranchRepository.findFirstByDoctorId(doctor.getId())
            .map(link -> link.getBranch().getId().toString())
            .orElse(null);
        String specialtyName = doctorSpecialtyRepository.findFirstByDoctorId(doctor.getId())
            .map(link -> link.getSpecialty().getName())
            .orElse(null);
        return new DoctorSummaryResponse(
            doctor.getId().toString(),
            doctor.getFullName(),
            doctor.getSlug(),
            doctor.getPhotoUrl(),
            specialtyName,
            branchId
        );
    }
}
