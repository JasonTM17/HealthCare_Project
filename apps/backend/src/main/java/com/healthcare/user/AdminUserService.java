package com.healthcare.user;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.dto.AdminUserResponse;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_DISABLED = "DISABLED";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BrowserSessionService browserSessionService;
    private final UserSecurityLock userSecurityLock;
    private final ClinicalAccessAuditService auditService;

    public AdminUserService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            RefreshTokenRepository refreshTokenRepository,
            BrowserSessionService browserSessionService,
            UserSecurityLock userSecurityLock,
            ClinicalAccessAuditService auditService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.browserSessionService = browserSessionService;
        this.userSecurityLock = userSecurityLock;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> list(String role, String status, String q, Pageable pageable) {
        String normalizedRole = role == null || role.isBlank()
            ? null : role.trim().toUpperCase(Locale.ROOT);
        String normalizedStatus = status == null || status.isBlank()
            ? null : status.trim().toUpperCase(Locale.ROOT);
        if (normalizedStatus != null && !Set.of(STATUS_ACTIVE, STATUS_DISABLED).contains(normalizedStatus)) {
            throw new BusinessException(400, "Trạng thái tài khoản không hợp lệ.");
        }
        if (normalizedRole != null && !roleRepository.existsByCode(normalizedRole)) {
            throw new BusinessException(400, "Vai trò không hợp lệ.");
        }
        String like = q == null || q.isBlank()
            ? null : "%" + q.trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";

        Page<User> page = userRepository.findForAdmin(normalizedRole, normalizedStatus, like, pageable);
        List<UUID> ids = page.getContent().stream().map(User::getId).toList();
        Map<UUID, User> withRoles = userRepository.findAllWithRolesByIdIn(ids).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, PatientProfile> patients = patientProfileRepository.findAllByUserIdIn(ids).stream()
            .collect(Collectors.toMap(PatientProfile::getUserId, Function.identity(), (a, b) -> a));
        Map<UUID, Doctor> doctors = doctorRepository.findAllByUserIdIn(ids).stream()
            .collect(Collectors.toMap(Doctor::getUserId, Function.identity(), (a, b) -> a));
        return page.map(user -> toResponse(withRoles.getOrDefault(user.getId(), user), patients, doctors));
    }

    /**
     * Flips {@code users.status} between ACTIVE and DISABLED. A DISABLED
     * account fails every auth lane immediately (login, refresh, bearer JWT,
     * browser session, OTP/reset) and has its refresh tokens and browser
     * sessions revoked eagerly, so a ban takes effect without waiting for the
     * lazy per-request eligibility check.
     */
    @Transactional
    public AdminUserResponse updateStatus(UUID id, String requestedStatus, UserDetails principal) {
        String next = parseStatus(requestedStatus);
        if (STATUS_DISABLED.equals(next)) {
            lockAdminRosterSentinel();
        }
        User user = requireLocked(id);
        guardNotSelf(user, principal, "trạng thái");
        if (STATUS_DISABLED.equals(next)) {
            guardNotLastActiveAdmin(user);
        }
        user.setStatus(next);
        user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        User saved = userRepository.save(user);
        if (STATUS_DISABLED.equals(next)) {
            refreshTokenRepository.findAllActiveByUserId(saved.getId()).forEach(token -> {
                token.setRevokedAt(OffsetDateTime.now(ZoneOffset.UTC));
                refreshTokenRepository.save(token);
            });
            browserSessionService.revokeAllForUser(saved.getId(), "ADMIN_DISABLED_ACCOUNT");
        }
        audit(principal, saved, ClinicalAccessAuditService.ACTION_ADMIN_UPDATE_USER_STATUS);
        return toResponse(saved, Map.of(), Map.of());
    }

    /**
     * Replaces the account's role set. Every code must resolve to a seeded
     * role row; the set can never be empty, the operator cannot edit their own
     * account, and the last ACTIVE admin cannot lose the ADMIN role.
     */
    @Transactional
    public AdminUserResponse updateRoles(UUID id, List<String> roleCodes, UserDetails principal) {
        Set<String> codes = new HashSet<>();
        for (String code : roleCodes) {
            codes.add(code.trim().toUpperCase(Locale.ROOT));
        }
        Set<Role> roles = new HashSet<>();
        for (String code : codes) {
            roles.add(roleRepository.findByCode(code)
                .orElseThrow(() -> new BusinessException(400, "Vai trò không hợp lệ: " + code)));
        }
        lockAdminRosterSentinel();
        User user = requireLocked(id);
        guardNotSelf(user, principal, "vai trò");
        boolean losesAdmin = hasRole(user, "ADMIN") && !codes.contains("ADMIN");
        if (losesAdmin && STATUS_ACTIVE.equals(user.getStatus())) {
            guardNotLastActiveAdmin(user);
        }
        user.setRoles(roles);
        user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        User saved = userRepository.save(user);
        audit(principal, saved, ClinicalAccessAuditService.ACTION_ADMIN_UPDATE_USER_ROLES);
        return toResponse(saved, Map.of(), Map.of());
    }

    private String parseStatus(String value) {
        String next = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!Set.of(STATUS_ACTIVE, STATUS_DISABLED).contains(next)) {
            throw new BusinessException(400, "Trạng thái tài khoản không hợp lệ.");
        }
        return next;
    }

    /**
     * Shared sentinel for the active-admin invariant. Every mutation that can
     * shrink the active-admin set — disabling an account or rewriting roles —
     * takes this row lock BEFORE the per-user lock, in a fixed order, so two
     * concurrent requests can't each read the other admin as "still active"
     * and jointly remove the last one. A promotion only grows the set, but it
     * takes the same lock so demotion/disable decisions always see a
     * serialized roster.
     */
    private void lockAdminRosterSentinel() {
        roleRepository.findByCodeForUpdate("ADMIN");
    }

    private User requireLocked(UUID id) {
        return userSecurityLock.findByIdForUpdate(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản."));
    }

    private void guardNotSelf(User user, UserDetails principal, String field) {
        if (principal instanceof HealthcareUserPrincipal p && user.getId().equals(p.getUserId())) {
            throw new BusinessException(409,
                "Không thể thay đổi " + field + " của chính mình. Hãy nhờ một quản trị viên khác thực hiện.");
        }
    }

    private void guardNotLastActiveAdmin(User user) {
        if (!hasRole(user, "ADMIN")) {
            return;
        }
        List<UUID> activeAdmins = userRepository.findActiveAdminUserIds(PageRequest.of(0, 2));
        boolean anotherAdminExists = activeAdmins.stream().anyMatch(id -> !id.equals(user.getId()));
        if (!anotherAdminExists) {
            throw new BusinessException(409,
                "Không thể thu hồi quyền quản trị của quản trị viên cuối cùng còn hoạt động.");
        }
    }

    private boolean hasRole(User user, String code) {
        return user.getRoles().stream().anyMatch(role -> code.equals(role.getCode()));
    }

    private void audit(UserDetails principal, User target, String action) {
        auditService.record(
            principal,
            null,
            ClinicalAccessAuditService.TARGET_USER,
            target.getId().toString(),
            action,
            ClinicalAccessAuditService.DECISION_ALLOW);
    }

    private AdminUserResponse toResponse(
            User user,
            Map<UUID, PatientProfile> patients,
            Map<UUID, Doctor> doctors) {
        PatientProfile patient = patients.get(user.getId());
        Doctor doctor = doctors.get(user.getId());
        List<String> roleCodes = user.getRoles().stream()
            .map(Role::getCode).sorted().toList();
        String displayName = user.getDisplayName();
        String phone = patient != null ? patient.getPhone() : null;
        if (doctor != null && (displayName == null || displayName.isBlank())) {
            displayName = doctor.getFullName();
        }
        return new AdminUserResponse(
            user.getId(),
            user.getEmail(),
            displayName,
            user.getStatus(),
            roleCodes,
            user.isEmailVerified(),
            user.isDemo(),
            phone,
            patient == null ? null : patient.getId(),
            doctor == null ? null : doctor.getId(),
            user.getCreatedAt(),
            user.getUpdatedAt());
    }
}
