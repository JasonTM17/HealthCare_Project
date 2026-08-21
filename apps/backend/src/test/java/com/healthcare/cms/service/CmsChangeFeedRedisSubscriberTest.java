package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthcare.cms.config.CmsRealtimeProperties;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.Message;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CmsChangeFeedRedisSubscriberTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void remoteMessageEvictsCacheAndPublishesMetadataOnly() throws Exception {
        CmsRealtimeProperties properties = properties("instance-b");
        CmsPublishedContentCache cache = mock(CmsPublishedContentCache.class);
        CmsChangeFeedHub hub = mock(CmsChangeFeedHub.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub
        );
        Message message = message(new CmsChangeFeedRedisMessage(
            42L,
            "homepage.hero",
            7L,
            true,
            OffsetDateTime.parse("2026-08-18T10:15:30Z"),
            "instance-a"
        ));

        subscriber.onMessage(message, null);

        verify(cache).evict("homepage.hero");
        verify(hub).publish(new com.healthcare.cms.dto.CmsContentChangeResponse(
            42L,
            "homepage.hero",
            7L,
            true,
            OffsetDateTime.parse("2026-08-18T10:15:30Z")
        ));
    }

    @Test
    void ownBrokerEchoIsIgnoredBecauseLocalAfterCommitAlreadyBroadcast() throws Exception {
        CmsRealtimeProperties properties = properties("instance-a");
        CmsPublishedContentCache cache = mock(CmsPublishedContentCache.class);
        CmsChangeFeedHub hub = mock(CmsChangeFeedHub.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub
        );
        Message message = message(new CmsChangeFeedRedisMessage(
            42L,
            "homepage.hero",
            7L,
            true,
            OffsetDateTime.parse("2026-08-18T10:15:30Z"),
            "instance-a"
        ));

        subscriber.onMessage(message, null);

        verify(cache, never()).evict("homepage.hero");
        verify(hub, never()).publish(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void structurallyInvalidRemoteMessagesAreIgnoredBeforeCacheEviction() throws Exception {
        CmsRealtimeProperties properties = properties("instance-b");
        CmsPublishedContentCache cache = mock(CmsPublishedContentCache.class);
        CmsChangeFeedHub hub = mock(CmsChangeFeedHub.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub
        );
        Message message = message("""
            {
              "eventId": 42,
              "slotKey": "patient.dashboard.hero",
              "version": 7,
              "published": true,
              "updatedAt": "2026-08-18T10:15:30Z",
              "originInstanceId": "instance-a"
            }
            """);

        subscriber.onMessage(message, null);

        verifyNoInteractions(cache, hub);
    }

    private Message message(CmsChangeFeedRedisMessage change) throws Exception {
        return message(objectMapper.writeValueAsString(change));
    }

    private Message message(String body) {
        Message message = mock(Message.class);
        when(message.getBody()).thenReturn(body.getBytes(StandardCharsets.UTF_8));
        return message;
    }

    private CmsRealtimeProperties properties(String instanceId) {
        CmsRealtimeProperties properties = new CmsRealtimeProperties();
        properties.setInstanceId(instanceId);
        return properties;
    }
}
