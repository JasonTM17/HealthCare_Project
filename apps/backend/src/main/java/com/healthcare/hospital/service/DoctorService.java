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
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
        Page<Doctor> page = doctorRepository.findByActiveTrue(safePageable(pageable));
        return toResponsePage(page);
    }

    public Page<DoctorResponse> listActive(Pageable pageable, String specialtySlug, String branchSlug, String query) {
        Page<Doctor> page = doctorRepository.findActiveWithFilters(
            normalizeFilter(specialtySlug),
            normalizeFilter(branchSlug),
            normalizeFilter(query),
            safePageable(pageable)
        );
        return toResponsePage(page);
    }

    private Page<DoctorResponse> toResponsePage(Page<Doctor> page) {
        if (page.isEmpty()) {
            return page.map(this::toResponse);
        }
        List<Doctor> doctors = page.getContent();
        List<UUID> doctorIds = doctors.stream().map(Doctor::getId).toList();

        Map<UUID, List<com.healthcare.hospital.entity.DoctorBranch>> branchMap = doctorBranchRepository.findByDoctorIdIn(doctorIds).stream()
            .collect(Collectors.groupingBy(link -> link.getDoctor().getId()));

        Map<UUID, List<com.healthcare.hospital.entity.DoctorSpecialty>> specialtyMap = doctorSpecialtyRepository.findByDoctorIdIn(doctorIds).stream()
            .collect(Collectors.groupingBy(link -> link.getDoctor().getId()));

        return page.map(doctor -> toResponse(
            doctor,
            branchMap.getOrDefault(doctor.getId(), List.of()),
            specialtyMap.getOrDefault(doctor.getId(), List.of())
        ));
    }

    private Pageable safePageable(Pageable pageable) {
        return SafePageRequests.normalize(pageable, Sort.unsorted(), ALLOWED_SORT_PROPERTIES);
    }

    public DoctorResponse getBySlug(String slug) {
        return doctorRepository.findBySlugAndActiveTrue(slug)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + slug));
    }

    public com.healthcare.hospital.dto.DoctorProfileResponse getByUserId(java.util.UUID userId) {
        return doctorRepository.findByUserId(userId)
            .map(this::toProfileResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found for the authenticated user"));
    }

    /**
     * The public projection plus the AI credit balance. Only the authenticated
     * profile endpoints return this: the balance is the owning clinician's
     * accounting, and the public catalog shares {@link DoctorResponse} with the
     * appointment and care-plan surfaces.
     */
    private com.healthcare.hospital.dto.DoctorProfileResponse toProfileResponse(Doctor doctor) {
        return com.healthcare.hospital.dto.DoctorProfileResponse.of(toResponse(doctor), doctor.getAiCredits());
    }

    private String normalizeFilter(String value) {
        if (value == null) return "";
        String normalized = value.trim();
        return normalized;
    }

    private DoctorResponse toResponse(Doctor doctor) {
        List<com.healthcare.hospital.entity.DoctorBranch> branchLinks = doctorBranchRepository.findByDoctorId(doctor.getId());
        List<com.healthcare.hospital.entity.DoctorSpecialty> specialtyLinks = doctorSpecialtyRepository.findByDoctorId(doctor.getId());
        return toResponse(doctor, branchLinks, specialtyLinks);
    }

    private DoctorResponse toResponse(
        Doctor doctor,
        List<com.healthcare.hospital.entity.DoctorBranch> branchLinks,
        List<com.healthcare.hospital.entity.DoctorSpecialty> specialtyLinks
    ) {
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
            DoctorSummaryResponse.isDemoSlug(doctor.getSlug())
        );
    }

    @org.springframework.transaction.annotation.Transactional
    public com.healthcare.hospital.dto.DoctorProfileResponse updateProfile(UUID userId, com.healthcare.hospital.dto.UpdateDoctorProfileRequest request) {
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
        return toProfileResponse(doctorRepository.saveAndFlush(doctor));
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
            branchId,
            DoctorSummaryResponse.isDemoSlug(doctor.getSlug())
        );
    }
}
