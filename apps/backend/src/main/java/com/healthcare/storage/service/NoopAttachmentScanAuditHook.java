package com.healthcare.storage.service;

import org.springframework.stereotype.Component;

/** Default hook keeps audit persistence optional while retaining call sites. */
@Component
public class NoopAttachmentScanAuditHook implements AttachmentScanAuditHook {
}
