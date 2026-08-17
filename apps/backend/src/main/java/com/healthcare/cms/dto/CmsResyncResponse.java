package com.healthcare.cms.dto;

public record CmsResyncResponse(
    long latestEventId,
    String reason,
    String snapshotFallback
) {
}
