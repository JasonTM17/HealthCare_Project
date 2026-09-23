package com.healthcare.hospital.service;

import com.healthcare.ai.service.AiClinicalContentRevisionService;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.AdminDoctorResponse;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final AiClinicalContentRevisionService revisionService;

    public AdminDoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository) {
        this(doctorRepository, userRepository, doctorBranchRepository, null);
    }

    @Autowired
    public AdminDoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository,
            AiClinicalContentRevisionService revisionService) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.revisionService = revisionService;
    }

    /**
     * Admin doctor page. Returns {@link AdminDoctorResponse} rather than the raw
     * entity so each row carries {@code branchIds} resolved from the
     * {@code doctor_branches} link table — the same source
     * {@link DoctorService} uses for the public catalog — which the admin
     * schedules page depends on to populate its branch dropdown. Paging and
     * sort from {@code pageable} are preserved by {@link Page#map}.
     */
    @Transactional(readOnly = true)
    public Page<AdminDoctorResponse> list(Pageable pageable) {
        Page<Doctor> page = doctorRepository.findAll(pageable);
        List<Doctor> doctors = page.getContent();
        if (doctors.isEmpty()) {
            return page.map(doctor -> AdminDoctorResponse.from(doctor, List.of()));
        }
        List<UUID> doctorIds = doctors.stream().map(Doctor::getId).toList();
        Map<UUID, List<String>> branchIdsByDoctor = doctorBranchRepository.findByDoctorIdIn(doctorIds).stream()
            .collect(Collectors.groupingBy(
                link -> link.getDoctor().getId(),
                Collectors.mapping(link -> link.getBranch().getId().toString(), Collectors.toList())));
        return page.map(doctor -> AdminDoctorResponse.from(
            doctor,
            branchIdsByDoctor.getOrDefault(doctor.getId(), List.of())));
    }

    @Transactional
    public Doctor create(DoctorRequest request) {
        if (doctorRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Doctor slug already exists: " + request.slug());
        }
        Doctor doctor = new Doctor();
        doctor.setFullName(request.fullName());
        doctor.setSlug(request.slug());
        doctor.setBio(request.bio());
        doctor.setPhotoUrl(request.photoUrl());
        doctor.setActive(request.active());
        if (request.userId() != null) {
            applyUserLink(doctor, request.userId());
        }
        return doctorRepository.save(doctor);
    }

    @Transactional
    public Doctor update(String slug, DoctorRequest request) {
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        if (!slug.equals(request.slug()) && doctorRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Doctor slug already exists: " + request.slug());
        }
        doctor.setFullName(request.fullName());
        doctor.setSlug(request.slug());
        doctor.setBio(request.bio());
        doctor.setPhotoUrl(request.photoUrl());
        doctor.setActive(request.active());
        if (request.userId() != null) {
            applyUserLink(doctor, request.userId());
        }
        return doctorRepository.save(doctor);
    }

    @Transactional
    public void delete(String slug) {
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        if (revisionService != null) revisionService.recordDoctorDeletion(doctor, null);
        doctorRepository.delete(doctor);
    }

    private void applyUserLink(Doctor doctor, java.util.UUID userId) {
        if (userId == null) {
            return;
        }

        User user = userRepository.findWithRolesById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor user not found: " + userId));
        boolean doctorRole = user.getRoles().stream().anyMatch(role -> "DOCTOR".equals(role.getCode()));
        if (!doctorRole) {
            throw new BusinessException(400, "Linked user must have the DOCTOR role");
        }

        doctorRepository.findByUserId(userId)
            .filter(existing -> !existing.getId().equals(doctor.getId()))
            .ifPresent(existing -> {
                throw new DuplicateResourceException("User is already linked to another doctor");
            });
        doctor.setUserId(userId);
    }
}
