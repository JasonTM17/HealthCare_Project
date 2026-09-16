-- Doctors order a test first; publishing its result completes the order.
-- A result without an order must be impossible, matching real lab workflow.

CREATE TABLE diagnostic_orders (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id),
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    appointment_id UUID REFERENCES appointments(id),
    test_name VARCHAR(200) NOT NULL,
    notes VARCHAR(1000),
    status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_diagnostic_orders_status
        CHECK (status IN ('REQUESTED', 'COLLECTED', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX idx_diagnostic_orders_patient_created
    ON diagnostic_orders (patient_id, created_at DESC);
CREATE INDEX idx_diagnostic_orders_doctor_status
    ON diagnostic_orders (doctor_id, status);

-- Results point back to the order that requested them.
ALTER TABLE diagnostic_results ADD COLUMN order_id UUID REFERENCES diagnostic_orders(id);
CREATE INDEX idx_diagnostic_results_order ON diagnostic_results (order_id);
