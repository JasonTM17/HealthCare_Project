package com.healthcare.storage;

/**
 * Unpackaged defaults must not enable generic upload without AV.
 * The explicit {@code storage.allow-unscanned-upload} escape is for disposable
 * tests that exercise MIME/MinIO without a scanner — never for hosted runtimes.
 */
public final class FailClosedStoragePolicy {

    private FailClosedStoragePolicy() {
    }

    public static void validate(boolean uploadEnabled, boolean avRequired, boolean allowUnscannedUpload) {
        if (uploadEnabled && !avRequired && !allowUnscannedUpload) {
            throw new IllegalStateException(
                "STORAGE_UPLOAD_ENABLED requires STORAGE_AV_REQUIRED unless STORAGE_ALLOW_UNSCANNED_UPLOAD is an explicit escape"
            );
        }
    }
}
