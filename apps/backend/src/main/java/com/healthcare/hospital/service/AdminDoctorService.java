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
import com.healthcare.user.service.AccountGovernance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final AiClinicalContentRevisionService revisionService;
    private final AccountGovernance governance;

    public AdminDoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository) {
        this(doctorRepository, userRepository, doctorBranchRepository, null);
    }

    public AdminDoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository,
            AiClinicalContentRevisionService revisionService) {
        this(doctorRepository, userRepository, doctorBranchRepository, revisionService, null);
    }

    @Autowired
    public AdminDoctorService(DoctorRepository doctorRepository, UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository, AiClinicalContentRevisionService revisionService,
            AccountGovernance governance) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.revisionService = revisionService;
        this.governance = governance;
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
        if (governance != null) governance.acquire();
        Map<UUID, User> locked = lockIdentities(null, request.userId());
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
        Doctor saved = doctorRepository.save(doctor);
        syncLinkedUserDisplayName(saved, locked);
        invalidateBinding(null, saved.getUserId(), locked);
        return saved;
    }

    @Transactional
    public Doctor update(String slug, DoctorRequest request) {
        if (governance != null) governance.acquire();
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        UUID previousUserId = doctor.getUserId();
        Map<UUID, User> locked = lockIdentities(doctor, request.userId());
        if (governance != null) doctor = doctorRepository.findByIdForUpdate(doctor.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found"));
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
        Doctor saved = doctorRepository.save(doctor);
        syncLinkedUserDisplayName(saved, locked);
        invalidateBinding(previousUserId, saved.getUserId(), locked);
        return saved;
    }

    private void syncLinkedUserDisplayName(Doctor doctor, Map<UUID, User> locked) {
        // The doctor portal header and article author credit both read
        // users.display_name; keeping it equal to the doctor's full name
        // prevents the stale-account-name defect class from V103 recurring.
        if (doctor.getUserId() == null) {
            return;
        }
        java.util.Optional<User> account = governance == null ? userRepository.findById(doctor.getUserId())
            : java.util.Optional.ofNullable(locked.get(doctor.getUserId()));
        account.ifPresent(user -> {
            if (!doctor.getFullName().equals(user.getDisplayName())) {
                user.setDisplayName(doctor.getFullName());
                user.setUpdatedAt(java.time.OffsetDateTime.now());
                userRepository.save(user);
            }
        });
    }

    @Transactional
    public void delete(String slug) {
        if (governance != null) governance.acquire();
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        Map<UUID, User> locked = lockIdentities(doctor, null);
        if (governance != null) doctor = doctorRepository.findByIdForUpdate(doctor.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Doctor profile not found"));
        if (revisionService != null) revisionService.recordDoctorDeletion(doctor, null);
        invalidateBinding(doctor.getUserId(), null, locked);
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

    private Map<UUID, User> lockIdentities(Doctor doctor, UUID proposedUser) {
        if (governance == null) return Map.of(); // Retained standalone unit-fixture constructors.
        List<UUID> affected = new ArrayList<>();
        if (doctor != null && doctor.getUserId() != null) affected.add(doctor.getUserId());
        if (proposedUser != null) affected.add(proposedUser);
        Map<UUID, User> locked = governance.lockUsersAndAuthorize(affected);
        affected.forEach(id -> AccountGovernance.requireMutable(locked.get(id)));
        return locked;
    }

    private void invalidateBinding(UUID before, UUID after, Map<UUID, User> locked) {
        if (governance == null || java.util.Objects.equals(before, after)) return;
        if (before != null) governance.invalidateCredentials(locked.get(before), "DOCTOR_BINDING_CHANGED");
        if (after != null) governance.invalidateCredentials(locked.get(after), "DOCTOR_BINDING_CHANGED");
    }
}
