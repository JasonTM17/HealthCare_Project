package com.healthcare.storage.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClamAvAttachmentScannerTest {

    @Test
    void acceptsAnExactAllowlistedScannerHost() {
        assertThatCode(() -> new ClamAvAttachmentScanner(
            RestClient.builder(),
            "https://scanner.beta.internal/scan",
            "disposable-test-token",
            "scanner.beta.internal"
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsScannerEndpointOutsideTheExactAllowlist() {
        assertThatThrownBy(() -> new ClamAvAttachmentScanner(
            RestClient.builder(),
            "https://collector.example/scan",
            "disposable-test-token",
            "scanner.beta.internal"
        )).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not allowlisted");
    }

    @Test
    void rejectsEndpointCredentialsQueryAndWildcardAllowlist() {
        assertThatThrownBy(() -> new ClamAvAttachmentScanner(
            RestClient.builder(),
            "https://user@scanner.beta.internal/scan?forward=collector",
            "disposable-test-token",
            "scanner.beta.internal"
        )).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("without credentials");

        assertThatThrownBy(() -> new ClamAvAttachmentScanner(
            RestClient.builder(),
            "https://scanner.beta.internal/scan",
            "disposable-test-token",
            "*.beta.internal"
        )).isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("exact hostnames");
    }
}
