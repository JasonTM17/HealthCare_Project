package com.healthcare.storage.service;


/**
 * Safe default when no AV/scanner adapter has been provisioned.  Returning
 * UNAVAILABLE keeps the object quarantined and prevents a download.
 */
public class UnavailableAttachmentScanner implements AttachmentScanner {

    @Override
    public ScanResult scan(ScanRequest request) {
        return ScanResult.unavailable("scanner-not-configured");
    }
}
