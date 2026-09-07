ALTER TABLE notifications
    ADD COLUMN email_available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN email_queued_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN email_suppressed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_notifications_email_pending
    ON notifications(email_available_at, created_at)
    WHERE email_queued_at IS NULL AND email_suppressed_at IS NULL;

COMMENT ON COLUMN notifications.email_available_at IS
    'Earliest time the notification email worker may evaluate this row; quiet hours move this forward.';
COMMENT ON COLUMN notifications.email_queued_at IS
    'Set when an email outbox envelope has been queued for this notification.';
COMMENT ON COLUMN notifications.email_suppressed_at IS
    'Set when email delivery was permanently skipped by recipient preference or missing recipient email.';
