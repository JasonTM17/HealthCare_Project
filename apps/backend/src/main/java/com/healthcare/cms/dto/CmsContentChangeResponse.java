package com.healthcare.cms.dto;

import java.time.OffsetDateTime;

public record CmsContentChangeResponse(
    long eventId,
    String slotKey,
    long version,
    boolean published,
    OffsetDateTime updatedAt
) {
}
