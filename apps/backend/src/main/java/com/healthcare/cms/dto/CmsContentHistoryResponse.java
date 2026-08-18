package com.healthcare.cms.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsPublicationStatus;

import java.time.OffsetDateTime;

public record CmsContentHistoryResponse(
    long eventId,
    String slotKey,
    CmsComponentType componentType,
    CmsPublicationStatus status,
    JsonNode payload,
    long version,
    String actorEmail,
    OffsetDateTime changedAt,
    boolean rollbackAvailable
) {
}
