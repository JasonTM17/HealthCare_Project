package com.healthcare.ai;

import com.healthcare.ai.entity.AiCreditTransaction;
import com.healthcare.ai.repository.AiCreditTransactionRepository;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiCreditServiceTest {

    private PatientProfileRepository patientProfileRepository;
    private DoctorRepository doctorRepository;
    private UserRepository userRepository;
    private AiCreditTransactionRepository transactionRepository;
    private AiCreditService creditService;

    @BeforeEach
    void setUp() {
        patientProfileRepository = Mockito.mock(PatientProfileRepository.class);
        doctorRepository = Mockito.mock(DoctorRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        transactionRepository = Mockito.mock(AiCreditTransactionRepository.class);

        creditService = new AiCreditService(
                patientProfileRepository,
                doctorRepository,
                userRepository,
                transactionRepository
        );
    }

    @Test
    @DisplayName("Deduct patient credit decrements balance and records transaction")
    void deductPatientCreditSuccess() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(10);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        boolean deducted = creditService.deductPatientCredit(userId, "Test query");

        assertTrue(deducted);
        assertEquals(9, profile.getAiCredits());
        verify(patientProfileRepository).save(profile);
        verify(transactionRepository).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Deduct patient credit throws 402 when balance is zero")
    void deductPatientCreditThrowsWhenZero() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(0);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        BusinessException ex = assertThrows(BusinessException.class, () ->
            creditService.deductPatientCredit(userId, "Test query")
        );
        assertEquals(402, ex.getStatus());
        assertEquals("INSUFFICIENT_AI_CREDITS", ex.getCode());
    }

    @Test
    @DisplayName("Admin grant credits increments balance and logs ADMIN_GRANT transaction")
    void adminGrantCreditsSuccess() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(15);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        creditService.grantCredits(userId, "PATIENT", 50, "ADMIN_GRANT", "Bonus for loyalty");

        assertEquals(65, profile.getAiCredits());
        verify(patientProfileRepository).save(profile);
        verify(transactionRepository).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Updating patient tier to VIP updates tier and resets default credits to 300")
    void updatePatientTierVip() {
        UUID profileId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setId(profileId);
        profile.setUserId(userId);
        profile.setPatientTier("STANDARD");
        profile.setAiCredits(5);
        when(patientProfileRepository.findById(profileId)).thenReturn(Optional.of(profile));

        creditService.updatePatientTier(profileId, "VIP", null);

        assertEquals("VIP", profile.getPatientTier());
        assertEquals(300, profile.getAiCredits());
        verify(patientProfileRepository).save(profile);
        verify(transactionRepository).save(any(AiCreditTransaction.class));
    }
}
