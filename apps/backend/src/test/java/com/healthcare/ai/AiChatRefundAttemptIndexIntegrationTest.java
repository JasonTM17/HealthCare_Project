package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * The database half of the AI-chat refund idempotency guarantee.
 *
 * <p>{@code AiCreditServiceTest} and
 * {@code AiConversationIntegrationTest#refundingTheSameAttemptMarkerTwiceCompensatesExactlyOneCredit}
 * already prove the {@code AiCreditService} guard: a second refund for the same
 * {@code [chat:<requestMessageId>]} marker is refused. That is caller
 * discipline, and the service's own Javadoc says so — the guard is a
 * check-then-insert whose correct scope is the {@code FOR UPDATE} lock on the
 * owning conversation row. {@code V97__unique_ai_chat_refund_per_attempt.sql}
 * exists precisely because that lock does not cover every caller.
 *
 * <p>Nothing here asserted that backstop yet, so these tests write the ledger
 * rows directly through SQL — deliberately bypassing the service guard — and
 * pin both halves of the index: it rejects the duplicate, and it does not
 * reject anything the migration's predicate promises to leave free (grants,
 * tier changes, waivers, unmarked legacy refunds, non-patient target roles).
 */
class AiChatRefundAttemptIndexIntegrationTest extends AbstractIntegrationTest {

    private static final String REFUND_DESCRIPTION =
        "Hoàn credit cho lượt hỏi AI không thành công";

    @Autowired
    private AiCreditService aiCreditService;

    @Test
    void v97PartialUniqueIndexIsPresentInTheMigratedSchema() {
        Long indexes = jdbcTemplate.queryForObject(
            "select count(*) from pg_indexes where schemaname = 'public'"
                + " and indexname = 'ux_ai_credit_refund_patient_chat_attempt'",
            Long.class);

        assertThat(indexes).isEqualTo(1L);
    }

    @Test
    void databaseRejectsASecondMarkedPatientRefundEvenWhenTheServiceGuardIsBypassed() {
        User patient = createUser("patient.refund-index@example.com");
        createPatientProfile(patient, "0901900001", 2);
        String marker = "[chat:" + UUID.randomUUID() + "]";
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_USAGE", -1, 2,
            "Luot su dung Tro ly AI Y khoa " + marker);

        // One refund through the normal path: 2 -> 3, ledger stamped with the
        // post-increment balance.
        assertThat(aiCreditService.refundPatientCredit(patient.getId(), REFUND_DESCRIPTION, marker))
            .isTrue();
        assertThat(balanceOf(patient)).isEqualTo(3);

        // Now bypass the guard completely: a caller that does not hold the
        // conversation lock (or a future one that forgets the two ledger checks)
        // writes the second refund row straight to the table. The database, not
        // the service, has to be the one that says no.
        Throwable rejected = catchThrowable(() -> insertLedgerRow(patient.getId(), "PATIENT",
            "AI_CHAT_REFUND", 1, 4, REFUND_DESCRIPTION + " " + marker));
        assertThat(rejected).isInstanceOf(DataIntegrityViolationException.class);
        // It has to be this index that rejected the row — not the V55 CHECK on
        // target_role, the user foreign key, or a balance constraint.
        assertThat(rejected.getMessage() + " " + rejected.getCause())
            .contains("ux_ai_credit_refund_patient_chat_attempt");

        assertThat(ledgerCount(patient.getId(), "PATIENT", "AI_CHAT_REFUND")).isEqualTo(1L);
        assertThat(balanceOf(patient)).isEqualTo(3);
    }

    @Test
    void indexStaysScopedToMarkedPatientChatRefunds() {
        User patient = createUser("patient.refund-index-scope@example.com");
        String firstMarker = "[chat:" + UUID.randomUUID() + "]";
        String secondMarker = "[chat:" + UUID.randomUUID() + "]";

        // Distinct attempts of the same patient are independent refunds.
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_REFUND", 1, 3,
            REFUND_DESCRIPTION + " " + firstMarker);
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_REFUND", 1, 4,
            REFUND_DESCRIPTION + " " + secondMarker);

        // Unmarked refunds (legacy operator compensation) fall outside the
        // predicate, so history written before markers cannot block an index
        // build or a later insert.
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_REFUND", 1, 5,
            "Hoàn credit thủ công của quản trị viên");
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_REFUND", 1, 6,
            "Hoàn credit thủ công lần hai của quản trị viên");

        // The charge and the waiver that share a marker with a refund are not
        // part of the unique key either.
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_USAGE", -1, 5,
            "Luot su dung Tro ly AI Y khoa " + firstMarker);
        insertLedgerRow(patient.getId(), "PATIENT", "AI_CHAT_WAIVED", 0, 5,
            "Không tính credit " + firstMarker);

        // The predicate is patient-scoped, so a DOCTOR-targeted row with the
        // same marker does not collide with the patient refund above it.
        insertLedgerRow(patient.getId(), "DOCTOR", "AI_CHAT_REFUND", 1, 150,
            REFUND_DESCRIPTION + " " + firstMarker);

        assertThat(ledgerCount(patient.getId(), "PATIENT", "AI_CHAT_REFUND")).isEqualTo(4L);
        assertThat(ledgerCount(patient.getId(), "DOCTOR", "AI_CHAT_REFUND")).isEqualTo(1L);
        assertThat(ledgerCount(patient.getId(), "PATIENT", "AI_CHAT_USAGE")).isEqualTo(1L);
        assertThat(ledgerCount(patient.getId(), "PATIENT", "AI_CHAT_WAIVED")).isEqualTo(1L);
    }

    private void insertLedgerRow(UUID userId, String targetRole, String transactionType,
            int amount, int balanceAfter, String description) {
        jdbcTemplate.update(
            "insert into ai_credit_transactions"
                + " (user_id, target_role, amount, balance_after, transaction_type, description)"
                + " values (?, ?, ?, ?, ?, ?)",
            userId, targetRole, amount, balanceAfter, transactionType, description);
    }

    private int balanceOf(User user) {
        return patientProfileRepository.findByUserId(user.getId())
            .orElseThrow()
            .getAiCredits();
    }

    private long ledgerCount(UUID userId, String targetRole, String transactionType) {
        Long count = jdbcTemplate.queryForObject(
            "select count(*) from ai_credit_transactions"
                + " where user_id = ? and target_role = ? and transaction_type = ?",
            Long.class,
            userId,
            targetRole,
            transactionType
        );
        return count == null ? 0L : count;
    }

    private User createUser(String email) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("test-password-hash");
        user.setDisplayName("Ledger Index Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private PatientProfile createPatientProfile(User user, String phone, int credits) {
        PatientProfile profile = new PatientProfile();
        profile.setUserId(user.getId());
        profile.setFullName("Ledger Index Patient");
        profile.setEmail(user.getEmail());
        profile.setPhone(phone);
        profile.setAiCredits(credits);
        profile.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return patientProfileRepository.save(profile);
    }
}
