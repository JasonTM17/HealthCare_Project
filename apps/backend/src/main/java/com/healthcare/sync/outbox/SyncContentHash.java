package com.healthcare.sync.outbox;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

/** A validated SHA-256 content hash; the source content is never stored here. */
public record SyncContentHash(String value) {

    private static final Pattern SHA256 = Pattern.compile("[0-9a-fA-F]{64}");

    public SyncContentHash {
        if (value == null || !SHA256.matcher(value.trim()).matches()) {
            throw new IllegalArgumentException("contentHash must be a 64-character SHA-256 hex value");
        }
        value = value.trim().toLowerCase(Locale.ROOT);
    }

    public static SyncContentHash sha256(String canonicalContent) {
        if (canonicalContent == null) {
            throw new IllegalArgumentException("canonicalContent is required");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return new SyncContentHash(HexFormat.of().formatHex(
                digest.digest(canonicalContent.getBytes(StandardCharsets.UTF_8))
            ));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
