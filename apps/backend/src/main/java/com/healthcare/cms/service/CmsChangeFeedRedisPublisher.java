package com.healthcare.cms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.cms.config.CmsRealtimeProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "cms.realtime", name = "distributed-enabled", havingValue = "true")
public class CmsChangeFeedRedisPublisher {

    private static final Logger log = LoggerFactory.getLogger(CmsChangeFeedRedisPublisher.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final CmsRealtimeProperties properties;

    public CmsChangeFeedRedisPublisher(
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        CmsRealtimeProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public void publish(CmsContentChangedEvent event) {
        CmsChangeFeedRedisMessage message = new CmsChangeFeedRedisMessage(
            event.eventId(),
            event.slotKey(),
            event.version(),
            event.published(),
            event.updatedAt(),
            properties.getInstanceId()
        );
        try {
            redisTemplate.convertAndSend(properties.getChannel(), objectMapper.writeValueAsString(message));
        } catch (JsonProcessingException | RuntimeException exception) {
            // PostgreSQL is the durable cursor and the public client already has
            // bounded replay/polling recovery. Redis is a low-latency fan-out
            // signal; a broker outage must not roll back a committed CMS edit.
            log.warn("CMS realtime broker publish failed; database replay remains available");
        }
    }
}
