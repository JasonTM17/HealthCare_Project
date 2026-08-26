package com.healthcare.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

/**
 * Converts provider-style PostgreSQL URLs (for example Render's
 * {@code postgres://...}) to the JDBC form required by Spring/Hikari.
 *
 * <p>Render also exposes username and password as separate blueprint values.
 * User-info is therefore deliberately removed from the resulting JDBC URL so
 * credentials cannot be copied into datasource diagnostics or exception
 * messages.</p>
 */
public final class DatabaseUrlNormalizer {

    private static final Set<String> CREDENTIAL_QUERY_KEYS = Set.of(
        "user", "username", "password", "passwd", "pass", "token", "secret",
        "apikey", "api_key", "access_token", "access_key", "secret_key",
        "sslpassword", "private_key", "client_secret", "credential", "credentials"
    );

    private DatabaseUrlNormalizer() {
    }

    public static String normalize(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return rawUrl;
        }
        String trimmed = rawUrl.trim();
        if (trimmed.regionMatches(true, 0, "jdbc:", 0, "jdbc:".length())) {
            return trimmed;
        }

        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            if (hasPostgresScheme(trimmed)) {
                throw new IllegalArgumentException("DATABASE_URL is not a valid PostgreSQL URL", ex);
            }
            return trimmed;
        }
        if (!isPostgresScheme(uri.getScheme())) {
            return trimmed;
        }
        if (uri.getRawFragment() != null || uri.getRawAuthority() == null
                || uri.getRawAuthority().isBlank()) {
            throw new IllegalArgumentException("DATABASE_URL is not a valid PostgreSQL URL");
        }
        // URI accepts an authority such as `user:password` even though it is
        // not a host. Reject it before copying the authority into JDBC; this
        // prevents malformed credential-like authorities from being leaked.
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("DATABASE_URL is not a valid PostgreSQL URL");
        }

        // Keep host/port (and IPv6 brackets) but never carry user-info into a
        // JDBC URL. Render supplies credentials through discrete env vars.
        String authority = uri.getRawAuthority();
        int userInfoSeparator = authority.lastIndexOf('@');
        if (userInfoSeparator >= 0) {
            authority = authority.substring(userInfoSeparator + 1);
        }
        if (authority.isBlank()) {
            throw new IllegalArgumentException("DATABASE_URL is not a valid PostgreSQL URL");
        }

        String path = uri.getRawPath();
        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
            .append(authority)
            .append(path == null ? "" : path);
        String rawQuery = uri.getRawQuery();
        if (rawQuery != null && !rawQuery.isBlank()) {
            rejectCredentialQueryParameters(rawQuery);
            jdbc.append('?').append(rawQuery);
        }
        return jdbc.toString();
    }

    private static void rejectCredentialQueryParameters(String rawQuery) {
        String decodedQuery;
        try {
            decodedQuery = URLDecoder.decode(rawQuery, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("DATABASE_URL is not a valid PostgreSQL URL", ex);
        }
        String lowerQuery = decodedQuery.toLowerCase(Locale.ROOT);
        for (String parameter : decodedQuery.split("[&;]", -1)) {
            String key = parameter;
            int separator = parameter.indexOf('=');
            if (separator >= 0) {
                key = parameter.substring(0, separator);
            }
            if (CREDENTIAL_QUERY_KEYS.contains(key.trim().toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException(
                    "DATABASE_URL must not contain credential query parameters");
            }
        }
        // PostgreSQL's `options` parameter can carry nested `password=` or
        // `secret=` assignments, so inspect the decoded query as a whole too.
        if (lowerQuery.matches(".*(?:^|[&;\\s])(?:user|username|password|passwd|pass|token|secret|apikey|api_key|access[_-]?token|access[_-]?key|secret[_-]?key|sslpassword|private[_-]?key|client[_-]?secret|credentials?)\\s*=.*")
                || lowerQuery.matches(".*(?:password|passwd|secret|access[_-]?(?:token|key)|sslpassword|private[_-]?key|client[_-]?secret|credentials?)\\s*=.*")) {
            throw new IllegalArgumentException(
                "DATABASE_URL must not contain credential query parameters");
        }
    }

    private static boolean isPostgresScheme(String scheme) {
        return scheme != null && ("postgres".equalsIgnoreCase(scheme)
            || "postgresql".equalsIgnoreCase(scheme));
    }

    private static boolean hasPostgresScheme(String rawUrl) {
        String lower = rawUrl == null ? "" : rawUrl.toLowerCase(Locale.ROOT);
        return lower.startsWith("postgres://") || lower.startsWith("postgresql://");
    }
}
