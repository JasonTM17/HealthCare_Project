package com.healthcare.auth.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordInputPolicyTest {

    @Test
    void asciiAt72BytesFits() {
        assertThat(PasswordInputPolicy.fitsBcrypt("Aa1!" + "x".repeat(68))).isTrue();
    }

    @Test
    void asciiAt73BytesRejected() {
        assertThat(PasswordInputPolicy.fitsBcrypt("Aa1!" + "x".repeat(69))).isFalse();
    }

    @Test
    void multibyteAt72BytesFits() {
        assertThat(PasswordInputPolicy.fitsBcrypt("Aa1!" + "é".repeat(34))).isTrue();
    }

    @Test
    void multibyteOver72BytesRejected() {
        assertThat(PasswordInputPolicy.fitsBcrypt("Aa1!" + "é".repeat(35))).isFalse();
    }

    @Test
    void nullDelegatesToNotBlank() {
        assertThat(PasswordInputPolicy.fitsBcrypt(null)).isTrue();
    }
}
