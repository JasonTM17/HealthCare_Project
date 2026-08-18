package com.healthcare.cms.service;

import java.time.OffsetDateTime;

record CmsChangeFeedRedisMessage(
    long eventId,
    String slotKey,
    long version,
    boolean published,
    OffsetDateTime updatedAt,
    String originInstanceId
) {
}
