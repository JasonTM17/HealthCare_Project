package com.healthcare.cms.dto;

import java.time.OffsetDateTime;

public record CmsHeartbeatResponse(OffsetDateTime at, long latestEventId) {
}
