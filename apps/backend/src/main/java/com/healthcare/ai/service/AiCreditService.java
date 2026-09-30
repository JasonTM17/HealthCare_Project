package com.healthcare.ai.service;

import com.healthcare.ai.entity.AiCreditTransaction;
import com.healthcare.ai.repository.AiCreditTransactionRepository;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.common.SafePageRequests;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Patient AI credit accounting on top of the {@code ai_credit_transactions}
 * ledger.
 *
 * <p><b>Patient metering contract.</b> A completed grounded chat answer is
 * charged once ({@link #deductPatientCredit}) after the answer rows exist,
 * inside the same persistence transaction. An answer degraded to
 * {@code INSUFFICIENT_EVIDENCE} is never charged; instead
 * {@link #recordPatientWaiver} writes a zero-amount {@code AI_CHAT_WAIVED}
 * row so the ledger shows why no charge happened. The credit gate that opens
 * a paid exchange is deliberately <em>not</em> applied to a degraded answer
 * that the platform can produce without calling any provider: see
 * {@link #hasPatientCreditBalance} for the rule and
 * {@code AiConversationService#prepare} for the gate itself, so a patient at
 * zero credits still receives the safe "no reliable source found" answer for
 * free (with its audit row) instead of being locked out by a 402. A missing
 * profile is gated exactly like a zero balance — the gate fails closed, so an
 * account that never received a {@code PatientProfile} (a no-phone
 * registration) cannot run the paid pipeline unmetered. A failed
 * exchange whose charge somehow outlived its answer is compensated by
 * {@link #refundPatientCredit}, which is idempotent per exchange attempt: the
 * attempt marker in the description keys both the charge lookup and the
 * already-refunded check, so the live failure path and the stale-lease sweep
 * can both call it without double-refunding.
 *
 * <p><b>Refund idempotency is guarded, not constrained.</b> The once-per-attempt
 * guarantee in {@link #refundPatientCredit} is a check-then-insert over the
 * ledger, not a database uniqueness rule. Its correct scope is the
 * {@code FOR UPDATE} row lock on the owning {@code ai_conversations} row, which
 * both callers hold ({@code AiConversationService#markFailed} and
 * {@code AiConversationService#repairStaleInFlight}) while this method runs.
 * Any future caller that refunds outside that lock can double-refund silently;
 * the missing backstop is a partial unique index over the attempt marker, which
 * the ledger stores in free text today (see the project plan for the proposed
 * schema change). The balance movement itself is atomic
 * ({@link PatientProfileRepository#refundAiCreditByUserId}) because two
 * different conversations of the same patient can be recovered concurrently
 * and no shared row lock covers them.
 *
 * <p><b>Doctor AI credits do not exist as a product.</b> The decision (recorded
 * in the patient-chat plan) was to delete the feature rather than wire it: no
 * doctor-facing flow consumes AI credits, the doctor deduction path was removed,
 * and {@link #grantCredits} now rejects a {@code DOCTOR} target instead of
 * quietly crediting a balance nothing can ever spend. The legacy
 * {@code doctors.ai_credits} column is still there and still defaults to 150;
 * it is unread and unwritten by this service, and dropping it is a separate
 * schema migration. Re-introduce metering only together with a real
 * consumption point.
 */
@Service
public class AiCreditService {

    /**
     * HC-11: admin inventories are served in bounded windows. The body still
     * stays a JSON array for compatibility, while page metadata travels in
     * headers; pages are ordered by immutable id so consecutive pages are stable
     * and gap-free.
     */
    public static final int ADMIN_LISTING_DEFAULT_SIZE = 20;
    public static final int ADMIN_LISTING_MAX_SIZE = 100;
    private static final Sort ADMIN_LISTING_SORT = Sort.by(Sort.Direction.ASC, "id");

    /**
     * Ledger type stamped on weekly refill rows. The partial unique index
     * {@code ux_ai_credit_refill_patient_week} (V108) scopes its predicate to
     * exactly this type, so a second refill row for the same patient and the
     * same ISO week is rejected by the database.
     */
    public static final String AI_CHAT_REFILL_TYPE = "AI_CHAT_REFILL";

    /**
     * The one authoritative tier-credit map (V108 refill design). It used to
     * exist twice with different numbers — here (20/50/100/300) and in
     * {@code PatientAiCreditController} (100/150/200/300) — and only VIP
     * agreed, so the weekly refill and the patient status badge could not
     * disagree about what "full" means. Both call sites now read this map.
     */
    private static final int TIER_MAX_STANDARD = 20;
    private static final int TIER_MAX_SILVER = 50;
    private static final int TIER_MAX_GOLD = 100;
    private static final int TIER_MAX_VIP = 300;

    /** Time zone the weekly refill period is computed in (product decision). */
    public static final ZoneId CREDIT_REFILL_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * The refill target for a tier name. Unknown or null tiers fall back to
     * the STANDARD allowance, mirroring {@link #getPatientTier}'s default.
     * {@code Locale.ROOT}: a host locale (the Turkish dotted-capital case)
     * must never make a tier name miss its own constant.
     */
    public static int tierMaxCredits(String tier) {
        String normalized = tier == null ? "" : tier.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "SILVER" -> TIER_MAX_SILVER;
            case "GOLD" -> TIER_MAX_GOLD;
            case "VIP" -> TIER_MAX_VIP;
            default -> TIER_MAX_STANDARD;
        };
    }

    /**
     * The current refill period: the ISO week-based year and week number in
     * {@link #CREDIT_REFILL_ZONE}, formatted {@code YYYY-Www} (fits the
     * VARCHAR(16) column). Exposed so callers and tests share one definition
     * of "the same 7 days".
     */
    public static String currentRefillPeriod() {
        LocalDate today = LocalDate.now(CREDIT_REFILL_ZONE);
        int weekBasedYear = today.get(WeekFields.ISO.weekBasedYear());
        int week = today.get(WeekFields.ISO.weekOfWeekBasedYear());
        return String.format(Locale.ROOT, "%04d-W%02d", weekBasedYear, week);
    }

    private final PatientProfileRepository patientProfileRepository;
    private final UserRepository userRepository;
    private final AiCreditTransactionRepository transactionRepository;

    /**
     * Carries the refill's {@code SET LOCAL lock_timeout} inside its own
     * physical transaction (a session command has no repository home).
     * Field-injected so the constructor signature and its hand-built unit
     * tests stay untouched; {@code refillPatientCreditsWeekly} tolerates a
     * missing manager (unsprung instances) and just loses the lock budget.
     */
    @PersistenceContext
    private EntityManager entityManager;

    public AiCreditService(
            PatientProfileRepository patientProfileRepository,
            UserRepository userRepository,
            AiCreditTransactionRepository transactionRepository) {
        this.patientProfileRepository = patientProfileRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }

    public record PatientCreditDto(
            UUID patientId,
            UUID userId,
            String fullName,
            String email,
            String phone,
            String tier,
            int credits
    ) {}

    @Transactional(readOnly = true)
    public int getPatientCredits(UUID userId) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        return profile != null ? profile.getAiCredits() : 0;
    }

    @Transactional(readOnly = true)
    public String getPatientTier(UUID userId) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        return profile != null ? profile.getPatientTier() : "STANDARD";
    }

    /**
     * Whether this patient may open a <em>paid</em> chat exchange, mirroring the
     * exact condition {@link #requirePatientCredits} enforces: a profile with a
     * zero (or negative) balance is out of paid credits, and — fail closed — a
     * missing profile is out of paid credits too.
     *
     * <p>The missing-profile branch used to return {@code true} ("not metered
     * at all"), which let an account without a {@code PatientProfile} — the
     * state AuthService leaves behind after a no-phone registration — run the
     * paid pipeline on every turn while {@link #deductPatientCredit} silently
     * no-op'd its charge and no ledger row was ever written. The gate now
     * refuses those accounts the same way it refuses a zero balance: the only
     * answers they can still reach are the provider-free safety outcomes (the
     * crisis text and the degraded {@code INSUFFICIENT_EVIDENCE} answer), and a
     * provider-consuming turn answers with 402 {@code INSUFFICIENT_AI_CREDITS}.
     *
     * <p>Exposed as a predicate rather than only as a throwing check because the
     * chat gate has to branch: a zero-credit patient is still allowed to start
     * an exchange whose answer is the provider-free
     * {@code INSUFFICIENT_EVIDENCE} degradation, and only the paid answer needs
     * the 402. See {@code AiConversationService#prepare} for the rule as
     * enforced.
     */
    @Transactional(readOnly = true)
    public boolean hasPatientCreditBalance(UUID userId) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        return profile != null
            && (profile.getAiCredits() == null
                || profile.getAiCredits() > 0);
    }

    /**
     * Weekly credit refill: at most once per ISO week (in
     * {@link #CREDIT_REFILL_ZONE}), the balance is reset to the tier maximum
     * from {@link #tierMaxCredits}. Called by {@code AiConversationService#prepare}
     * immediately before the balance gate and after the crisis bypass, so a
     * patient who ran out of credits can chat again at the start of a new
     * week without an admin grant; as the refill commits on its own before
     * returning, the gate reads the topped-up balance right after.
     *
     * <p><b>Best-effort by construction (REQUIRES_NEW).</b> The refill is a
     * weekly topping and must never kill a chat turn. It therefore runs in
     * its own physical transaction rather than joining the caller's, and the
     * caller wraps it in a catch guard. A Java-side catch alone is not
     * enough: if the ledger insert inside the <em>caller's</em> transaction
     * violated {@code ux_ai_credit_refill_patient_week}, PostgreSQL aborts
     * the whole physical transaction at that statement, and no amount of
     * exception swallowing on the Java side can rescue the commit — every
     * later statement of the prepare transaction fails too, so the patient's
     * chat 500s until the week rolls over. As a separate physical
     * transaction, a failure — the inconsistent-history surgery below, a
     * constraint race, anything — rolls back only the grant itself (the
     * balance update included, so the row and the ledger never drift apart)
     * and leaves the outer transaction unmarked and free to commit; the
     * caller's guard also swallows the propagated exception, including
     * {@code UnexpectedRollbackException} from the inner commit.
     *
     * <p><b>Inconsistent-history pre-check.</b> The ledger row for the
     * current period is checked <em>before</em> the conditional update.
     * Without it, a profile whose stamp differs from the real grant history
     * (only reachable through direct surgery on one of the two tables) would
     * let the update win — the WHERE matches the stale stamp — and then die
     * on the unique index at the insert. With the pre-check that state is a
     * silent no-op that leaves the surgery exactly as it found it; the
     * happy path pays one extra indexed SELECT.
     *
     * <p><b>Concurrency contract.</b> The grant is the conditional atomic
     * {@link PatientProfileRepository#refillAiCreditsByUserId} — the row is
     * written to {@code tierMax} and stamped with {@code period} only while
     * the stored stamp differs from {@code period}. Two concurrent chats, a
     * retried prepare, or a second instance therefore cannot double-grant:
     * every caller but the first re-evaluates the WHERE against the already
     * advanced stamp and gets 0 rows. The ledger insert happens only for the
     * winner, so {@code balance_after} stays monotonic per week, and the
     * V108 partial unique index
     * {@code ux_ai_credit_refill_patient_week (user_id, refill_period)} is
     * the database backstop if a future caller forgets the guard — a race
     * that loses against the index fails inside this method's own
     * transaction and, per the contract above, costs the patient at most the
     * topping, never the message. The pre/post balances are read through
     * scalar projections, never through {@code findByUserId}: loading the
     * entity here would leave a stale managed copy behind the bulk update,
     * and the chat gate that runs next reads the balance through the entity.
     *
     * <p><b>Ledger {@code amount} is the true balance delta
     * ({@code tierMax - balanceBefore}) in the single-writer case, and an
     * approximation when writers interleave:</b> the {@code before} scalar
     * is read separately from the bulk update, so an admin grant or a spend
     * committing between the read and the update makes the recorded delta
     * differ from the balance movement the update actually applied.
     * {@code balance_after} is always re-read after the update and stays
     * exact. The amount is an audit narrative, not an accounting input, so
     * the read is deliberately not folded into the UPDATE.
     * When an admin grant had pushed the balance above the tier cap the
     * delta is negative, which honestly records that the weekly reset
     * brought the balance back down to the cap.
     *
     * <p><b>Lock-wait budget.</b> The stale-lease refund earlier in
     * {@code prepare} joins the caller's transaction and keeps the row lock
     * on this patient's profile until the caller commits — while Spring has
     * suspended that same caller to run this method. Without a budget that
     * is a self-deadlock: the inner UPDATE waits for a lock only the
     * suspended outer can release, no exception ever fires, and the turn
     * hangs until the infrastructure kills the connection. Every refill
     * transaction therefore runs under {@code SET LOCAL lock_timeout = 2s};
     * a contended refill fails fast, the caller's guard swallows it, and
     * the next turn retries. The budget is per-transaction, not per-pool.
     *
     * @return {@code true} when this call performed the refill and wrote the
     *         ledger row; {@code false} when already refilled this period
     *         (including the pre-check against the ledger), the period's
     *         grant row exists against a mismatched stamp, or the profile
     *         does not exist (fail closed, like the gate).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean refillPatientCreditsWeekly(UUID userId) {
        if (entityManager != null) {
            // Lock-wait budget. The stale-lease refund earlier in prepare
            // runs in the CALLER's transaction and keeps the row-exclusive
            // lock on this patient_profiles row until the caller commits.
            // Spring suspends that caller around this REQUIRES_NEW call, so
            // the UPDATE below can only wait for a lock its own suspended
            // outer will never release until this inner returns — a circular
            // wait with no exception, invisible to the caller's catch guard,
            // and unbounded without a budget (each stuck turn pins two pool
            // connections). Capping the wait at two seconds turns that hang
            // into an ordinary failure the caller's guard swallows; the
            // topping is merely deferred to the next chat turn, which reruns
            // this method without the contended lock. SET LOCAL scopes the
            // budget to this transaction only — no pool-wide timeout changes.
            entityManager.createNativeQuery("SET LOCAL lock_timeout = '2s'").executeUpdate();
        }
        String tier = patientProfileRepository.findPatientTierByUserId(userId).orElse(null);
        if (tier == null) {
            // No profile: nothing to refill. The paid gate refuses this account
            // separately (fail closed), so no ledger row is ever owed to it.
            return false;
        }
        int tierMax = tierMaxCredits(tier);
        String period = currentRefillPeriod();
        if (transactionRepository.existsPatientRefillInPeriod(userId, period)) {
            // The grant for this period is already in the ledger even though
            // the profile stamp says otherwise (inconsistent history). A
            // no-op that touches nothing: repairing the stamp here would
            // rewrite surgical state, and the insert below would collide
            // with ux_ai_credit_refill_patient_week and abort a transaction.
            return false;
        }
        int before = patientProfileRepository.findAiCreditsByUserId(userId).orElse(0);
        int updated = patientProfileRepository.refillAiCreditsByUserId(userId, tierMax, period);
        if (updated == 0) {
            // Already refilled this ISO week (or the profile vanished
            // concurrently): exactly-once per period, no ledger row.
            return false;
        }
        // Scalar projection: the ledger must record the balance the row
        // actually holds after the conditional update.
        int after = patientProfileRepository.findAiCreditsByUserId(userId).orElse(0);

        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "PATIENT", tierMax - before, after, AI_CHAT_REFILL_TYPE,
                "Hồi credit AI hằng tuần (kỳ " + period + ", hạng "
                        + tier.toUpperCase(Locale.ROOT) + ")"
        );
        tx.setRefillPeriod(period);
        transactionRepository.save(tx);
        return true;
    }

    @Transactional(readOnly = true)
    public void requirePatientCredits(UUID userId) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) {
            throw new BusinessException(
                402,
                "INSUFFICIENT_AI_CREDITS",
                "Tài khoản của bạn chưa có hồ sơ bệnh nhân nên chưa được cấp lượt hỏi AI."
                    + " Vui lòng liên hệ quản trị viên để được cấp credit."
            );
        }
        if (profile.getAiCredits() != null && profile.getAiCredits() <= 0) {
            throw new BusinessException(
                402,
                "INSUFFICIENT_AI_CREDITS",
                "Bạn đã dùng hết lượt hỏi AI (Credit: 0). Vui lòng nâng hạng thẻ hoặc liên hệ quản trị viên để được cấp thêm credit."
            );
        }
    }

    @Transactional
    public boolean deductPatientCredit(UUID userId, String description) {
        int updated = patientProfileRepository.deductAiCreditByUserId(userId);
        if (updated == 0) {
            if (patientProfileRepository.findByUserId(userId).isEmpty()) {
                return false;
            }
            throw new BusinessException(
                402,
                "INSUFFICIENT_AI_CREDITS",
                "Bạn đã dùng hết lượt hỏi AI (Credit: 0). Vui lòng nâng hạng thẻ hoặc liên hệ quản trị viên để được cấp thêm credit."
            );
        }
        // Scalar projection: the ledger must record the balance that actually
        // exists after the atomic decrement, not a possibly stale entity copy.
        int after = patientProfileRepository.findAiCreditsByUserId(userId).orElse(0);

        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "PATIENT", -1, after, "AI_CHAT_USAGE", description
        );
        transactionRepository.save(tx);
        return true;
    }

    /**
     * Records why a completed answer was not charged: a zero-amount
     * {@code AI_CHAT_WAIVED} row at the current balance. The balance is never
     * changed. Called from the persistence transaction that also stored the
     * degraded answer, and the persistence path's idempotent replay guard
     * (an existing reply row short-circuits the completion) means one attempt
     * records at most one waiver.
     */
    @Transactional
    public boolean recordPatientWaiver(UUID userId, String description) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) {
            return false;
        }
        int current = profile.getAiCredits() != null ? profile.getAiCredits() : 0;
        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "PATIENT", 0, current, "AI_CHAT_WAIVED", description
        );
        transactionRepository.save(tx);
        return true;
    }

    /** Convenience overload for callers without an exchange-attempt marker. */
    @Transactional
    public boolean refundPatientCredit(UUID userId, String description) {
        return refundPatientCredit(userId, description, null);
    }

    /**
     * Refunds one patient chat credit, at most once per exchange attempt.
     *
     * <p>With an {@code attemptMarker} (the {@code [chat:<requestMessageId>]}
     * token the charge row carries), the refund is gated twice: it happens
     * only when a charged {@code AI_CHAT_USAGE} row for that attempt exists,
     * and only when no {@code AI_CHAT_REFUND} row for that attempt exists yet.
     * This makes the recovery path shared by the live failure handler and the
     * periodic stale-lease sweep safe to run repeatedly. Without a marker the
     * refund applies unconditionally (legacy operator/explicit-refund use).
     *
     * <p><b>Invariant:</b> one attempt marker licenses at most one
     * {@code AI_CHAT_REFUND} row and at most one credit. <b>Enforcement:</b> the
     * two ledger checks below are a check-then-insert, and migration
     * {@code V97__unique_ai_chat_refund_per_attempt} is what turns the invariant
     * into a database fact rather than caller discipline — the callers
     * {@code AiConversationService#markFailed} and
     * {@code AiConversationService#repairStaleInFlight} additionally hold the
     * owning conversation row's {@code FOR UPDATE} lock. A violation of that
     * index is deliberately <b>not</b> caught and turned into a {@code false}
     * return: by the time the insert fails the transaction is already
     * rollback-only, so swallowing it would either raise
     * {@code UnexpectedRollbackException} at commit or leave the balance
     * increment detached from the ledger row. Letting it propagate rolls the
     * increment and the row back together, which is the all-or-nothing result we
     * want, and the caller's compensation handler logs it. The ordering below is
     * the safe one: guard first, then the atomic balance increment, then the
     * ledger row stamped with the balance the increment actually produced. The
     * increment is deliberately not a read-modify-write of the entity, because
     * refunds of two different conversations belonging to the same patient share
     * no row lock and would otherwise lose one of the two credits.
     *
     * @return {@code true} when a refund row was written, {@code false} when
     *         the profile is missing, nothing was charged for the attempt, or
     *         the attempt was already refunded.
     */
    @Transactional
    public boolean refundPatientCredit(UUID userId, String description, String attemptMarker) {
        if (attemptMarker != null && !attemptMarker.isBlank()) {
            if (!transactionRepository.existsPatientAiChatUsage(userId, attemptMarker)) {
                // Nothing was charged for this attempt (the normal outcome of
                // the charge-after-persist ordering); refunding would grant a
                // free credit.
                return false;
            }
            if (transactionRepository.existsPatientRefund(userId, attemptMarker)) {
                return false;
            }
            description = description + " " + attemptMarker;
        }
        // Atomic increment, mirroring deductPatientCredit. The update carries no
        // balance predicate (a credit can always be returned), so zero rows
        // affected means the profile itself is gone.
        int updated = patientProfileRepository.refundAiCreditByUserId(userId);
        if (updated == 0) {
            return false;
        }
        // Scalar projection: the ledger must record the post-increment balance
        // that actually exists in the row, not a stale entity copy.
        int after = patientProfileRepository.findAiCreditsByUserId(userId).orElse(0);

        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "PATIENT", 1, after, "AI_CHAT_REFUND", description
        );
        transactionRepository.save(tx);
        return true;
    }

    /**
     * Credits a patient's AI balance and records the matching ledger row.
     *
     * <p>A {@code DOCTOR} target is refused with a validation error instead of
     * being credited: doctor AI credit was decided out of the product (no
     * doctor-facing flow spends a credit), so a grant would create a balance no
     * code can ever consume. Keeping the write path silent was the defect this
     * removes; an operator asking for it now gets an explicit answer. The
     * legacy {@code doctors.ai_credits} column is untouched by this method.
     *
     * @throws BusinessException 400 {@code VALIDATION_ERROR} when the target is
     *         a doctor or any role other than {@code PATIENT}.
     */
    @Transactional
    public void grantCredits(UUID userId, String targetRole, int amount, String transactionType, String description) {
        // Locale.ROOT: a host locale must never turn "patient" into a string
        // that no longer matches its own constant (the dotted-capital case).
        String normalizedRole = targetRole == null
                ? ""
                : targetRole.trim().toUpperCase(java.util.Locale.ROOT);
        if ("DOCTOR".equals(normalizedRole)) {
            throw new BusinessException(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "Không thể cấp credit AI cho bác sĩ: hệ thống chưa có luồng nào tiêu hao credit AI của bác sĩ."
                    + " Vui lòng cấp credit cho bệnh nhân."
            );
        }
        if (!"PATIENT".equals(normalizedRole)) {
            throw new BusinessException(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "Đối tượng nhận credit AI không hợp lệ. Hiện hệ thống chỉ cấp credit AI cho bệnh nhân (PATIENT)."
            );
        }
        PatientProfile profile = patientProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient profile not found for user: " + userId));
        int after = Math.max(0, (profile.getAiCredits() != null ? profile.getAiCredits() : 0) + amount);
        profile.setAiCredits(after);
        patientProfileRepository.save(profile);

        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "PATIENT", amount, after, transactionType, description
        );
        transactionRepository.save(tx);
    }

    @Transactional
    public void updatePatientTier(UUID patientProfileId, String newTier, Integer newCredits) {
        PatientProfile profile = patientProfileRepository.findById(patientProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient profile not found: " + patientProfileId));

        // Locale.ROOT: a host locale (the Turkish dotted-capital case) must
        // never write a tier name that tierMaxCredits/getPatientTier can no
        // longer map back to its constant — "silver".toUpperCase(tr) is
        // "SİLVER", which silently falls back to the STANDARD allowance.
        profile.setPatientTier(newTier.toUpperCase(Locale.ROOT));
        // Single source of truth: the weekly refill resets to this same map.
        int credits = newCredits != null && newCredits >= 0
                ? newCredits
                : tierMaxCredits(newTier);
        profile.setAiCredits(credits);
        patientProfileRepository.save(profile);

        if (profile.getUserId() != null) {
            AiCreditTransaction tx = new AiCreditTransaction(
                    profile.getUserId(),
                    "PATIENT",
                    credits,
                    credits,
                    "TIER_UPGRADE",
                    "Cập nhật hạng thành viên: " + newTier.toUpperCase(Locale.ROOT) + " (" + credits + " credits)"
            );
            transactionRepository.save(tx);
        }
    }

    /**
     * Bounded admin patient inventory (HC-11). Replaces the previous
     * unbounded {@code findAll()} materialization; the response body stays a
     * JSON array and pagination metadata travels in response headers.
     */
    @Transactional(readOnly = true)
    public Page<PatientCreditDto> listPatients(Integer page, Integer size) {
        Pageable bounded = SafePageRequests.normalizeAdminListing(
            page, size, ADMIN_LISTING_DEFAULT_SIZE, ADMIN_LISTING_MAX_SIZE, ADMIN_LISTING_SORT);
        return patientProfileRepository.findAll(bounded)
                .map(p -> new PatientCreditDto(
                        p.getId(),
                        p.getUserId(),
                        p.getFullName(),
                        p.getEmail(),
                        p.getPhone(),
                        p.getPatientTier(),
                        p.getAiCredits() != null ? p.getAiCredits() : 0
                ));
    }

    /**
     * The patient credit status screen serves only the most recent window of
     * the ledger so an old account cannot materialize an unbounded array;
     * the total row count travels alongside it as {@code totalTransactions}.
     */
    public static final int PATIENT_HISTORY_LIMIT = 20;

    @Transactional(readOnly = true)
    public List<AiCreditTransaction> listTransactions(UUID userId) {
        return transactionRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, PATIENT_HISTORY_LIMIT))
                .getContent();
    }

    @Transactional(readOnly = true)
    public long countTransactions(UUID userId) {
        return transactionRepository.countByUserId(userId);
    }

    @Transactional(readOnly = true)
    public int getMaxTransactionBalance(UUID userId) {
        return transactionRepository.findMaxBalanceAfterByUserId(userId);
    }
}
