package com.healthcare.exception;

/** Stable machine-readable API error identifiers. */
public final class ErrorCodes {

    public static final String INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public static final String INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN";
    public static final String EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED";
    public static final String EMAIL_VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED";
    public static final String EMAIL_ALREADY_VERIFIED = "EMAIL_ALREADY_VERIFIED";
    public static final String INVALID_OTP = "INVALID_OTP";
    public static final String OTP_EXPIRED = "OTP_EXPIRED";
    public static final String OTP_ATTEMPTS_EXCEEDED = "OTP_ATTEMPTS_EXCEEDED";
    public static final String OTP_ALREADY_USED = "OTP_ALREADY_USED";
    public static final String OTP_RESEND_THROTTLED = "OTP_RESEND_THROTTLED";
    public static final String EMAIL_DELIVERY_UNAVAILABLE = "EMAIL_DELIVERY_UNAVAILABLE";
    public static final String RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED";
    public static final String PREFERENCES_INVALID = "PREFERENCES_INVALID";
    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    public static final String AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED";
    public static final String ACCESS_DENIED = "ACCESS_DENIED";
    public static final String AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED";
    public static final String RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND";
    public static final String CONFLICT = "CONFLICT";
    public static final String REQUEST_FAILED = "REQUEST_FAILED";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";
    public static final String FORBIDDEN_ROLE = "FORBIDDEN_ROLE";
    public static final String AI_CONVERSATION_NOT_FOUND = "AI_CONVERSATION_NOT_FOUND";
    public static final String CHAT_MESSAGE_IN_PROGRESS = "CHAT_MESSAGE_IN_PROGRESS";
    public static final String CHAT_IDEMPOTENCY_CONFLICT = "CHAT_IDEMPOTENCY_CONFLICT";
    public static final String CHAT_INPUT_INVALID = "CHAT_INPUT_INVALID";
    public static final String AI_UNAVAILABLE = "AI_UNAVAILABLE";
    public static final String AI_RESPONSE_INVALID = "AI_RESPONSE_INVALID";
    public static final String CHAT_CONTENT_BLOCKED = "CHAT_CONTENT_BLOCKED";
    public static final String CHAT_RETENTION_EXPIRED = "CHAT_RETENTION_EXPIRED";
    public static final String CHAT_CONSENT_REQUIRED = "CHAT_CONSENT_REQUIRED";
    public static final String CHAT_CONSENT_VERSION_STALE = "CHAT_CONSENT_VERSION_STALE";
    public static final String CHAT_MODE_INVALID = "CHAT_MODE_INVALID";
    public static final String CHAT_FEEDBACK_INVALID = "CHAT_FEEDBACK_INVALID";
    public static final String AI_CONTENT_REVISION_STALE = "AI_CONTENT_REVISION_STALE";
    public static final String AI_CONTENT_NOT_SUBMITTED = "AI_CONTENT_NOT_SUBMITTED";
    public static final String AI_CONTENT_APPROVER_NOT_INDEPENDENT = "AI_CONTENT_APPROVER_NOT_INDEPENDENT";
    public static final String AI_CONTENT_ALREADY_DECIDED = "AI_CONTENT_ALREADY_DECIDED";

    private ErrorCodes() {
    }
}
