package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.PatientProfileResponse;
import com.healthcare.appointment.dto.UpdatePatientProfileRequest;
import com.healthcare.appointment.entity.PatientGender;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.exception.ApiError;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.ValidationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PatientProfileService {

    private final PatientProfileRepository patientProfileRepository;
    private final UserRepository userRepository;

    public PatientProfileService(PatientProfileRepository patientProfileRepository, UserRepository userRepository) {
        this.patientProfileRepository = patientProfileRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PatientProfileResponse getProfile(UserDetails principal) {
        return PatientProfileResponse.from(requireProfile(principal));
    }

    @Transactional
    public PatientProfileResponse updateProfile(UpdatePatientProfileRequest request, UserDetails principal) {
        UUID userId = resolveUserId(principal);
        // Lock the user row before writing the profile so this path and the
        // Google bind path (which locks the user first) take locks in the same
        // order and cannot deadlock.
        User account = userRepository.findByIdForUpdate(userId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
        PatientProfile patient = patientProfileRepository.findByUserId(userId)
            .orElseGet(() -> provisionProfile(request, account));
        patient.setFullName(request.fullName().trim());
        patient.setDateOfBirth(request.dateOfBirth());
        patient.setGender(request.gender() == null ? PatientGender.UNSPECIFIED : request.gender());
        patient.setAddress(trimToNull(request.address()));
        patient.setEmergencyContactName(trimToNull(request.emergencyContactName()));
        patient.setEmergencyContactPhone(trimToNull(request.emergencyContactPhone()));
        if (request.avatarUrl() != null) {
            patient.setAvatarUrl(trimToNull(request.avatarUrl()));
        }
        if (request.medicalHistory() != null) {
            patient.setMedicalHistory(trimToNull(request.medicalHistory()));
        }
        if (request.allergies() != null) {
            patient.setAllergies(trimToNull(request.allergies()));
        }
        if (request.bloodType() != null) {
            patient.setBloodType(trimToNull(request.bloodType()));
        }
        patient.setUpdatedAt(OffsetDateTime.now());
        PatientProfile saved = patientProfileRepository.saveAndFlush(patient);
        // The account display name must follow the patient-owned name: the
        // portal header, navbar chip, dashboard greeting and every other
        // session surface read users.display_name, which would otherwise keep
        // showing the stale pre-rename value. Staff/doctor accounts are owned
        // by their professional name instead (AdminDoctorService + V103/V115).
        if (account != null && !isStaff(account)
                && !saved.getFullName().equals(account.getDisplayName())) {
            account.setDisplayName(saved.getFullName());
            account.setUpdatedAt(OffsetDateTime.now());
            userRepository.save(account);
        }
        return PatientProfileResponse.from(saved);
    }

    private boolean isStaff(User user) {
        return user.getRoles().stream().anyMatch(role -> !"PATIENT".equals(role.getCode()));
    }

    /**
     * First-save provisioning: the account exists without a patient profile
     * (Google sign-in or a phone-less registration), so the PUT becomes an
     * idempotent create. The phone rules mirror AuthService.register exactly —
     * a profile already owned by another account or booked under a different
     * email can never be hijacked through this path.
     */
    private PatientProfile provisionProfile(UpdatePatientProfileRequest request, User account) {
        String providedPhone = request.phone();
        String normalizedPhone = providedPhone == null || providedPhone.isBlank()
            ? null
            : BookingService.canonicalContactPhone(providedPhone);
        if (normalizedPhone == null || !BookingService.isValidContactPhone(normalizedPhone)) {
            throw new ValidationException(
                "Nhập số điện thoại hợp lệ để tạo hồ sơ bệnh nhân",
                List.of(new ApiError.FieldError("phone", BookingService.INVALID_CONTACT_PHONE_MESSAGE))
            );
        }
        String accountEmail = account.getEmail() == null
            ? null
            : account.getEmail().trim().toLowerCase();
        PatientProfile reusable = patientProfileRepository.findByPhone(normalizedPhone).orElse(null);
        if (reusable != null && reusable.getUserId() != null) {
            throw new DuplicateResourceException(
                ErrorCodes.PHONE_OWNED_BY_ACCOUNT,
                "Số điện thoại này đã liên kết một tài khoản khác — hãy đăng nhập hoặc dùng SĐT khác"
            );
        }
        if (reusable != null && (reusable.getEmail() == null || accountEmail == null
                || !accountEmail.equals(reusable.getEmail().trim().toLowerCase()))) {
            throw new DuplicateResourceException(
                ErrorCodes.PHONE_LINKED_TO_BOOKING_EMAIL,
                "Số điện thoại này đã dùng đặt lịch với một email khác — hãy dùng SĐT khác"
            );
        }
        PatientProfile profile = reusable == null ? new PatientProfile() : reusable;
        profile.setPhone(normalizedPhone);
        profile.setEmail(accountEmail);
        profile.setUserId(account.getId());
        return profile;
    }

    private PatientProfile requireProfile(UserDetails principal) {
        return patientProfileRepository.findByUserId(resolveUserId(principal))
            .orElseThrow(() -> new AccessDeniedException("No patient profile is linked to this account"));
    }

    private UUID resolveUserId(UserDetails principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication required");
        }
        return principal instanceof HealthcareUserPrincipal healthcarePrincipal
            ? healthcarePrincipal.getUserId()
            : userRepository.findByEmail(principal.getUsername()).map(User::getId)
                .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
