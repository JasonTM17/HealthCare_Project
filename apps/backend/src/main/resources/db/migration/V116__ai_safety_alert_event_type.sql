-- V116: whitelist the AI self-harm safety alert event type. The column is a
-- plain VARCHAR(40) (V6), but V73 added a whitelist CHECK constraint that V94
-- last rebuilt, so the constraint must be rebuilt again — otherwise every
-- INSERT with the new enum value would be rejected by the database.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_event_type;

ALTER TABLE notifications
    ADD CONSTRAINT chk_notifications_event_type
    CHECK (event_type IN (
        'APPOINTMENT_CREATED',
        'APPOINTMENT_CONFIRMED',
        'APPOINTMENT_RESCHEDULED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_REMINDER',
        'DIAGNOSTIC_RESULT_AVAILABLE',
        'VISIT_COMPLETED',
        'PAYMENT_SUBMITTED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_REJECTED',
        'PAYMENT_REFUNDED',
        'CARE_PLAN_CREATED',
        'CARE_PLAN_ITEM_COMPLETED',
        'CARE_PLAN_ITEM_CANCELLED',
        'HEALTH_QUESTION_SUBMITTED',
        'HEALTH_QUESTION_ANSWERED',
        'CONSULTATION_MESSAGE',
        'AI_SAFETY_ALERT'
    ));
