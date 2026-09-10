package com.healthcare.document.entity;

/**
 * Approved synthetic document classes per D-03/ADR-005. Nothing else may be
 * generated: legally signed records, diagnostics, and accounting receipts are
 * out of scope.
 */
public enum DocumentSourceType {
    VISIT_SUMMARY,
    PRESCRIPTION
}
