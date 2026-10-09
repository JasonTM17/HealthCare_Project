package com.healthcare.user.service;

import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.auth.AuthOtpService;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.exception.*;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.user.dto.*;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AdminAccountService {
    private static final Set<String> ROLE_CODES = Set.of("PATIENT", "DOCTOR", "ADMIN");
    private static final Set<String> SORT_FIELDS = Set.of("createdAt", "updatedAt", "displayName", "email", "status");
    private final UserRepository users;
    private final RoleRepository roles;
    private final AccountGovernance governance;
    private final AccountDoctorLinker linker;
    private final DoctorRepository doctors;
    private final PatientProfileRepository patients;
    private final PasswordEncoder passwords;
    private final AuthOtpService otp;
    private final NotificationPreferenceService preferences;
    private final AuthRateLimiter rateLimiter;

    public AdminAccountService(UserRepository users, RoleRepository roles, AccountGovernance governance,
        AccountDoctorLinker linker, DoctorRepository doctors, PatientProfileRepository patients,
        PasswordEncoder passwords, AuthOtpService otp, NotificationPreferenceService preferences, AuthRateLimiter rateLimiter) {
        this.users = users; this.roles = roles; this.governance = governance; this.linker = linker;
        this.doctors = doctors; this.patients = patients; this.passwords = passwords; this.otp = otp;
        this.preferences = preferences;
        this.rateLimiter = rateLimiter;
    }

    @Transactional(readOnly = true)
    public Page<AdminAccountResponse> list(String query, String role, String status, Boolean verified,
        Boolean demo, OffsetDateTime createdFrom, OffsetDateTime createdTo, int page, int size, String sort, String direction) {
        if (page < 0 || page > 10000 || size < 1 || size > 100 || !SORT_FIELDS.contains(sort)
            || !("asc".equals(direction) || "desc".equals(direction))) throw new BadRequestException("Invalid account pagination or sort");
        if (query == null || query.length() > 160) throw new BadRequestException("Search must not exceed 160 characters");
        if (!role.isEmpty() && !ROLE_CODES.contains(role)) throw new BadRequestException("Invalid role filter");
        if (!status.isEmpty() && !Set.of("ACTIVE", "DISABLED").contains(status)) throw new BadRequestException("Invalid status filter");
        if (createdFrom != null && createdTo != null && createdFrom.isAfter(createdTo)) throw new BadRequestException("Invalid creation date range");
        String needle = "%" + query.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Specification<User> filter = (root, criteria, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (!query.isBlank()) predicates.add(cb.or(cb.like(cb.lower(root.get("email")), needle, '\\'), cb.like(cb.lower(root.get("displayName")), needle, '\\')));
            if (!role.isEmpty()) { criteria.distinct(true); predicates.add(cb.equal(root.join("roles").get("code"), role)); }
            if (!status.isEmpty()) predicates.add(cb.equal(root.get("status"), status));
            if (verified != null) predicates.add(cb.equal(root.get("emailVerified"), verified));
            if (demo != null) predicates.add(cb.equal(root.get("demo"), demo));
            if (createdFrom != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), createdFrom));
            if (createdTo != null) predicates.add(cb.lessThan(root.get("createdAt"), createdTo));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Sort ordered = Sort.by(Sort.Direction.fromString(direction), sort).and(Sort.by("id"));
        Page<User> result = users.findAll(filter, PageRequest.of(page, size, ordered));
        List<UUID> ids = result.getContent().stream().map(User::getId).toList();
        if (ids.isEmpty()) return result.map(this::response);
        Map<UUID, AdminAccountResponse.DoctorProfile> doctorProfiles = doctors.findByUserIdIn(ids).stream()
            .collect(java.util.stream.Collectors.toMap(d -> d.getUserId(), d -> new AdminAccountResponse.DoctorProfile(d.getId(), d.getSlug(), d.getFullName(), d.isActive())));
        Map<UUID, UUID> patientProfiles = patients.findByUserIdIn(ids).stream()
            .collect(java.util.stream.Collectors.toMap(p -> p.getUserId(), p -> p.getId()));
        return result.map(user -> response(user, doctorProfiles.get(user.getId()), patientProfiles.get(user.getId())));
    }

    @Transactional(readOnly = true)
    public AdminAccountResponse get(UUID id) { return response(find(id)); }

    @Transactional
    public AdminAccountActionResponse create(AdminAccountCreateRequest request, HttpServletRequest http) {
        rateLimiter.check(http, normalizeEmail(request.email()), "verification-issue");
        governance.acquire();
        governance.lockUsersAndAuthorize(List.of());
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) throw new DuplicateResourceException("Email already belongs to an account");
        User user = new User();
        user.setEmail(email); user.setDisplayName(normalizeName(request.displayName()));
        user.setPasswordHash(passwords.encode(request.password()));
        user.setStatus("ACTIVE"); user.setEmailVerified(false); user.setEmailVerifiedAt(null); user.setDemo(false);
        user.setCreatedAt(now()); user.setUpdatedAt(user.getCreatedAt()); user.setRoles(resolveRoles(request.roles()));
        users.saveAndFlush(user);
        preferences.ensureDefaultsForUser(user.getId());
        linker.apply(user, request.roles(), request.doctorProfileId(), false, user.getDisplayName(), true);
        otp.issueAdminVerificationLocked(user);
        return new AdminAccountActionResponse(response(user), "CREATED", "REQUESTED_UNCONFIRMED");
    }

    @Transactional
    public AdminAccountResponse update(UUID id, AdminAccountUpdateRequest request, HttpServletRequest http) {
        String requestedEmail = normalizeEmail(request.email());
        String currentEmail = emailProjection(id);
        if (!currentEmail.equals(requestedEmail) && "ACTIVE".equals(request.status())) {
            rateLimiter.check(http, requestedEmail, "verification-issue");
        }
        User target = lock(id);
        checkExpected(target, request.expectedVersion(), request.expectedUpdatedAt());
        Set<String> beforeRoles = roleCodes(target);
        String email = requestedEmail;
        boolean emailChanged = !email.equals(target.getEmail());
        boolean rolesChanged = !beforeRoles.equals(request.roles());
        boolean statusChanged = !target.getStatus().equals(request.status());
        boolean remainsEligible = "ACTIVE".equals(request.status()) && target.isEmailVerified()
            && !emailChanged && request.roles().contains("ADMIN");
        if (id.equals(governance.identity().getUserId()) && !remainsEligible) {
            throw new ConflictException("You cannot disable, demote or change the verified identity of your own administrator account");
        }
        if (AccountGovernance.eligibleAdministrator(target) && !remainsEligible && users.countEligibleAdministrators() <= 1) {
            throw new ConflictException("The final active verified administrator must remain available");
        }
        if (emailChanged && users.existsByEmail(email)) throw new DuplicateResourceException("Email already belongs to an account");
        Set<Role> nextRoles = resolveRoles(request.roles());
        String name = normalizeName(request.displayName());
        boolean profileChanged = linker.apply(target, request.roles(), request.doctorProfileId(), request.unlinkDoctorProfile(),
            name, !beforeRoles.contains("DOCTOR"));
        target.setDisplayName(name);
        target.setStatus(request.status()); target.setRoles(nextRoles);
        if (emailChanged) {
            target.setEmail(email); target.setGoogleSubject(null);
            target.setEmailVerified(false); target.setEmailVerifiedAt(null);
        }
        if (emailChanged || rolesChanged || statusChanged || profileChanged) {
            governance.invalidateCredentials(target, "ADMIN_ACCOUNT_CHANGED");
        }
        target.setUpdatedAt(now());
        users.saveAndFlush(target);
        if (emailChanged && "ACTIVE".equals(target.getStatus())) otp.issueAdminVerificationLocked(target);
        return response(target);
    }

    @Transactional
    public AdminAccountActionResponse action(UUID id, String action, AdminAccountActionRequest expected, HttpServletRequest http) {
        if ("verification".equals(action) || "password-reset".equals(action)) {
            rateLimiter.check(http, emailProjection(id), "verification".equals(action) ? "verification-issue" : "password-reset-request");
        }
        User target = lock(id);
        checkExpected(target, expected.expectedVersion(), expected.expectedUpdatedAt());
        String delivery = "NOT_APPLICABLE";
        switch (action) {
            case "revoke-sessions" -> {
                governance.invalidateCredentials(target, "ADMIN_SESSION_REVOKE");
                target.setUpdatedAt(now()); users.saveAndFlush(target);
            }
            case "verification" -> {
                if (target.isEmailVerified() || !"ACTIVE".equals(target.getStatus())) throw new ConflictException("Verification requires an active unverified account");
                otp.issueAdminVerificationLocked(target); delivery = "REQUESTED_UNCONFIRMED";
            }
            case "password-reset" -> {
                if (!target.isEmailVerified() || !"ACTIVE".equals(target.getStatus())) throw new ConflictException("Password reset requires an active verified account");
                otp.issueAdminPasswordResetLocked(target); delivery = "REQUESTED_UNCONFIRMED";
            }
            default -> throw new BadRequestException("Unknown account action");
        }
        return new AdminAccountActionResponse(response(target), action, delivery);
    }

    private User lock(UUID id) {
        governance.acquire();
        User target = governance.lockUsersAndAuthorize(List.of(id)).get(id);
        AccountGovernance.requireMutable(target);
        return target;
    }
    private User find(UUID id) { return users.findById(id).orElseThrow(() -> new ResourceNotFoundException("Account not found")); }
    // Scalar preflight projection never attaches a stale entity before the stable row lock.
    private String emailProjection(UUID id) { return users.findEmailById(id).orElseThrow(() -> new ResourceNotFoundException("Account not found")); }
    private Set<Role> resolveRoles(Set<String> values) {
        if (values == null || values.isEmpty() || values.stream().anyMatch(value -> value == null || !ROLE_CODES.contains(value))) {
            throw new BadRequestException("Select valid account roles");
        }
        Set<Role> result = new HashSet<>();
        for (String code : values) result.add(roles.findByCode(code).orElseThrow(() -> new BadRequestException("Role is not configured")));
        return result;
    }
    private static Set<String> roleCodes(User user) { return user.getRoles().stream().map(Role::getCode).collect(java.util.stream.Collectors.toSet()); }
    private static String normalizeEmail(String value) { return value.strip().toLowerCase(Locale.ROOT); }
    private static String normalizeName(String value) {
        String name = value.strip();
        if (name.length() < 2 || name.length() > 160 || name.codePoints().anyMatch(Character::isISOControl)) {
            throw new BadRequestException("Display name must contain 2–160 characters without control characters");
        }
        return name;
    }
    private static OffsetDateTime now() { return OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS); }
    private static void checkExpected(User user, Long version, OffsetDateTime updatedAt) {
        if (version == null || updatedAt == null || version != user.getSecurityVersion()
            || !updatedAt.toInstant().equals(user.getUpdatedAt().toInstant())) throw new ConflictException("Account changed; reload its latest details before saving");
    }
    private AdminAccountResponse response(User user) {
        var doctor = doctors.findByUserId(user.getId()).map(d -> new AdminAccountResponse.DoctorProfile(d.getId(), d.getSlug(), d.getFullName(), d.isActive())).orElse(null);
        UUID patientId = patients.findByUserId(user.getId()).map(p -> p.getId()).orElse(null);
        return response(user, doctor, patientId);
    }
    private AdminAccountResponse response(User user, AdminAccountResponse.DoctorProfile doctor, UUID patientId) {
        return new AdminAccountResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getStatus(),
            roleCodes(user).stream().sorted().toList(), user.isEmailVerified(), user.getEmailVerifiedAt(), user.isDemo(),
            user.getCreatedAt(), user.getUpdatedAt(), user.getSecurityVersion(), doctor, patientId, user.getGoogleSubject() != null);
    }
}
