package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.cms.config.CmsRealtimeProperties;
import com.healthcare.cms.dto.CmsContentChangeResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@ConditionalOnProperty(prefix = "cms.realtime", name = "distributed-enabled", havingValue = "true")
public class CmsChangeFeedRedisSubscriber implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(CmsChangeFeedRedisSubscriber.class);

    private final ObjectMapper objectMapper;
    private final CmsRealtimeProperties properties;
    private final CmsPublishedContentCache cache;
    private final CmsChangeFeedHub changeFeedHub;

    public CmsChangeFeedRedisSubscriber(
        ObjectMapper objectMapper,
        CmsRealtimeProperties properties,
        CmsPublishedContentCache cache,
        CmsChangeFeedHub changeFeedHub
    ) {
        this.objectMapper = objectMapper;
        this.properties = properties;
        this.cache = cache;
        this.changeFeedHub = changeFeedHub;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            CmsChangeFeedRedisMessage change = objectMapper.readValue(
                message.getBody(),
                CmsChangeFeedRedisMessage.class
            );
            if (properties.getInstanceId().equals(change.originInstanceId())) {
                return;
            }
            cache.evict(change.slotKey());
            changeFeedHub.publish(new CmsContentChangeResponse(
                change.eventId(),
                change.slotKey(),
                change.version(),
                change.published(),
                change.updatedAt()
            ));
        } catch (IOException | RuntimeException exception) {
            log.warn("CMS realtime broker message was ignored because it was invalid");
        }
    }
}
