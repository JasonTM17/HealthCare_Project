package com.healthcare.document.service;

import java.io.IOException;

/** Confirmed missing/corrupt content, distinct from an unavailable provider. */
public class DocumentContentUnavailableException extends IOException {
    public DocumentContentUnavailableException(String message) { super(message); }
}
