package com.healthcare.auth.mail;

import com.healthcare.notification.entity.NotificationCategory;

/** Closed set of code-owned patient email templates. */
public enum EmailTemplateKey {
    EMAIL_VERIFICATION(
        EmailCategory.SECURITY_CRITICAL,
        1,
        "[HealthCare] Xác minh email",
        "Mã xác minh tài khoản của bạn đã sẵn sàng."
    ),
    PASSWORD_RESET(
        EmailCategory.SECURITY_CRITICAL,
        1,
        "[HealthCare] Đặt lại mật khẩu",
        "Mã đặt lại mật khẩu của bạn đã sẵn sàng."
    ),
    BOOKING_OTP(
        EmailCategory.SECURITY_CRITICAL,
        1,
        "[HealthCare] Xác nhận đặt lịch",
        "Mã xác nhận đặt lịch của bạn đã sẵn sàng."
    ),
    BOOKING_VERIFICATION_OTP(
        EmailCategory.SECURITY_CRITICAL,
        1,
        "[HealthCare] Xác nhận đặt lịch",
        "Mã xác nhận đặt lịch của bạn đã sẵn sàng."
    ),
    APPOINTMENT_CONFIRMATION(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Lịch khám đã được xác nhận",
        "Bạn có một cập nhật mới về lịch khám."
    ),
    APPOINTMENT_CHANGE(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Lịch khám đã được thay đổi",
        "Lịch hẹn của bạn vừa được cập nhật."
    ),
    APPOINTMENT_CANCEL(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Lịch khám đã được hủy",
        "Lịch hẹn của bạn vừa được hủy."
    ),
    PAYMENT_STATUS(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Cập nhật thanh toán",
        "Bạn có một cập nhật thanh toán mới."
    ),
    RESULTS_READY(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Có kết quả mới",
        "Bạn có một kết quả mới cần xem."
    ),
    PRESCRIPTION_READY(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Có toa thuốc mới",
        "Bạn có thể xem chi tiết trong cổng bệnh nhân."
    ),
    CONSULTATION_REPLY(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Có phản hồi mới",
        "Bạn có một cập nhật mới trong cổng bệnh nhân."
    ),
    CARE_PLAN_REMINDER(
        EmailCategory.OPTIONAL_REMINDER,
        1,
        "[HealthCare] Nhắc chăm sóc",
        "Bạn có thể xem lại kế hoạch chăm sóc."
    ),
    SYSTEM_NOTIFICATION(
        EmailCategory.CARE_TRANSACTIONAL,
        1,
        "[HealthCare] Thông báo từ HealthCare",
        "Có một cập nhật mới từ HealthCare."
    );

    private final EmailCategory category;
    private final int templateVersion;
    private final String defaultSubject;
    private final String defaultPreheader;

    EmailTemplateKey(EmailCategory category, int templateVersion, String defaultSubject, String defaultPreheader) {
        this.category = category;
        this.templateVersion = templateVersion;
        this.defaultSubject = defaultSubject;
        this.defaultPreheader = defaultPreheader;
    }

    public EmailCategory category() {
        return category;
    }

    public int templateVersion() {
        return templateVersion;
    }

    public String defaultSubject() {
        return defaultSubject;
    }

    public String defaultPreheader() {
        return defaultPreheader;
    }

    public NotificationCategory preferenceCategory() {
        return switch (this) {
            case EMAIL_VERIFICATION, PASSWORD_RESET -> NotificationCategory.SECURITY;
            case BOOKING_OTP, BOOKING_VERIFICATION_OTP, APPOINTMENT_CONFIRMATION,
                 APPOINTMENT_CHANGE, APPOINTMENT_CANCEL -> NotificationCategory.APPOINTMENT;
            case PAYMENT_STATUS -> NotificationCategory.PAYMENT;
            case RESULTS_READY, PRESCRIPTION_READY -> NotificationCategory.CLINICAL_UPDATE;
            case CONSULTATION_REPLY -> NotificationCategory.CONSULTATION;
            case CARE_PLAN_REMINDER -> NotificationCategory.CARE_PLAN;
            case SYSTEM_NOTIFICATION -> null;
        };
    }
}
