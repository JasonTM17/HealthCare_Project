package com.healthcare.document.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SupabaseRestDocumentObjectStoreTest {

    @Test
    void configuredOnlyWhenEndpointAndCredentialsAreReal() {
        assertThat(new SupabaseRestDocumentObjectStore(
                "https://project.supabase.co", "bucket", "service-role-jwt", "")
                .isConfigured()).isTrue();
    }

    @Test
    void blankEndpointIsNotConfigured() {
        // normalizeEndpoint("") leaves apiBase as "/storage/v1" — the check
        // must require the endpoint itself, not just the derived base.
        assertThat(new SupabaseRestDocumentObjectStore(
                "", "bucket", "service-role-jwt", "")
                .isConfigured()).isFalse();
        assertThat(new SupabaseRestDocumentObjectStore(
                "   ", "bucket", "service-role-jwt", "")
                .isConfigured()).isFalse();
    }

    @Test
    void malformedOrSchemelessEndpointIsNotConfigured() {
        // A non-blank endpoint that URI.create cannot parse would crash every
        // call inside authed(); capabilities must report false instead.
        assertThat(new SupabaseRestDocumentObjectStore(
                "supabase.internal", "bucket", "service-role-jwt", "")
                .isConfigured()).isFalse();
        assertThat(new SupabaseRestDocumentObjectStore(
                "ht tp://bad host", "bucket", "service-role-jwt", "")
                .isConfigured()).isFalse();
        assertThat(new SupabaseRestDocumentObjectStore(
                "ftp://project.supabase.co", "bucket", "service-role-jwt", "")
                .isConfigured()).isFalse();
    }

    @Test
    void blankOrPlaceholderCredentialsAreNotConfigured() {
        assertThat(new SupabaseRestDocumentObjectStore(
                "https://project.supabase.co", "bucket", "", "")
                .isConfigured()).isFalse();
        assertThat(new SupabaseRestDocumentObjectStore(
                "https://project.supabase.co", "bucket", "storage-not-configured", "storage-not-configured")
                .isConfigured()).isFalse();
    }
}
