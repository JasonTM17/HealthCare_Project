package com.healthcare.storage.service;

/**
 * Scanner/AV seam for private attachments.  Implementations must not infer
 * CLEAN from a client request; they receive the bytes fetched by the trusted
 * backend after object-store verification.
 */
public interface AttachmentScanner {

    ScanResult scan(ScanRequest request);

    record ScanRequest(String objectKey, String mimeType, long sizeBytes, byte[] content) {
        public ScanRequest {
            content = content == null ? new byte[0] : content.clone();
        }

        @Override
        public byte[] content() {
            return content.clone();
        }
    }

    enum Verdict {
        CLEAN,
        INFECTED,
        UNAVAILABLE,
        ERROR
    }

    record ScanResult(Verdict verdict, String signature) {
        public static ScanResult clean() {
            return new ScanResult(Verdict.CLEAN, null);
        }

        public static ScanResult infected(String signature) {
            return new ScanResult(Verdict.INFECTED, signature);
        }

        public static ScanResult unavailable(String reason) {
            return new ScanResult(Verdict.UNAVAILABLE, reason);
        }

        public static ScanResult error(String reason) {
            return new ScanResult(Verdict.ERROR, reason);
        }
    }
}
