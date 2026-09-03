package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.PatientProfileResponse;
import com.healthcare.appointment.dto.UpdatePatientProfileRequest;
import com.healthcare.appointment.entity.PatientGender;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
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
        PatientProfile patient = requireProfile(principal);
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
        return PatientProfileResponse.from(patientProfileRepository.saveAndFlush(patient));
    }

    private PatientProfile requireProfile(UserDetails principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication required");
        }
        UUID userId = principal instanceof HealthcareUserPrincipal healthcarePrincipal
            ? healthcarePrincipal.getUserId()
            : userRepository.findByEmail(principal.getUsername()).map(User::getId)
                .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
        return patientProfileRepository.findByUserId(userId)
            .orElseThrow(() -> new AccessDeniedException("No patient profile is linked to this account"));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
