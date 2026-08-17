package com.healthcare.cms.service;

import java.time.OffsetDateTime;

public record CmsContentChangedEvent(
    long eventId,
    String slotKey,
    long version,
    boolean published,
    OffsetDateTime updatedAt
) {
}
