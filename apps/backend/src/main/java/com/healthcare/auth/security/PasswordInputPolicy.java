package com.healthcare.auth.security;

import java.nio.charset.StandardCharsets;

public final class PasswordInputPolicy {

    public static final int MAX_UTF8_BYTES = 72;
    public static final String EXCEEDS_BCRYPT_MESSAGE = "Password must not exceed 72 UTF-8 bytes";

    private PasswordInputPolicy() {
    }

    public static boolean fitsBcrypt(String value) {
        return value == null || value.getBytes(StandardCharsets.UTF_8).length <= MAX_UTF8_BYTES;
    }
}
