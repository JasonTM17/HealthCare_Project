package com.healthcare.cms.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.entity.CmsComponentType;
import java.time.OffsetDateTime;

/** Row version is the administrative write token; publicContent has its own frozen revision. */
public record CmsDraftResponse(
    String slotKey,
    long expectedVersion,
    boolean hasDraft,
    CmsComponentType componentType,
    JsonNode payload,
    OffsetDateTime draftUpdatedAt,
    CmsContentResponse publicContent
) {
    public CmsDraftResponse {
        payload = payload == null ? null : payload.deepCopy();
    }
}
