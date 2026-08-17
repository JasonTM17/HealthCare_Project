package com.healthcare.cms.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsPublicationStatus;

import java.time.OffsetDateTime;

public record CmsContentResponse(
    String slotKey,
    CmsComponentType componentType,
    JsonNode payload,
    CmsPublicationStatus status,
    long version,
    OffsetDateTime updatedAt
) {
    public CmsContentResponse {
        payload = payload == null ? null : payload.deepCopy();
    }
}
