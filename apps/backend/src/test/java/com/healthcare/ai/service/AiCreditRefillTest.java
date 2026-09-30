package com.healthcare.ai.service;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * Weekly AI credit refill ("mỗi 7 ngày hồi đầy credit theo max tier").
 *
 * <p>Pins the three layers the grant rests on:
 * <ol>
 *   <li>the conditional atomic update in
 *       {@link com.healthcare.appointment.repository.PatientProfileRepository#refillAiCreditsByUserId}
 *       — refill-to-tier-max once per ISO week, idempotent against a repeated
 *       call, and race-free against {@code deductAiCreditByUserId} (no lost
 *       update in either interleaving);</li>
 *   <li>the ledger row the winner writes (amount = tierMax − balanceBefore,
 *       balance_after read back from the row after the update);</li>
 *   <li>the V108 partial unique index
 *       {@code ux_ai_credit_refill_patient_week} as the database backstop: a
 *       second refill row for the same patient and period is rejected even
 *       when the service guard is bypassed by writing the table directly.</li>
 * </ol>
 */
class AiCreditRefillTest extends AbstractIntegrationTest {

    @Autowired
    private AiCreditService aiCreditService;

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("V108 columns and the refill partial unique index exist in the migrated schema")
    void v108SchemaIsMigrated() {
        Long indexCount = jdbcTemplate.queryForObject(
            "select count(*) from pg_indexes where schemaname = 'public'"
                + " and indexname = 'ux_ai_credit_refill_patient_week'",
            Long.class);
        assertThat(indexCount).isEqualTo(1L);

        Long profileColumn = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.columns"
                + " where table_name = 'patient_profiles'"
                + " and column_name = 'last_credit_refill_period'",
            Long.class);
        Long ledgerColumn = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.columns"
                + " where table_name = 'ai_credit_transactions'"
                + " and column_name = 'refill_period'",
            Long.class);
        assertThat(profileColumn).isEqualTo(1L);
        assertThat(ledgerColumn).isEqualTo(1L);
    }

    @Test
    @DisplayName("Refill resets the balance to the tier maximum and stamps the ISO week")
    void refillSetsTierMaxAndStampsPeriod() {
        User patient = createUser("patient.refill-gold@example.com");
        createPatientProfile(patient, "0901910001", "GOLD", 3);

        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isTrue();

        String period = AiCreditService.currentRefillPeriod();
        assertThat(balanceOf(patient)).isEqualTo(AiCreditService.tierMaxCredits("GOLD"));
        assertThat(lastRefillPeriodOf(patient)).isEqualTo(period);

        // Ledger row: the true delta, and the balance the row actually holds.
        var ledger = ledgerRows(patient.getId(), "AI_CHAT_REFILL");
        assertThat(ledger).hasSize(1);
        assertThat(ledger.get(0).get("amount")).isEqualTo(100 - 3);
        assertThat(ledger.get(0).get("balance_after")).isEqualTo(100);
        assertThat(ledger.get(0).get("refill_period")).isEqualTo(period);
    }

    @Test
    @DisplayName("A second refill in the same ISO week is a no-op with exactly one ledger row")
    void refillIsIdempotentWithinTheSamePeriod() {
        User patient = createUser("patient.refill-twice@example.com");
        createPatientProfile(patient, "0901910002", "STANDARD", 20);

        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isTrue();
        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isFalse();
        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isFalse();

        assertThat(balanceOf(patient)).isEqualTo(20);
        assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).hasSize(1);
    }

    @Test
    @DisplayName("A stale period stamp lets the next refill run again")
    void refillRunsAgainInANewPeriod() {
        User patient = createUser("patient.refill-newweek@example.com");
        createPatientProfile(patient, "0901910003", "SILVER", 1);
        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isTrue();
        assertThat(balanceOf(patient)).isEqualTo(50);

        // Spend, then simulate the week rolling over. The simulation has to
        // move the WHOLE first grant into a past week — profile stamp AND its
        // ledger row — because the refill_period stamp on the ledger row is
        // the week the grant happened in. Rewinding only the profile stamp is
        // an inconsistent history, and the ux_ai_credit_refill_patient_week
        // index would (correctly) reject the second current-period ledger row.
        assertThat(aiCreditService.deductPatientCredit(patient.getId(), "Lượt sử dụng Trợ lý AI Y khoa")).isTrue();
        assertThat(balanceOf(patient)).isEqualTo(49);
        jdbcTemplate.update(
            "update patient_profiles set last_credit_refill_period = '2020-W01' where user_id = ?",
            patient.getId());
        jdbcTemplate.update(
            "update ai_credit_transactions set refill_period = '2020-W01'"
                + " where user_id = ? and transaction_type = 'AI_CHAT_REFILL'",
            patient.getId());

        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isTrue();

        assertThat(balanceOf(patient)).isEqualTo(50);
        var ledger = ledgerRows(patient.getId(), "AI_CHAT_REFILL");
        assertThat(ledger).hasSize(2);
        assertThat(ledger.get(0).get("refill_period")).isEqualTo("2020-W01");
        assertThat(ledger.get(0).get("balance_after")).isEqualTo(50);
        assertThat(ledger.get(1).get("refill_period")).isEqualTo(AiCreditService.currentRefillPeriod());
        assertThat(ledger.get(1).get("balance_after")).isEqualTo(50);
    }

    @Test
    @DisplayName("Refill and deduct interleave without a lost update in either order")
    void refillAndDeductDoNotLoseUpdates() {
        // refill first, then deduct: balance ends at tierMax − 1 and both
        // ledger balance_after values chain correctly.
        User refillFirst = createUser("patient.refill-race-a@example.com");
        createPatientProfile(refillFirst, "0901910004", "STANDARD", 3);
        assertThat(aiCreditService.refillPatientCreditsWeekly(refillFirst.getId())).isTrue();
        assertThat(aiCreditService.deductPatientCredit(refillFirst.getId(), "Lượt sử dụng Trợ lý AI Y khoa")).isTrue();

        assertThat(balanceOf(refillFirst)).isEqualTo(19);
        var ledgerA = ledgerRows(refillFirst.getId(), "AI_CHAT_REFILL");
        assertThat(ledgerA).hasSize(1);
        assertThat(ledgerA.get(0).get("balance_after")).isEqualTo(20);
        assertThat(ledgerA.get(0).get("amount")).isEqualTo(17);
        var usageA = ledgerRows(refillFirst.getId(), "AI_CHAT_USAGE");
        assertThat(usageA).hasSize(1);
        assertThat(usageA.get(0).get("amount")).isEqualTo(-1);
        assertThat(usageA.get(0).get("balance_after")).isEqualTo(19);

        // deduct to zero first, then refill: the gate would have refused the
        // patient, the refill grants, the spent credit stays spent.
        User deductFirst = createUser("patient.refill-race-b@example.com");
        createPatientProfile(deductFirst, "0901910005", "STANDARD", 1);
        assertThat(aiCreditService.deductPatientCredit(deductFirst.getId(), "Lượt sử dụng Trợ lý AI Y khoa")).isTrue();
        assertThat(balanceOf(deductFirst)).isEqualTo(0);
        assertThat(aiCreditService.refillPatientCreditsWeekly(deductFirst.getId())).isTrue();
        assertThat(balanceOf(deductFirst)).isEqualTo(20);
        var ledgerB = ledgerRows(deductFirst.getId(), "AI_CHAT_REFILL");
        assertThat(ledgerB).hasSize(1);
        assertThat(ledgerB.get(0).get("amount")).isEqualTo(20);
        assertThat(ledgerB.get(0).get("balance_after")).isEqualTo(20);

        // The fresh grant is spendable: the paid path still works right after
        // a refill (a 402 here would mean the gate raced the grant).
        assertThat(aiCreditService.deductPatientCredit(deductFirst.getId(), "Lượt sử dụng Trợ lý AI Y khoa")).isTrue();
        assertThat(balanceOf(deductFirst)).isEqualTo(19);
    }

    @Test
    @DisplayName("Database rejects a second AI_CHAT_REFILL row for the same patient and period")
    void uniqueIndexBackstopsASecondRefillRowInTheSamePeriod() {
        User patient = createUser("patient.refill-index@example.com");
        String period = AiCreditService.currentRefillPeriod();
        insertLedgerRow(patient.getId(), "AI_CHAT_REFILL", 100, 20, period);

        Throwable rejected = catchThrowable(() ->
            insertLedgerRow(patient.getId(), "AI_CHAT_REFILL", 100, 20, period));
        assertThat(rejected).isInstanceOf(DataIntegrityViolationException.class);
        // It has to be this index that rejected the row — not the V55
        // target_role CHECK, the user FK, or the refund-attempt index.
        assertThat(rejected.getMessage() + " " + rejected.getCause())
            .contains("ux_ai_credit_refill_patient_week");

        assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).hasSize(1);

        // A different patient refills the same period freely, and a row whose
        // type falls outside the predicate can reuse the stamp: the index is
        // scoped to exactly (patient, week) refill rows.
        User other = createUser("patient.refill-index-other@example.com");
        insertLedgerRow(other.getId(), "AI_CHAT_REFILL", 50, 50, period);
        insertLedgerRow(patient.getId(), "TIER_UPGRADE", 20, 20, period);
        assertThat(ledgerRows(other.getId(), "AI_CHAT_REFILL")).hasSize(1);
        assertThat(ledgerRows(patient.getId(), "TIER_UPGRADE")).hasSize(1);
    }

    @Test
    @DisplayName("Refill without a patient profile is a silent no-op, not an error")
    void refillWithoutProfileReturnsFalse() {
        User patient = createUser("patient.refill-noprofile@example.com");

        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isFalse();
        assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).isEmpty();
    }

    @Test
    @DisplayName("Inconsistent history (current-period ledger row, stale profile stamp) is a safe no-op")
    void refillAgainstInconsistentHistoryNeverThrows() {
        // W1 (falsification): the ledger already carries this week's grant
        // while the profile stamp points at an older week — only reachable
        // through DB surgery, but the conditional update alone would then
        // "win" (rows=1) and the ledger insert would die on
        // ux_ai_credit_refill_patient_week. Before the fix that exception
        // aborted the caller's transaction, so every chat turn of this
        // patient 500'd until the ISO week rolled over. The refill exists
        // only as a weekly topping — it must never be lethal: the ledger
        // pre-check short-circuits it to a silent false return, touching
        // neither the balance nor the stamp.
        User patient = createUser("patient.refill-inconsistent@example.com");
        String period = AiCreditService.currentRefillPeriod();
        createPatientProfile(patient, "0901910006", "GOLD", 3);
        insertLedgerRow(patient.getId(), "AI_CHAT_REFILL", 97, 100, period);
        assertThat(jdbcTemplate.update(
            "update patient_profiles set last_credit_refill_period = '2020-W01'"
                + " where user_id = ?",
            patient.getId())).isEqualTo(1);

        Throwable failure = catchThrowable(() ->
            aiCreditService.refillPatientCreditsWeekly(patient.getId()));

        assertThat(failure).isNull();
        // Nothing was granted and nothing was rewritten: the inconsistent
        // history is left exactly as the surgery created it.
        assertThat(balanceOf(patient)).isEqualTo(3);
        assertThat(lastRefillPeriodOf(patient)).isEqualTo("2020-W01");
        assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).hasSize(1);
    }

    @Test
    @DisplayName("Inconsistent history with a NULL profile stamp is also a safe no-op")
    void refillAgainstNullStampedInconsistentHistoryNeverThrows() {
        // Same surgery through the other branch of the WHERE clause: a
        // never-stamped profile whose current-period grant row already exists.
        User patient = createUser("patient.refill-inconsistent-null@example.com");
        String period = AiCreditService.currentRefillPeriod();
        createPatientProfile(patient, "0901910007", "STANDARD", 0);
        insertLedgerRow(patient.getId(), "AI_CHAT_REFILL", 20, 20, period);

        Throwable failure = catchThrowable(() ->
            aiCreditService.refillPatientCreditsWeekly(patient.getId()));

        assertThat(failure).isNull();
        assertThat(balanceOf(patient)).isZero();
        assertThat(lastRefillPeriodOf(patient)).isNull();
        assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).hasSize(1);
    }

    @Test
    @DisplayName("The single tier map grants 20/50/100/300 and folds unknown tiers to STANDARD")
    void tierMapIsTheSingleSourceOfTruth() {
        assertThat(AiCreditService.tierMaxCredits("STANDARD")).isEqualTo(20);
        assertThat(AiCreditService.tierMaxCredits("silver")).isEqualTo(50);
        assertThat(AiCreditService.tierMaxCredits(" GOLD ")).isEqualTo(100);
        assertThat(AiCreditService.tierMaxCredits("VIP")).isEqualTo(300);
        assertThat(AiCreditService.tierMaxCredits(null)).isEqualTo(20);
        assertThat(AiCreditService.tierMaxCredits("PLATINUM")).isEqualTo(20);
    }

    @Test
    @DisplayName("The refill period is a bounded ISO week stamp (YYYY-Www, max 16 chars)")
    void refillPeriodFormatFitsTheColumn() {
        String period = AiCreditService.currentRefillPeriod();
        assertThat(period).matches("\\d{4}-W\\d{2}");
        assertThat(period).hasSizeLessThanOrEqualTo(16);
    }

    @Test
    @Timeout(value = 30)
    @DisplayName("A refill contended with the caller's row lock gives up on the budget instead of hanging")
    void refillUnderContentionGivesUpQuicklyInsteadOfHanging() throws Exception {
        // Wukong falsification (round 2): the stale-lease refund earlier in
        // prepare joins the CALLER's transaction and keeps the row lock on
        // this patient_profiles row until the caller commits — while Spring
        // has suspended that same caller to run the REQUIRES_NEW refill. The
        // inner UPDATE then waits for a lock only the suspended outer can
        // release: a self-deadlock with no exception, so the caller's catch
        // guard never fires and the turn hangs (two pool connections pinned
        // per stuck turn). The refill now runs under SET LOCAL
        // lock_timeout = 2s: the contended attempt fails fast into the
        // guard, and a later uncontended turn still tops the balance up.
        User patient = createUser("patient.refill-contention@example.com");
        createPatientProfile(patient, "0901910008", "SILVER", 1);

        try (Connection lockHolder = dataSource.getConnection()) {
            lockHolder.setAutoCommit(false);
            // Stand in for the outer prepare transaction: hold the row lock
            // the stale-lease refund would be holding at refill time.
            try (var lock = lockHolder.prepareStatement(
                    "select id from patient_profiles where user_id = ? for update")) {
                lock.setObject(1, patient.getId());
                lock.executeQuery();
            }

            long startedAt = System.nanoTime();
            Throwable failure = catchThrowable(() ->
                aiCreditService.refillPatientCreditsWeekly(patient.getId()));
            long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;

            // The wait hit the 2s lock budget (not instant, not forever) and
            // the failed attempt changed nothing: no balance, no stamp.
            assertThat(failure).isNotNull();
            assertThat(elapsedMs).isBetween(1_000L, 20_000L);
            assertThat(balanceOf(patient)).isEqualTo(1);
            assertThat(lastRefillPeriodOf(patient)).isNull();
            assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).isEmpty();
            lockHolder.rollback();
        }

        // Deferred, not lost: an uncontended turn performs the topping.
        assertThat(aiCreditService.refillPatientCreditsWeekly(patient.getId())).isTrue();
        assertThat(balanceOf(patient)).isEqualTo(50);
        assertThat(ledgerRows(patient.getId(), "AI_CHAT_REFILL")).hasSize(1);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private int balanceOf(User user) {
        Integer balance = jdbcTemplate.queryForObject(
            "select ai_credits from patient_profiles where user_id = ?",
            Integer.class, user.getId());
        return balance == null ? -1 : balance;
    }

    private String lastRefillPeriodOf(User user) {
        return jdbcTemplate.queryForObject(
            "select last_credit_refill_period from patient_profiles where user_id = ?",
            String.class, user.getId());
    }

    private java.util.List<java.util.Map<String, Object>> ledgerRows(UUID userId, String type) {
        return jdbcTemplate.queryForList(
            "select amount, balance_after, transaction_type, refill_period"
                + " from ai_credit_transactions"
                + " where user_id = ? and transaction_type = ?"
                + " order by created_at, id",
            userId, type);
    }

    private void insertLedgerRow(UUID userId, String transactionType,
            int amount, int balanceAfter, String refillPeriod) {
        jdbcTemplate.update(
            "insert into ai_credit_transactions"
                + " (user_id, target_role, amount, balance_after, transaction_type,"
                + "  description, refill_period)"
                + " values (?, 'PATIENT', ?, ?, ?, ?, ?)",
            userId, amount, balanceAfter, transactionType,
            "Hồi credit AI hằng tuần (kỳ " + refillPeriod + ")", refillPeriod);
    }

    private User createUser(String email) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("test-password-hash");
        user.setDisplayName("Refill Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private PatientProfile createPatientProfile(User user, String phone, String tier, int credits) {
        PatientProfile profile = new PatientProfile();
        profile.setUserId(user.getId());
        profile.setFullName("Refill Patient");
        profile.setEmail(user.getEmail());
        profile.setPhone(phone);
        profile.setPatientTier(tier);
        profile.setAiCredits(credits);
        profile.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return patientProfileRepository.save(profile);
    }
}
