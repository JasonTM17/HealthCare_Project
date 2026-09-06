package com.healthcare.hospital.service;

import com.healthcare.common.SafePageRequests;
import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.dto.DoctorSummaryResponse;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class DoctorService {

    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of("id", "fullName", "slug");

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
        return doctorRepository.findByActiveTrue(safePageable(pageable)).map(this::toResponse);
    }

    public Page<DoctorResponse> listActive(Pageable pageable, String specialtySlug, String branchSlug, String query) {
        return doctorRepository.findActiveWithFilters(
            normalizeFilter(specialtySlug),
            normalizeFilter(branchSlug),
            normalizeFilter(query),
            safePageable(pageable)
        ).map(this::toResponse);
    }

    private Pageable safePageable(Pageable pageable) {
        return SafePageRequests.normalize(pageable, Sort.unsorted(), ALLOWED_SORT_PROPERTIES);
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
            specialtyLinks.stream().map(link -> link.getSpecialty().getSlug()).toList(),
            doctor.getAchievements(),
            doctor.getAiCredits()
        );
    }

    @org.springframework.transaction.annotation.Transactional
    public DoctorResponse updateProfile(UUID userId, com.healthcare.hospital.dto.UpdateDoctorProfileRequest request) {
        Doctor doctor = doctorRepository.findByUserId(userId)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor profile not found for user"));
        if (request.bio() != null) {
            doctor.setBio(request.bio());
        }
        if (request.achievements() != null) {
            doctor.setAchievements(request.achievements());
        }
        if (request.photoUrl() != null && !request.photoUrl().isBlank()) {
            doctor.setPhotoUrl(request.photoUrl());
        }
        return toResponse(doctorRepository.saveAndFlush(doctor));
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
