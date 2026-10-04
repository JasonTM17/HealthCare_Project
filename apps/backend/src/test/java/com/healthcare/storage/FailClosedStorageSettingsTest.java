package com.healthcare.storage;

import com.healthcare.storage.config.FailClosedStorageSettings;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FailClosedStorageSettingsTest {

    private FailClosedStorageSettings settings(
            boolean requirePrivateEndpoint,
            String publicEndpoint) {
        return new FailClosedStorageSettings(
            true,  // uploadEnabled
            true,  // avRequired
            false, // allowUnscannedUpload
            false, // consultationEnabled
            requirePrivateEndpoint,
            publicEndpoint,
            "real-access-key",
            "real-secret-key");
    }

    @Test
    @DisplayName("uploads on + loopback public endpoint boots despite the hosted guard being on")
    void loopbackPublicEndpointIsALocalRuntime() {
        // The exact local compose posture: STORAGE_UPLOAD_ENABLED=true with the
        // loopback HTTP browser endpoint. The hosted HTTPS/posture rules must
        // not refuse the operator's own machine.
        assertThatCode(() -> settings(true, "http://127.0.0.1:9000").validate())
            .doesNotThrowAnyException();
        assertThatCode(() -> settings(true, "http://localhost:9000").validate())
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("uploads on + public HTTP endpoint still requires the hosted guard")
    void hostedPublicEndpointKeepsTheGuard() {
        assertThatThrownBy(() -> settings(false, "http://objects.example.test").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("STORAGE_REQUIRE_PRIVATE_ENDPOINT");
    }

    @Test
    @DisplayName("uploads on + hosted guard + placeholder credentials still fails closed")
    void hostedPlaceholderCredentialsStillRefuse() {
        assertThatThrownBy(() -> new FailClosedStorageSettings(
                true, true, false, false, true,
                "https://objects.example.test", "healthcare", "real-secret").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("real object storage credentials");
    }

    @Test
    @DisplayName("isLoopbackEndpoint: null, malformed and public hosts are not loopback")
    void loopbackDetectionIsConservative() {
        assertThatCode(() -> FailClosedStoragePolicy.isLoopbackEndpoint(null)).doesNotThrowAnyException();
        org.assertj.core.api.Assertions.assertThat(FailClosedStoragePolicy.isLoopbackEndpoint(null)).isFalse();
        org.assertj.core.api.Assertions.assertThat(FailClosedStoragePolicy.isLoopbackEndpoint("")).isFalse();
        org.assertj.core.api.Assertions.assertThat(FailClosedStoragePolicy.isLoopbackEndpoint("not a uri")).isFalse();
        org.assertj.core.api.Assertions.assertThat(FailClosedStoragePolicy.isLoopbackEndpoint("http://objects.example.test")).isFalse();
        org.assertj.core.api.Assertions.assertThat(FailClosedStoragePolicy.isLoopbackEndpoint("http://[::1]:9000")).isTrue();
    }
}
