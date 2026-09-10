package com.healthcare.document.service;

import java.io.InputStream;

/**
 * Storage boundary for generated document objects (ADR-005). Implementations
 * keep the bucket contract identical to {@code FileStorageService}: private
 * objects, no public policies, no presigned URLs for documents.
 */
public interface DocumentObjectStore {

    void put(String objectKey, byte[] content, String contentType) throws Exception;

    /**
     * Stream the object; the caller must close the returned stream.
     */
    InputStream get(String objectKey) throws Exception;

    /**
     * Delete a generated object after a failed database finalization. Cleanup is
     * best effort; callers keep the original failure authoritative.
     */
    void delete(String objectKey) throws Exception;

    boolean isConfigured();
}
