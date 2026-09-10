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
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
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
    @DisplayName("Refund patient credit increments balance and records AI_CHAT_REFUND transaction")
    void refundPatientCreditSuccess() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(3);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        boolean refunded = creditService.refundPatientCredit(userId, "Hoàn credit cho lượt hỏi AI không thành công");

        assertTrue(refunded);
        assertEquals(4, profile.getAiCredits());
        verify(patientProfileRepository).save(profile);
        verify(transactionRepository).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Refund without a patient profile is a no-op, not an error")
    void refundPatientCreditWithoutProfileReturnsFalse() {
        UUID userId = UUID.randomUUID();
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        boolean refunded = creditService.refundPatientCredit(userId, "no profile");

        assertFalse(refunded);
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
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

    // ---- HC-11: bounded admin inventories ----

    @Test
    @DisplayName("Patient inventory defaults to a 500-row window ordered by id when params absent")
    void patientInventoryAppliesDefaultBound() {
        when(patientProfileRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
            .thenReturn(Page.empty());

        creditService.listPatients(null, null);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(patientProfileRepository).findAll(pageable.capture());
        assertEquals(0, pageable.getValue().getPageNumber());
        assertEquals(AiCreditService.ADMIN_LISTING_DEFAULT_SIZE, pageable.getValue().getPageSize());
        assertEquals("id", pageable.getValue().getSort().getOrderFor("id").getProperty());
    }

    @Test
    @DisplayName("Oversized inventory requests clamp to the hard maximum")
    void patientInventoryClampsOversizedRequests() {
        when(patientProfileRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
            .thenReturn(Page.empty());

        creditService.listPatients(0, 100_000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(patientProfileRepository).findAll(pageable.capture());
        assertEquals(AiCreditService.ADMIN_LISTING_MAX_SIZE, pageable.getValue().getPageSize());
    }

    @Test
    @DisplayName("Doctor inventory pages are stable: consecutive windows do not overlap or skip")
    void doctorInventoryStableAcrossPages() {
        Doctor first = doctor("doc-1", "Alpha");
        Doctor second = doctor("doc-2", "Beta");
        Doctor third = doctor("doc-3", "Gamma");
        when(doctorRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(first, second)))
            .thenReturn(new PageImpl<>(List.of(third)));

        Page<AiCreditService.DoctorCreditDto> pageZero = creditService.listDoctors(0, 2);
        Page<AiCreditService.DoctorCreditDto> pageOne = creditService.listDoctors(1, 2);

        List<UUID> pageZeroIds = pageZero.getContent().stream().map(AiCreditService.DoctorCreditDto::doctorId).toList();
        List<UUID> pageOneIds = pageOne.getContent().stream().map(AiCreditService.DoctorCreditDto::doctorId).toList();
        assertEquals(List.of(first.getId(), second.getId()), pageZeroIds);
        assertEquals(List.of(third.getId()), pageOneIds);
        assertTrue(Collections.disjoint(new HashSet<>(pageZeroIds), new HashSet<>(pageOneIds)));
    }

    @Test
    @DisplayName("Inventory window beyond the data returns an empty page, not an error")
    void inventoryBeyondDataReturnsEmptyPage() {
        when(patientProfileRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
            .thenReturn(Page.empty());

        Page<AiCreditService.PatientCreditDto> page = creditService.listPatients(50, 500);

        assertTrue(page.getContent().isEmpty());
        assertEquals(0, page.getTotalElements());
    }

    private Doctor doctor(String slug, String fullName) {
        Doctor doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setSlug(slug);
        doctor.setFullName(fullName);
        return doctor;
    }
}
