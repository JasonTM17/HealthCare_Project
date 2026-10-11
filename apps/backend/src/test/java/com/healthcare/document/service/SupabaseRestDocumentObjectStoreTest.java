package com.healthcare.document.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SupabaseRestDocumentObjectStoreTest {

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {404, 503})
    void onlyConfirmedObjectNotFoundIsRecoverable(int objectStatus) throws Exception {
        com.sun.net.httpserver.HttpServer server = com.sun.net.httpserver.HttpServer.create(
                new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/storage/v1/bucket/bucket", exchange -> {
            exchange.sendResponseHeaders(200, -1); exchange.close();
        });
        server.createContext("/storage/v1/object/bucket/documents/test.pdf", exchange -> {
            exchange.sendResponseHeaders(objectStatus, 0); exchange.getResponseBody().write(new byte[] {1}); exchange.close();
        });
        server.start();
        try {
            SupabaseRestDocumentObjectStore store = new SupabaseRestDocumentObjectStore(
                    "http://127.0.0.1:" + server.getAddress().getPort(), "bucket", "synthetic-test-key", "");
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> store.get("documents/test.pdf"))
                    .isInstanceOf(objectStatus == 404 ? DocumentContentUnavailableException.class : IllegalStateException.class);
        } finally { server.stop(0); }
    }

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
