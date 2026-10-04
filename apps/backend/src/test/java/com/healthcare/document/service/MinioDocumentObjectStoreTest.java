package com.healthcare.document.service;

import io.minio.MinioClient;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MinioDocumentObjectStoreTest {

    private final MinioClient client = mock(MinioClient.class);

    @Test
    void configuredOnlyWhenBothCredentialsAreReal() {
        assertThat(new MinioDocumentObjectStore(client, "bucket", "access", "secret")
                .isConfigured()).isTrue();
    }

    @Test
    void blankCredentialsAreNotConfigured() {
        assertThat(new MinioDocumentObjectStore(client, "bucket", "", "secret")
                .isConfigured()).isFalse();
        assertThat(new MinioDocumentObjectStore(client, "bucket", "access", " ")
                .isConfigured()).isFalse();
        assertThat(new MinioDocumentObjectStore(client, "bucket", null, "secret")
                .isConfigured()).isFalse();
    }

    @Test
    void placeholderSentinelIsNotConfigured() {
        assertThat(new MinioDocumentObjectStore(client, "bucket", "storage-not-configured", "secret")
                .isConfigured()).isFalse();
        assertThat(new MinioDocumentObjectStore(client, "bucket", "access", "storage-not-configured")
                .isConfigured()).isFalse();
        assertThat(new MinioDocumentObjectStore(client, "bucket", " storage-not-configured ", "secret")
                .isConfigured()).isFalse();
        assertThat(new MinioDocumentObjectStore(client, "bucket", "access", "\tstorage-not-configured\n")
                .isConfigured()).isFalse();
    }
}
