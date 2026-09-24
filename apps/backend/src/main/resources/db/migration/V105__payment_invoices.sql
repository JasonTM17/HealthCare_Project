-- Immutable payment receipts (biên nhận). One per payment, issued on demand
-- only after an administrator has verified the transfer; the row snapshots
-- the receipt facts so later appointment edits never rewrite a document the
-- patient may have already downloaded.
CREATE TABLE payment_invoices (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL UNIQUE,
    invoice_number VARCHAR(32) NOT NULL UNIQUE,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    issued_by VARCHAR(255),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'VND'),
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255),
    booking_code VARCHAR(32) NOT NULL,
    CONSTRAINT fk_payment_invoices_payment
        FOREIGN KEY (payment_id) REFERENCES bank_transfer_payments (id) ON DELETE RESTRICT
);

CREATE SEQUENCE payment_invoice_number_seq;

CREATE INDEX idx_payment_invoices_issued_at ON payment_invoices (issued_at DESC);
