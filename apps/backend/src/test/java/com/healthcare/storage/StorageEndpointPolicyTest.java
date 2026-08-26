package com.healthcare.storage;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.healthcare.storage.config.StorageEndpointPolicy;
import org.junit.jupiter.api.Test;

class StorageEndpointPolicyTest {

    @Test
    void localFallbackRemainsAllowedOnlyWhenPolicyIsDisabled() {
        assertThatCode(() -> StorageEndpointPolicy.validatePrivateEndpoint(
            false, "http://localhost:9000", "healthcare", "change-me"))
            .doesNotThrowAnyException();
    }

    @Test
    void betaPolicyRejectsLocalhostAndPlaceholderCredentials() {
        assertThatThrownBy(() -> StorageEndpointPolicy.validatePrivateEndpoint(
            true, "http://localhost:9000", "real-key", "real-secret"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Private object storage endpoint must not be localhost");

        assertThatThrownBy(() -> StorageEndpointPolicy.validatePrivateEndpoint(
            true, "https://r2.example.test", "healthcare", "real-secret"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Private object storage credentials are required");
    }

    @Test
    void betaPolicyAcceptsPrivateS3CompatibleEndpoint() {
        assertThatCode(() -> StorageEndpointPolicy.validatePrivateEndpoint(
            true, "https://objects.example.test", "r2-access", "r2-secret"))
            .doesNotThrowAnyException();
    }

    @Test
    void betaPolicyRejectsNonHttpAndEmbeddedEndpointData() {
        assertThatThrownBy(() -> StorageEndpointPolicy.validatePrivateEndpoint(
            true, "ftp://objects.example.test", "r2-access", "r2-secret"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Private object storage endpoint must use HTTP or HTTPS");

        assertThatThrownBy(() -> StorageEndpointPolicy.validatePrivateEndpoint(
            true, "https://user:secret@objects.example.test", "r2-access", "r2-secret"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Private object storage endpoint must not embed credentials or query data");
    }
}
