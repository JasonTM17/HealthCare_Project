-- V108: weekly AI credit refill ("mỗi 7 ngày hồi đầy credit theo max của tier").
--
-- The refill is a conditional atomic UPDATE on patient_profiles (set the
-- balance to the tier maximum only when the stored ISO-week stamp differs),
-- so the period identity must live in the row itself. `last_credit_refill_
-- period` holds the stamp of the last granted week (e.g. 2026-W40, ISO week
-- computed in Asia/Ho_Chi_Minh). NULL means "never refilled", which the
-- conditional update treats as eligible.
--
-- The ledger mirror of the same stamp, plus a partial unique index over
-- (user_id, refill_period) scoped to AI_CHAT_REFILL rows, is the database
-- backstop against a double grant: concurrent chats, a retried prepare, or a
-- second instance could otherwise each write a refill row whose balance_after
-- disagrees with the next one. Money state must not rest on the conditional
-- update alone (mirrors the V97 refund backstop). Pre-existing rows carry a
-- NULL refill_period, so they fall outside the predicate and the index builds
-- without touching history.

ALTER TABLE patient_profiles
    ADD COLUMN IF NOT EXISTS last_credit_refill_period VARCHAR(16);

ALTER TABLE ai_credit_transactions
    ADD COLUMN IF NOT EXISTS refill_period VARCHAR(16);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_credit_refill_patient_week
    ON ai_credit_transactions (user_id, refill_period)
    WHERE transaction_type = 'AI_CHAT_REFILL'
      AND refill_period IS NOT NULL;
