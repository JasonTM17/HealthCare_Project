package com.healthcare.cms.service;

import com.healthcare.cms.dto.CmsContentChangeResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class CmsContentChangePublisher {

    private final CmsPublishedContentCache cache;
    private final CmsChangeFeedHub changeFeedHub;
    private final ObjectProvider<CmsChangeFeedRedisPublisher> distributedPublisher;

    public CmsContentChangePublisher(
        CmsPublishedContentCache cache,
        CmsChangeFeedHub changeFeedHub,
        ObjectProvider<CmsChangeFeedRedisPublisher> distributedPublisher
    ) {
        this.cache = cache;
        this.changeFeedHub = changeFeedHub;
        this.distributedPublisher = distributedPublisher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publishAfterCommit(CmsContentChangedEvent event) {
        cache.evict(event.slotKey());
        CmsContentChangeResponse response = new CmsContentChangeResponse(
            event.eventId(),
            event.slotKey(),
            event.version(),
            event.published(),
            event.updatedAt()
        );
        changeFeedHub.publish(response);
        distributedPublisher.ifAvailable(publisher -> publisher.publish(event));
    }
}
