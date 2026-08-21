package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthcare.cms.config.CmsRealtimeProperties;
import com.healthcare.cms.entity.CmsContentChange;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.Message;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

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
        CmsContentChangeRepository repository = mock(CmsContentChangeRepository.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub,
            repository
        );
        when(repository.findById(42L)).thenReturn(Optional.of(change(
            42L,
            "homepage.hero",
            7L,
            true,
            true,
            OffsetDateTime.parse("2026-08-18T10:15:30Z")
        )));
        Message message = message(new CmsChangeFeedRedisMessage(
            42L,
            "tampered.slot",
            999L,
            false,
            OffsetDateTime.parse("2026-08-18T10:20:00Z"),
            "instance-a"
        ));

        subscriber.onMessage(message, null);

        verify(repository).findById(42L);
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
        CmsContentChangeRepository repository = mock(CmsContentChangeRepository.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub,
            repository
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
        verifyNoInteractions(repository);
    }

    @Test
    void unknownRemoteEventIdsAreIgnoredBeforeCacheEviction() throws Exception {
        CmsRealtimeProperties properties = properties("instance-b");
        CmsPublishedContentCache cache = mock(CmsPublishedContentCache.class);
        CmsChangeFeedHub hub = mock(CmsChangeFeedHub.class);
        CmsContentChangeRepository repository = mock(CmsContentChangeRepository.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub,
            repository
        );
        when(repository.findById(999999L)).thenReturn(Optional.empty());
        Message message = message(new CmsChangeFeedRedisMessage(
            999999L,
            "homepage.hero",
            7L,
            true,
            OffsetDateTime.parse("2026-08-18T10:15:30Z"),
            "instance-a"
        ));

        subscriber.onMessage(message, null);

        verify(repository).findById(999999L);
        verifyNoInteractions(cache, hub);
    }

    @Test
    void nonPublicCanonicalChangesAreIgnoredBeforeCacheEviction() throws Exception {
        CmsRealtimeProperties properties = properties("instance-b");
        CmsPublishedContentCache cache = mock(CmsPublishedContentCache.class);
        CmsChangeFeedHub hub = mock(CmsChangeFeedHub.class);
        CmsContentChangeRepository repository = mock(CmsContentChangeRepository.class);
        CmsChangeFeedRedisSubscriber subscriber = new CmsChangeFeedRedisSubscriber(
            objectMapper,
            properties,
            cache,
            hub,
            repository
        );
        when(repository.findById(43L)).thenReturn(Optional.of(change(
            43L,
            "homepage.hero",
            8L,
            false,
            false,
            OffsetDateTime.parse("2026-08-18T10:16:30Z")
        )));
        Message message = message(new CmsChangeFeedRedisMessage(
            43L,
            "homepage.hero",
            8L,
            false,
            OffsetDateTime.parse("2026-08-18T10:16:30Z"),
            "instance-a"
        ));

        subscriber.onMessage(message, null);

        verify(repository).findById(43L);
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

    private CmsContentChange change(
        long id,
        String slotKey,
        long version,
        boolean published,
        boolean publicEvent,
        OffsetDateTime changedAt
    ) {
        CmsContentChange change = new CmsContentChange();
        change.setId(id);
        change.setContentId(UUID.randomUUID());
        change.setSlotKey(slotKey);
        change.setContentVersion(version);
        change.setPublished(published);
        change.setPublicEvent(publicEvent);
        change.setChangedAt(changedAt);
        return change;
    }

    private CmsRealtimeProperties properties(String instanceId) {
        CmsRealtimeProperties properties = new CmsRealtimeProperties();
        properties.setInstanceId(instanceId);
        return properties;
    }
}
