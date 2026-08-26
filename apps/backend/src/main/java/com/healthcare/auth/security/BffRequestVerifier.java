package com.healthcare.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class BffRequestVerifier {

    public static final String CREDENTIAL_HEADER = "X-Healthcare-Bff-Token";
    public static final String ORIGINAL_ORIGIN_HEADER = "X-Healthcare-Original-Origin";
    public static final String CLIENT_IP_HEADER = "X-Healthcare-Client-IP";

    private static final Set<String> LEGACY_BEARER_MINT_PATHS = Set.of(
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/email-verifications/confirm",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/confirm-email"
    );

    private final byte[] configuredCredential;
    private final Set<String> allowedOrigins;

    public BffRequestVerifier(Environment environment) {
        String credential = environment.getProperty("app.security.bff.service-token", "").trim();
        this.configuredCredential = credential.getBytes(StandardCharsets.UTF_8);
        boolean required = environment.getProperty("app.security.bff.required", Boolean.class, false);
        if (configuredCredential.length > 0 && configuredCredential.length < 32) {
            throw new IllegalStateException("BFF service credential must be at least 32 bytes");
        }
        if (required && configuredCredential.length == 0) {
            throw new IllegalStateException("BFF service credential is required");
        }
        this.allowedOrigins = Arrays.stream(
                environment.getProperty("app.security.bff.allowed-origins", "http://localhost:3000").split(","))
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .map(this::normalizeOrigin)
            .collect(Collectors.toUnmodifiableSet());
    }

    public static boolean isLegacyBearerMintRoute(String method, String requestUri) {
        return "POST".equals(method) && LEGACY_BEARER_MINT_PATHS.contains(requestUri);
    }

    public boolean hasPresentedCredential(HttpServletRequest request) {
        return request.getHeaders(CREDENTIAL_HEADER).hasMoreElements();
    }

    public boolean isTrusted(HttpServletRequest request) {
        if (configuredCredential.length == 0) return false;
        Optional<String> presentedHeader = singleHeader(request, CREDENTIAL_HEADER);
        if (presentedHeader.isEmpty()) return false;
        return MessageDigest.isEqual(
            configuredCredential,
            presentedHeader.get().getBytes(StandardCharsets.UTF_8)
        );
    }

    /**
     * Returns a canonical IP key only when it came from an authenticated BFF.
     * Parsing is deliberately local and numeric-only: hostnames, ports, CIDR,
     * zone identifiers and forwarded chains are rejected without DNS lookup.
     */
    public Optional<String> trustedClientIpLiteral(HttpServletRequest request) {
        if (!isTrusted(request)) return Optional.empty();
        return singleHeader(request, CLIENT_IP_HEADER).flatMap(this::normalizeIpLiteral);
    }

    public boolean hasAllowedOrigin(HttpServletRequest request, boolean trustedBff) {
        Optional<String> originHeader = singleHeader(
            request,
            trustedBff ? ORIGINAL_ORIGIN_HEADER : "Origin"
        );
        if (originHeader.isEmpty()) return false;
        String rawOrigin = originHeader.get();
        if (rawOrigin == null || rawOrigin.isBlank()) return false;
        try {
            return allowedOrigins.contains(normalizeOrigin(rawOrigin));
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private String normalizeOrigin(String value) {
        URI uri = URI.create(value.trim());
        String scheme = uri.getScheme();
        if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                || uri.getHost() == null
                || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null
                || (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !"/".equals(uri.getRawPath()))) {
            throw new IllegalArgumentException("Invalid origin");
        }
        int port = uri.getPort();
        boolean defaultPort = port == -1
            || ("http".equalsIgnoreCase(scheme) && port == 80)
            || ("https".equalsIgnoreCase(scheme) && port == 443);
        return scheme.toLowerCase() + "://" + uri.getHost().toLowerCase()
            + (defaultPort ? "" : ":" + port);
    }

    private Optional<String> singleHeader(HttpServletRequest request, String name) {
        List<String> values = Collections.list(request.getHeaders(name));
        if (values.size() != 1) return Optional.empty();
        String value = values.getFirst();
        return value == null ? Optional.empty() : Optional.of(value);
    }

    private Optional<String> normalizeIpLiteral(String value) {
        if (value.isEmpty() || !value.equals(value.trim()) || value.length() > 45) {
            return Optional.empty();
        }
        if (value.indexOf(':') >= 0) return normalizeIpv6Literal(value);
        int[] octets = parseIpv4(value);
        if (octets == null) return Optional.empty();
        return Optional.of("ipv4:" + octets[0] + '.' + octets[1] + '.' + octets[2] + '.' + octets[3]);
    }

    private Optional<String> normalizeIpv6Literal(String value) {
        if (value.indexOf('%') >= 0 || value.indexOf('[') >= 0 || value.indexOf(']') >= 0) {
            return Optional.empty();
        }

        int compressionIndex = value.indexOf("::");
        if (compressionIndex != value.lastIndexOf("::")) return Optional.empty();
        boolean compressed = compressionIndex >= 0;
        String left = compressed ? value.substring(0, compressionIndex) : value;
        String right = compressed ? value.substring(compressionIndex + 2) : "";
        List<String> leftTokens = splitIpv6Side(left);
        List<String> rightTokens = splitIpv6Side(right);
        if (leftTokens == null || rightTokens == null) return Optional.empty();

        List<String> tokens = new ArrayList<>(leftTokens.size() + rightTokens.size());
        tokens.addAll(leftTokens);
        tokens.addAll(rightTokens);
        List<List<Integer>> parsedTokens = new ArrayList<>(tokens.size());
        int unitCount = 0;
        for (int index = 0; index < tokens.size(); index++) {
            String token = tokens.get(index);
            if (token.indexOf('.') >= 0) {
                if (index != tokens.size() - 1) return Optional.empty();
                int[] octets = parseIpv4(token);
                if (octets == null) return Optional.empty();
                parsedTokens.add(List.of(
                    (octets[0] << 8) | octets[1],
                    (octets[2] << 8) | octets[3]
                ));
                unitCount += 2;
            } else {
                if (token.isEmpty() || token.length() > 4) return Optional.empty();
                for (int character = 0; character < token.length(); character++) {
                    if (Character.digit(token.charAt(character), 16) < 0) return Optional.empty();
                }
                parsedTokens.add(List.of(Integer.parseInt(token, 16)));
                unitCount += 1;
            }
        }

        if ((!compressed && unitCount != 8) || (compressed && unitCount >= 8)) {
            return Optional.empty();
        }

        List<Integer> units = new ArrayList<>(8);
        for (int index = 0; index < leftTokens.size(); index++) {
            units.addAll(parsedTokens.get(index));
        }
        if (compressed) {
            for (int missing = 0; missing < 8 - unitCount; missing++) units.add(0);
        }
        for (int index = leftTokens.size(); index < parsedTokens.size(); index++) {
            units.addAll(parsedTokens.get(index));
        }
        if (units.size() != 8) return Optional.empty();

        return Optional.of("ipv6:" + units.stream()
            .map(unit -> String.format(Locale.ROOT, "%04x", unit))
            .collect(Collectors.joining(":")));
    }

    private List<String> splitIpv6Side(String value) {
        if (value.isEmpty()) return List.of();
        String[] tokens = value.split(":", -1);
        if (Arrays.stream(tokens).anyMatch(String::isEmpty)) return null;
        return List.of(tokens);
    }

    private int[] parseIpv4(String value) {
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) return null;
        int[] octets = new int[4];
        for (int index = 0; index < parts.length; index++) {
            String part = parts[index];
            if (part.isEmpty() || part.length() > 3 || (part.length() > 1 && part.charAt(0) == '0')) {
                return null;
            }
            int octet = 0;
            for (int character = 0; character < part.length(); character++) {
                char digit = part.charAt(character);
                if (digit < '0' || digit > '9') return null;
                octet = octet * 10 + (digit - '0');
            }
            if (octet > 255) return null;
            octets[index] = octet;
        }
        return octets;
    }
}
