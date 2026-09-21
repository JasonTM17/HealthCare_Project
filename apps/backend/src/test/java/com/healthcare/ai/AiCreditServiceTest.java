package com.healthcare.ai;

import com.healthcare.ai.entity.AiCreditTransaction;
import com.healthcare.ai.repository.AiCreditTransactionRepository;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiCreditServiceTest {

    private static final String REFUND_DESCRIPTION =
        "Hoàn credit cho lượt hỏi AI không thành công";

    private PatientProfileRepository patientProfileRepository;
    private UserRepository userRepository;
    private AiCreditTransactionRepository transactionRepository;
    private AiCreditService creditService;

    @BeforeEach
    void setUp() {
        patientProfileRepository = Mockito.mock(PatientProfileRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        transactionRepository = Mockito.mock(AiCreditTransactionRepository.class);

        creditService = new AiCreditService(
                patientProfileRepository,
                userRepository,
                transactionRepository
        );
    }

    @Test
    @DisplayName("Deduct patient credit uses the atomic conditional update and records the DB-accurate balance")
    void deductPatientCreditSuccess() {
        UUID userId = UUID.randomUUID();
        when(patientProfileRepository.deductAiCreditByUserId(userId)).thenReturn(1);
        when(patientProfileRepository.findAiCreditsByUserId(userId)).thenReturn(Optional.of(9));

        boolean deducted = creditService.deductPatientCredit(userId, "Test query");

        assertTrue(deducted);
        ArgumentCaptor<AiCreditTransaction> tx = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository).save(tx.capture());
        assertEquals(-1, tx.getValue().getAmount());
        assertEquals(9, tx.getValue().getBalanceAfter());
        verify(patientProfileRepository, Mockito.never()).save(any(PatientProfile.class));
    }

    @Test
    @DisplayName("Deduct patient credit throws 402 when the conditional update matched no row")
    void deductPatientCreditThrowsWhenZero() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(0);
        when(patientProfileRepository.deductAiCreditByUserId(userId)).thenReturn(0);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        BusinessException ex = assertThrows(BusinessException.class, () ->
            creditService.deductPatientCredit(userId, "Test query")
        );
        assertEquals(402, ex.getStatus());
        assertEquals("INSUFFICIENT_AI_CREDITS", ex.getCode());
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Deduct patient credit without a profile is a no-op, not an error")
    void deductPatientCreditWithoutProfileReturnsFalse() {
        UUID userId = UUID.randomUUID();
        when(patientProfileRepository.deductAiCreditByUserId(userId)).thenReturn(0);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        boolean deducted = creditService.deductPatientCredit(userId, "no profile");

        assertFalse(deducted);
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Deduct patient credit stamps the exchange-attempt marker into the ledger description")
    void deductPatientCreditCarriesAttemptMarker() {
        UUID userId = UUID.randomUUID();
        String marker = "[chat:" + UUID.randomUUID() + "]";
        when(patientProfileRepository.deductAiCreditByUserId(userId)).thenReturn(1);
        when(patientProfileRepository.findAiCreditsByUserId(userId)).thenReturn(Optional.of(9));

        creditService.deductPatientCredit(userId, "Lượt sử dụng Trợ lý AI Y khoa " + marker);

        ArgumentCaptor<AiCreditTransaction> tx = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository).save(tx.capture());
        assertThat(tx.getValue().getTransactionType()).isEqualTo("AI_CHAT_USAGE");
        assertThat(tx.getValue().getDescription()).contains(marker);
    }

    @Test
    @DisplayName("Waiver records a zero-amount AI_CHAT_WAIVED row without changing the balance")
    void recordPatientWaiverWritesZeroAmountRow() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(7);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        boolean waived = creditService.recordPatientWaiver(
            userId, "Không tính credit: câu trả lời thiếu nguồn đủ tin cậy [chat:" + UUID.randomUUID() + "]");

        assertTrue(waived);
        ArgumentCaptor<AiCreditTransaction> tx = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository).save(tx.capture());
        assertEquals("AI_CHAT_WAIVED", tx.getValue().getTransactionType());
        assertEquals(0, tx.getValue().getAmount());
        assertEquals(7, tx.getValue().getBalanceAfter());
        assertEquals("PATIENT", tx.getValue().getTargetRole());
        // The waiver explains a non-charge; it never moves the balance.
        assertEquals(7, profile.getAiCredits());
        verify(patientProfileRepository, Mockito.never()).save(any(PatientProfile.class));
    }

    @Test
    @DisplayName("A zero-credit patient can still be waived: the audit row lands at balance 0")
    void recordPatientWaiverAtZeroBalanceStillAudits() {
        // The free insufficient-evidence answer is exactly the case this row
        // exists for, so the waiver must not depend on a positive balance.
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setUserId(userId);
        profile.setAiCredits(0);
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        assertTrue(creditService.recordPatientWaiver(userId, "Không tính credit [chat:" + UUID.randomUUID() + "]"));

        ArgumentCaptor<AiCreditTransaction> tx = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository).save(tx.capture());
        assertEquals("AI_CHAT_WAIVED", tx.getValue().getTransactionType());
        assertEquals(0, tx.getValue().getAmount());
        assertEquals(0, tx.getValue().getBalanceAfter());
    }

    @Test
    @DisplayName("Waiver without a patient profile is a no-op, not an error")
    void recordPatientWaiverWithoutProfileReturnsFalse() {
        UUID userId = UUID.randomUUID();
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertFalse(creditService.recordPatientWaiver(userId, "waiver"));
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Marked refund is skipped when the attempt was never charged")
    void markedRefundWithoutChargeDoesNothing() {
        UUID userId = UUID.randomUUID();
        String marker = "[chat:" + UUID.randomUUID() + "]";
        when(transactionRepository.existsPatientAiChatUsage(userId, marker)).thenReturn(false);

        boolean refunded = creditService.refundPatientCredit(userId, REFUND_DESCRIPTION, marker);

        assertFalse(refunded);
        verify(transactionRepository, Mockito.never()).existsPatientRefund(any(), any());
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
        verify(patientProfileRepository, Mockito.never()).refundAiCreditByUserId(any());
        verify(patientProfileRepository, Mockito.never()).save(any(PatientProfile.class));
    }

    @Test
    @DisplayName("Marked refund returns the credit atomically and stamps the post-increment balance")
    void markedRefundChargedAttemptRefundsOnce() {
        UUID userId = UUID.randomUUID();
        String marker = "[chat:" + UUID.randomUUID() + "]";
        when(transactionRepository.existsPatientAiChatUsage(userId, marker)).thenReturn(true);
        when(transactionRepository.existsPatientRefund(userId, marker)).thenReturn(false);
        when(patientProfileRepository.refundAiCreditByUserId(userId)).thenReturn(1);
        // The ledger has to carry the balance the row holds AFTER the increment,
        // which is only knowable from the database, not from a pre-read entity.
        when(patientProfileRepository.findAiCreditsByUserId(userId)).thenReturn(Optional.of(4));

        boolean refunded = creditService.refundPatientCredit(userId, REFUND_DESCRIPTION, marker);

        assertTrue(refunded);
        verify(patientProfileRepository).refundAiCreditByUserId(userId);
        ArgumentCaptor<AiCreditTransaction> tx = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository).save(tx.capture());
        assertEquals("AI_CHAT_REFUND", tx.getValue().getTransactionType());
        assertEquals(1, tx.getValue().getAmount());
        assertEquals(4, tx.getValue().getBalanceAfter());
        // The marker travels on the refund row so a repeated sweep finds it.
        assertThat(tx.getValue().getDescription()).contains(marker);
        // No read-modify-write of the profile entity: a spend or refund that
        // races this one on the same profile cannot be overwritten.
        verify(patientProfileRepository, Mockito.never()).save(any(PatientProfile.class));
    }

    @Test
    @DisplayName("A repeated recovery sweep finds the earlier refund and never double-refunds")
    void markedRefundIsIdempotentAcrossSweeps() {
        UUID userId = UUID.randomUUID();
        String marker = "[chat:" + UUID.randomUUID() + "]";
        when(transactionRepository.existsPatientAiChatUsage(userId, marker)).thenReturn(true);
        // First sweep: no refund yet. Second sweep: the refund row exists.
        when(transactionRepository.existsPatientRefund(userId, marker)).thenReturn(false, true);
        when(patientProfileRepository.refundAiCreditByUserId(userId)).thenReturn(1);
        when(patientProfileRepository.findAiCreditsByUserId(userId)).thenReturn(Optional.of(4));

        boolean firstSweep = creditService.refundPatientCredit(userId, REFUND_DESCRIPTION, marker);
        boolean secondSweep = creditService.refundPatientCredit(userId, REFUND_DESCRIPTION, marker);

        assertTrue(firstSweep);
        assertFalse(secondSweep);
        verify(patientProfileRepository, Mockito.times(1)).refundAiCreditByUserId(userId);
        verify(transactionRepository, Mockito.times(1)).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("A charged attempt whose increment matched no profile row writes no ledger row")
    void refundWithoutProfileReturnsFalse() {
        UUID userId = UUID.randomUUID();
        String marker = "[chat:" + UUID.randomUUID() + "]";
        // The attempt really was charged, so the only thing stopping the refund
        // is the missing balance: incrementing nothing and then writing a ledger
        // row would hand out a credit that does not exist.
        when(transactionRepository.existsPatientAiChatUsage(userId, marker)).thenReturn(true);
        when(transactionRepository.existsPatientRefund(userId, marker)).thenReturn(false);
        when(patientProfileRepository.refundAiCreditByUserId(userId)).thenReturn(0);

        assertFalse(creditService.refundPatientCredit(userId, REFUND_DESCRIPTION, marker));
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("Refund patient credit increments balance and records AI_CHAT_REFUND transaction")
    void refundPatientCreditSuccess() {
        UUID userId = UUID.randomUUID();
        when(patientProfileRepository.refundAiCreditByUserId(userId)).thenReturn(1);
        when(patientProfileRepository.findAiCreditsByUserId(userId)).thenReturn(Optional.of(4));

        boolean refunded = creditService.refundPatientCredit(userId, REFUND_DESCRIPTION);

        assertTrue(refunded);
        verify(patientProfileRepository).refundAiCreditByUserId(userId);
        ArgumentCaptor<AiCreditTransaction> tx = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository).save(tx.capture());
        assertEquals(4, tx.getValue().getBalanceAfter());
        // An unmarked (legacy operator) refund carries no attempt marker, so it
        // is deliberately outside the per-attempt guard.
        assertThat(tx.getValue().getDescription()).doesNotContain("[chat:");
    }

    @Test
    @DisplayName("Refund without a patient profile is a no-op, not an error")
    void refundPatientCreditWithoutProfileReturnsFalse() {
        UUID userId = UUID.randomUUID();
        when(patientProfileRepository.refundAiCreditByUserId(userId)).thenReturn(0);

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

    // ---- A4: doctor AI credit is decided out of the product ----

    @Test
    @DisplayName("Admin grant to a DOCTOR is refused with a Vietnamese validation error")
    void grantCreditsForDoctorIsRefused() {
        UUID userId = UUID.randomUUID();

        BusinessException ex = assertThrows(BusinessException.class, () ->
            creditService.grantCredits(userId, "DOCTOR", 100, "ADMIN_GRANT", "Admin cấp phát credit AI")
        );

        assertEquals(400, ex.getStatus());
        assertEquals(ErrorCodes.VALIDATION_ERROR, ex.getCode());
        assertThat(ex.getMessage()).contains("bác sĩ");
        // Nothing is written: no ledger row and no credit inventory change, so
        // the API cannot hand out a quota that no code path can ever spend.
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
        verify(patientProfileRepository, Mockito.never()).save(any(PatientProfile.class));
    }

    @Test
    @DisplayName("A DOCTOR grant is refused whatever the caller's letter casing")
    void grantCreditsForLowercaseDoctorIsRefused() {
        UUID userId = UUID.randomUUID();

        BusinessException ex = assertThrows(BusinessException.class, () ->
            creditService.grantCredits(userId, " doctor ", 100, "ADMIN_GRANT", "Admin cấp phát credit AI")
        );

        assertEquals(400, ex.getStatus());
        assertEquals(ErrorCodes.VALIDATION_ERROR, ex.getCode());
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
    }

    @Test
    @DisplayName("An unrecognized grant target is refused instead of silently doing nothing")
    void grantCreditsForUnknownRoleIsRefused() {
        UUID userId = UUID.randomUUID();

        BusinessException ex = assertThrows(BusinessException.class, () ->
            creditService.grantCredits(userId, "NURSE", 100, "ADMIN_GRANT", "Admin cấp phát credit AI")
        );

        assertEquals(400, ex.getStatus());
        assertEquals(ErrorCodes.VALIDATION_ERROR, ex.getCode());
        verify(transactionRepository, Mockito.never()).save(any(AiCreditTransaction.class));
        verify(patientProfileRepository, Mockito.never()).save(any(PatientProfile.class));
    }

    // ---- A1: the gate the chat service branches on ----

    @Test
    @DisplayName("Zero credits reports no paid balance while a missing profile stays unmetered")
    void hasPatientCreditBalanceMirrorsThe402Gate() {
        UUID broke = UUID.randomUUID();
        PatientProfile zeroProfile = new PatientProfile();
        zeroProfile.setUserId(broke);
        zeroProfile.setAiCredits(0);
        when(patientProfileRepository.findByUserId(broke)).thenReturn(Optional.of(zeroProfile));

        assertFalse(creditService.hasPatientCreditBalance(broke));
        // The predicate and the throwing gate must never disagree, or a patient
        // can be waved through and then rejected mid-exchange.
        BusinessException ex = assertThrows(BusinessException.class,
            () -> creditService.requirePatientCredits(broke));
        assertEquals(402, ex.getStatus());
        assertEquals("INSUFFICIENT_AI_CREDITS", ex.getCode());

        UUID solvent = UUID.randomUUID();
        PatientProfile funded = new PatientProfile();
        funded.setUserId(solvent);
        funded.setAiCredits(1);
        when(patientProfileRepository.findByUserId(solvent)).thenReturn(Optional.of(funded));
        assertTrue(creditService.hasPatientCreditBalance(solvent));
        creditService.requirePatientCredits(solvent);

        UUID unmetered = UUID.randomUUID();
        when(patientProfileRepository.findByUserId(unmetered)).thenReturn(Optional.empty());
        assertTrue(creditService.hasPatientCreditBalance(unmetered));
        creditService.requirePatientCredits(unmetered);
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
    @DisplayName("Patient inventory defaults to a 20-row window ordered by id when params absent")
    void patientInventoryAppliesDefaultBound() {
        when(patientProfileRepository.findAll(any(Pageable.class)))
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
        when(patientProfileRepository.findAll(any(Pageable.class)))
            .thenReturn(Page.empty());

        creditService.listPatients(0, 100_000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(patientProfileRepository).findAll(pageable.capture());
        assertEquals(AiCreditService.ADMIN_LISTING_MAX_SIZE, pageable.getValue().getPageSize());
    }

    @Test
    @DisplayName("Inventory window beyond the data returns an empty page, not an error")
    void inventoryBeyondDataReturnsEmptyPage() {
        when(patientProfileRepository.findAll(any(Pageable.class)))
            .thenReturn(Page.empty());

        Page<AiCreditService.PatientCreditDto> page = creditService.listPatients(50, 500);

        assertTrue(page.getContent().isEmpty());
        assertEquals(0, page.getTotalElements());
    }
}
