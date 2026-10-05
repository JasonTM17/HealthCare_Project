package com.healthcare.auth.mail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Recipient addresses are mailbox PII: log lines must carry only a masked
 * local part plus the domain, never the raw address.
 */
class ApiEmailSenderMaskTest {

    @Test
    void masksLocalPartAndKeepsDomain() {
        assertThat(ApiEmailSender.maskRecipient("patient@example.com"))
            .isEqualTo("p***@example.com");
        assertThat(ApiEmailSender.maskRecipient("nguyen.van.a@clinic.vn"))
            .isEqualTo("n***@clinic.vn");
    }

    @Test
    void singleCharacterLocalPartFullyMasks() {
        assertThat(ApiEmailSender.maskRecipient("a@example.com")).isEqualTo("*@example.com");
    }

    @Test
    void handlesNullAndMalformedValues() {
        assertThat(ApiEmailSender.maskRecipient(null)).isEqualTo("<null>");
        assertThat(ApiEmailSender.maskRecipient("not-an-email")).isEqualTo("***");
        assertThat(ApiEmailSender.maskRecipient("")).isEqualTo("***");
    }
}
