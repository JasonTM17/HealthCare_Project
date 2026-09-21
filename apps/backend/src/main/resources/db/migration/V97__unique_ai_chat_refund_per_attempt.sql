-- V97 (Ultra V4, WS-C): give the AI chat refund idempotency a database backstop.
--
-- `AiCreditService.refundPatientCredit` already refuses to refund the same
-- exchange attempt twice, but the guarantee is a check-then-insert that holds
-- only while the caller keeps the conversation `FOR UPDATE` lock. Two
-- conversations of one patient share no such lock, and any future caller that
-- forgets it would silently credit the patient twice. Money state should not
-- rest on caller discipline alone, so the ledger itself now rejects the second
-- row.
--
-- The attempt identity lives inside the free-text `description` as the
-- `[chat:<requestMessageId>]` marker the charge row stamps, so the unique key
-- is an expression index. `split_part` is IMMUTABLE, which is what makes that
-- legal. The predicate keeps the constraint scoped to exactly the marked
-- patient chat refunds: grants, tier changes, zero-amount waivers, and legacy
-- refunds written before markers existed stay unconstrained, so this migration
-- cannot fail on pre-existing history.
--
-- Pre-flight on the hosted database measured 0 duplicate groups and 0 refund
-- rows at all, so the index builds without touching data.

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_credit_refund_patient_chat_attempt
    ON ai_credit_transactions (
        user_id,
        (split_part(split_part(description, '[chat:', 2), ']', 1))
    )
    WHERE target_role = 'PATIENT'
      AND transaction_type = 'AI_CHAT_REFUND'
      AND description LIKE '%[chat:%';
