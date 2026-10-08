package com.healthcare.ai;

import com.healthcare.ai.controller.PatientAiCreditController;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * W4 regression: the status badge ceiling is {@code max(tierMax, credits)} —
 * the weekly refill tops a patient up to the tier ceiling, so an old admin
 * grant visible only in the ledger history (historyMax) must not pin the
 * badge at "/500" forever once that credit has been spent. The actual current
 * balance still wins over the tier ceiling when it is higher.
 */
class PatientAiCreditControllerTest {

    private final UUID userId = UUID.randomUUID();

    private Map<String, Object> callStatus(String tier, int credits, int historyMax) {
        AiCreditService aiCreditService = mock(AiCreditService.class);
        when(aiCreditService.getPatientCredits(userId)).thenReturn(credits);
        when(aiCreditService.getPatientTier(userId)).thenReturn(tier);
        when(aiCreditService.listTransactions(userId)).thenReturn(List.of());
        when(aiCreditService.countTransactions(userId)).thenReturn(0L);
        // Whole-ledger max balance ever seen (e.g. an old admin grant of 500).
        when(aiCreditService.getMaxTransactionBalance(userId)).thenReturn(historyMax);
        // Promo-aware ceiling: with no promotion configured this is the same
        // tier map the refill uses.
        when(aiCreditService.effectiveTierMaxCredits(org.mockito.ArgumentMatchers.any()))
            .thenAnswer(inv -> AiCreditService.tierMaxCredits(inv.getArgument(0)));

        User user = new User();
        user.setId(userId);
        user.setEmail("patient@example.com");
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByEmail("patient@example.com")).thenReturn(Optional.of(user));

        UserDetails principal = mock(UserDetails.class);
        when(principal.getUsername()).thenReturn("patient@example.com");

        return new PatientAiCreditController(aiCreditService, userRepository).getStatus(principal).getBody();
    }

    @Test
    void badgeCeilingIgnoresStaleLedgerHistoryMax() {
        // STANDARD refills to 20; a past admin grant of 500 lives only in the
        // ledger. Old formula max(tierMax, historyMax, credits) showed "/500".
        Map<String, Object> body = callStatus("STANDARD", 20, 500);

        assertThat(body).containsEntry("maxCredits", 20);
    }

    @Test
    void actualBalanceAboveTierCeilingStillSizesBadge() {
        // GOLD ceiling is 100 but the patient still holds 150 credits from an
        // unspent grant — the badge must respect the real balance.
        Map<String, Object> body = callStatus("GOLD", 150, 150);

        assertThat(body).containsEntry("maxCredits", 150);
    }

    @Test
    void badgeShowsTierCeilingWhenBalanceIsBelowIt() {
        Map<String, Object> body = callStatus("SILVER", 7, 40);

        assertThat(body).containsEntry("maxCredits", 50);
    }
}
