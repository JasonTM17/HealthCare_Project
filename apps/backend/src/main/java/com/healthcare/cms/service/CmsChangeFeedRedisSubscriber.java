package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.cms.config.CmsRealtimeProperties;
import com.healthcare.cms.dto.CmsContentChangeResponse;
import com.healthcare.cms.entity.CmsContentChange;
import com.healthcare.cms.repository.CmsContentChangeRepository;
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
    private final CmsContentChangeRepository changeRepository;

    public CmsChangeFeedRedisSubscriber(
        ObjectMapper objectMapper,
        CmsRealtimeProperties properties,
        CmsPublishedContentCache cache,
        CmsChangeFeedHub changeFeedHub,
        CmsContentChangeRepository changeRepository
    ) {
        this.objectMapper = objectMapper;
        this.properties = properties;
        this.cache = cache;
        this.changeFeedHub = changeFeedHub;
        this.changeRepository = changeRepository;
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
            if (!isValidBrokerChange(change)) {
                log.warn("CMS realtime broker message was ignored because it failed structural validation");
                return;
            }
            changeRepository.findById(change.eventId())
                .filter(CmsContentChange::isPublicEvent)
                .filter(canonical -> CmsPublicSlotKeys.isAllowed(canonical.getSlotKey()))
                .ifPresentOrElse(this::publishCanonicalChange, () ->
                    log.warn("CMS realtime broker message was ignored because it did not match a public change")
                );
        } catch (IOException | RuntimeException exception) {
            log.warn("CMS realtime broker message was ignored because it was invalid");
        }
    }

    private boolean isValidBrokerChange(CmsChangeFeedRedisMessage change) {
        return change.eventId() > 0
            && change.originInstanceId() != null
            && !change.originInstanceId().isBlank();
    }

    private void publishCanonicalChange(CmsContentChange change) {
        cache.evict(change.getSlotKey());
        changeFeedHub.publish(new CmsContentChangeResponse(
            change.getId(),
            change.getSlotKey(),
            change.getContentVersion(),
            change.isPublished(),
            change.getChangedAt()
        ));
    }
}
