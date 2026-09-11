-- V73: Repair invalid seed notification event types and enforce whitelist CHECK constraint

UPDATE notifications
SET event_type = 'DIAGNOSTIC_RESULT_AVAILABLE'
WHERE event_type = 'DIAGNOSTIC_READY';

UPDATE notifications
SET event_type = 'CARE_PLAN_CREATED'
WHERE event_type = 'PRESCRIPTION_ISSUED';

UPDATE notifications
SET event_type = 'PAYMENT_CONFIRMED'
WHERE event_type = 'TIER_UPGRADE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_event_type'
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT chk_notifications_event_type
            CHECK (event_type IN (
                'APPOINTMENT_CREATED',
                'APPOINTMENT_CONFIRMED',
                'APPOINTMENT_RESCHEDULED',
                'APPOINTMENT_CANCELLED',
                'APPOINTMENT_REMINDER',
                'DIAGNOSTIC_RESULT_AVAILABLE',
                'PAYMENT_SUBMITTED',
                'PAYMENT_CONFIRMED',
                'PAYMENT_REJECTED',
                'PAYMENT_REFUNDED',
                'CARE_PLAN_CREATED',
                'CARE_PLAN_ITEM_COMPLETED',
                'CARE_PLAN_ITEM_CANCELLED'
            ));
    END IF;
END $$;
