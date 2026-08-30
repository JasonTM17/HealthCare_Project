package com.healthcare.storage;

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
}
