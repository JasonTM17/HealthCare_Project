package com.healthcare.hospital.service;

import com.healthcare.ai.service.AiClinicalContentRevisionService;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.AdminDoctorResponse;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final DoctorSpecialtyRepository doctorSpecialtyRepository;
    private final BranchRepository branchRepository;
    private final SpecialtyRepository specialtyRepository;
    private final AiClinicalContentRevisionService revisionService;

    public AdminDoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository,
            DoctorSpecialtyRepository doctorSpecialtyRepository,
            BranchRepository branchRepository,
            SpecialtyRepository specialtyRepository) {
        this(doctorRepository, userRepository, doctorBranchRepository,
            doctorSpecialtyRepository, branchRepository, specialtyRepository, null);
    }

    @Autowired
    public AdminDoctorService(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorBranchRepository doctorBranchRepository,
            DoctorSpecialtyRepository doctorSpecialtyRepository,
            BranchRepository branchRepository,
            SpecialtyRepository specialtyRepository,
            AiClinicalContentRevisionService revisionService) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.doctorSpecialtyRepository = doctorSpecialtyRepository;
        this.branchRepository = branchRepository;
        this.specialtyRepository = specialtyRepository;
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
            return page.map(doctor -> AdminDoctorResponse.from(doctor, List.of(), List.of()));
        }
        List<UUID> doctorIds = doctors.stream().map(Doctor::getId).toList();
        Map<UUID, List<String>> branchIdsByDoctor = doctorBranchRepository.findByDoctorIdIn(doctorIds).stream()
            .collect(Collectors.groupingBy(
                link -> link.getDoctor().getId(),
                Collectors.mapping(link -> link.getBranch().getId().toString(), Collectors.toList())));
        Map<UUID, List<String>> specialtyIdsByDoctor = doctorSpecialtyRepository.findByDoctorIdIn(doctorIds).stream()
            .collect(Collectors.groupingBy(
                link -> link.getDoctor().getId(),
                Collectors.mapping(link -> link.getSpecialty().getId().toString(), Collectors.toList())));
        List<UUID> linkedUserIds = doctors.stream()
            .map(Doctor::getUserId)
            .filter(id -> id != null)
            .toList();
        Map<UUID, User> linkedUsers = userRepository.findAllById(linkedUserIds).stream()
            .collect(Collectors.toMap(User::getId, user -> user));
        return page.map(doctor -> AdminDoctorResponse.from(
            doctor,
            branchIdsByDoctor.getOrDefault(doctor.getId(), List.of()),
            specialtyIdsByDoctor.getOrDefault(doctor.getId(), List.of()),
            linkedAccountOf(doctor, linkedUsers)));
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
        applyUserLink(doctor, request.userId(), request.unlinkUser());
        Doctor saved = doctorRepository.save(doctor);
        syncBranches(saved, request.branchIds());
        syncSpecialties(saved, request.specialtyIds());
        syncLinkedUserDisplayName(saved);
        return saved;
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
        applyUserLink(doctor, request.userId(), request.unlinkUser());
        Doctor saved = doctorRepository.save(doctor);
        syncBranches(saved, request.branchIds());
        syncSpecialties(saved, request.specialtyIds());
        syncLinkedUserDisplayName(saved);
        return saved;
    }

    /**
     * Replaces {@code doctor_branches} membership with the requested set.
     * {@code null} leaves the table untouched; an empty list clears every
     * link, which is how the admin schedules page finally gets a writable
     * "gán cơ sở" path. Unknown branch ids are rejected before any write.
     */
    private void syncBranches(Doctor doctor, List<UUID> requestedIds) {
        if (requestedIds == null) {
            return;
        }
        Set<UUID> wanted = new HashSet<>(requestedIds);
        Map<UUID, Branch> branches = branchRepository.findAllById(wanted).stream()
            .collect(Collectors.toMap(Branch::getId, link -> link));
        for (UUID id : wanted) {
            if (!branches.containsKey(id)) {
                throw new ResourceNotFoundException("Không tìm thấy cơ sở: " + id);
            }
        }
        List<DoctorBranch> existing = doctorBranchRepository.findByDoctorId(doctor.getId());
        for (DoctorBranch link : existing) {
            if (!wanted.contains(link.getBranch().getId())) {
                doctorBranchRepository.delete(link);
            }
        }
        Set<UUID> present = existing.stream()
            .map(link -> link.getBranch().getId()).collect(Collectors.toSet());
        for (UUID id : wanted) {
            if (!present.contains(id)) {
                DoctorBranch link = new DoctorBranch();
                link.setDoctor(doctor);
                link.setBranch(branches.get(id));
                doctorBranchRepository.save(link);
            }
        }
    }

    private void syncSpecialties(Doctor doctor, List<UUID> requestedIds) {
        if (requestedIds == null) {
            return;
        }
        Set<UUID> wanted = new HashSet<>(requestedIds);
        Map<UUID, Specialty> specialties = specialtyRepository.findAllById(wanted).stream()
            .collect(Collectors.toMap(Specialty::getId, link -> link));
        for (UUID id : wanted) {
            if (!specialties.containsKey(id)) {
                throw new ResourceNotFoundException("Không tìm thấy chuyên khoa: " + id);
            }
        }
        List<DoctorSpecialty> existing = doctorSpecialtyRepository.findByDoctorId(doctor.getId());
        for (DoctorSpecialty link : existing) {
            if (!wanted.contains(link.getSpecialty().getId())) {
                doctorSpecialtyRepository.delete(link);
            }
        }
        Set<UUID> present = existing.stream()
            .map(link -> link.getSpecialty().getId()).collect(Collectors.toSet());
        for (UUID id : wanted) {
            if (!present.contains(id)) {
                DoctorSpecialty link = new DoctorSpecialty();
                link.setDoctor(doctor);
                link.setSpecialty(specialties.get(id));
                doctorSpecialtyRepository.save(link);
            }
        }
    }

    private void syncLinkedUserDisplayName(Doctor doctor) {
        // The doctor portal header and article author credit both read
        // users.display_name; keeping it equal to the doctor's full name
        // prevents the stale-account-name defect class from V103 recurring.
        if (doctor.getUserId() == null) {
            return;
        }
        userRepository.findById(doctor.getUserId()).ifPresent(user -> {
            if (!doctor.getFullName().equals(user.getDisplayName())) {
                user.setDisplayName(doctor.getFullName());
                user.setUpdatedAt(java.time.OffsetDateTime.now());
                userRepository.save(user);
            }
        });
    }

    @Transactional
    public void delete(String slug) {
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        if (revisionService != null) revisionService.recordDoctorDeletion(doctor, null);
        doctorRepository.delete(doctor);
    }

    private AdminDoctorResponse.LinkedDoctorAccount linkedAccountOf(Doctor doctor, Map<UUID, User> linkedUsers) {
        UUID userId = doctor.getUserId();
        if (userId == null) {
            return null;
        }
        User linked = linkedUsers.get(userId);
        if (linked == null) {
            return null;
        }
        return new AdminDoctorResponse.LinkedDoctorAccount(
            linked.getId().toString(), linked.getEmail(), linked.getDisplayName());
    }

    private void applyUserLink(Doctor doctor, java.util.UUID userId, boolean unlinkUser) {
        if (unlinkUser && userId != null) {
            throw new BusinessException(400,
                "Không thể vừa liên kết tài khoản vừa yêu cầu gỡ liên kết.");
        }
        // Identity-adjacent: rebinding which login owns a doctor profile is the
        // same class of mutation as /api/v1/admin/users/** — demo principals may
        // still edit resettable doctor content but must not change the link.
        if ((userId != null || unlinkUser) && isDemoPrincipal()) {
            throw new BusinessException(403,
                "Demo accounts cannot perform this action. High-impact financial and "
                    + "security mutations are disabled for synthetic demo identities.");
        }
        if (unlinkUser) {
            doctor.setUserId(null);
            return;
        }
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

    private boolean isDemoPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
            && authentication.getPrincipal() instanceof HealthcareUserPrincipal principal
            && principal.isDemo();
    }
}
