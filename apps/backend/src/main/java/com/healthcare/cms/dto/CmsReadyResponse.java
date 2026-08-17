package com.healthcare.cms.dto;

public record CmsReadyResponse(
    long latestEventId,
    int replayLimit,
    String snapshotFallback
) {
}
