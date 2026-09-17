package com.healthcare.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FailClosedStoragePolicyTest {

    @Test
    void unpackagedUploadWithoutAvFailsClosed() {
        assertThatThrownBy(() -> FailClosedStoragePolicy.validate(true, false, false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("STORAGE_UPLOAD_ENABLED requires STORAGE_AV_REQUIRED");
    }

    @Test
    void uploadWithAvRequiredIsAllowed() {
        assertThatCode(() -> FailClosedStoragePolicy.validate(true, true, false))
            .doesNotThrowAnyException();
    }

    @Test
    void uploadDisabledDoesNotRequireAv() {
        assertThatCode(() -> FailClosedStoragePolicy.validate(false, false, false))
            .doesNotThrowAnyException();
    }

    @Test
    void explicitUnscannedEscapeAllowsTestUploadsWithoutAv() {
        assertThatCode(() -> FailClosedStoragePolicy.validate(true, false, true))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("storage disabled: no credential or endpoint posture is imposed")
    void storageDisabledIsUnaffected() {
        // Production runs with uploads off and no object-storage credentials.
        // Switching it on must not be able to refuse to start that runtime.
        FailClosedStoragePolicy.validateStorageEnabledPosture(false, false, "", "", false);
        FailClosedStoragePolicy.validateStorageEnabledPosture(false, false, "healthcare", "change-me", false);
    }

    @Test
    @DisplayName("storage enabled without the private-endpoint guard is refused")
    void storageEnabledRequiresPrivateEndpointGuard() {
        assertThatThrownBy(() -> FailClosedStoragePolicy.validateStorageEnabledPosture(
            true, false, "real-access", "real-secret", false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("STORAGE_REQUIRE_PRIVATE_ENDPOINT");
    }

    @Test
    @DisplayName("storage enabled with placeholder credentials is refused")
    void storageEnabledRejectsPlaceholderCredentials() {
        assertThatThrownBy(() -> FailClosedStoragePolicy.validateStorageEnabledPosture(
            true, true, "healthcare", "real-secret", false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("real object storage credentials");

        assertThatThrownBy(() -> FailClosedStoragePolicy.validateStorageEnabledPosture(
            true, true, "real-access", "change-me", false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("real object storage credentials");

        assertThatThrownBy(() -> FailClosedStoragePolicy.validateStorageEnabledPosture(
            true, true, "", "", false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("real object storage credentials");
    }

    @Test
    @DisplayName("storage enabled with the guard on and real credentials passes")
    void storageEnabledWellConfiguredPasses() {
        FailClosedStoragePolicy.validateStorageEnabledPosture(true, true, "real-access", "real-secret", false);
    }

    @Test
    @DisplayName("the documented disposable-runtime escape still applies")
    void disposableRuntimeEscapeSkipsThePosture() {
        // Integration tests enable storage against a local container and set
        // storage.allow-unscanned-upload, which is documented as never for a
        // hosted runtime. Without this the posture check refuses their loopback
        // endpoint, which is exactly what the private-endpoint guard rejects.
        FailClosedStoragePolicy.validateStorageEnabledPosture(
            true, false, "minioadmin", "minioadmin", true);
    }
}
