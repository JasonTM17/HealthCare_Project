-- Receipts keep the payment status they were issued under: a later refund
-- transition must never rewrite a document the patient may already have
-- downloaded. Invoices can only be issued from PAID-or-later states, so PAID
-- is the only value a pre-existing row could have shown.
ALTER TABLE payment_invoices
    ADD COLUMN status_snapshot VARCHAR(32) NOT NULL DEFAULT 'PAID';
