package com.healthcare.cms.service;

import com.healthcare.cms.dto.CmsContentChangeResponse;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class CmsContentChangePublisher {

    private final CmsPublishedContentCache cache;
    private final CmsChangeFeedHub changeFeedHub;

    public CmsContentChangePublisher(CmsPublishedContentCache cache, CmsChangeFeedHub changeFeedHub) {
        this.cache = cache;
        this.changeFeedHub = changeFeedHub;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publishAfterCommit(CmsContentChangedEvent event) {
        cache.evict(event.slotKey());
        changeFeedHub.publish(new CmsContentChangeResponse(
            event.eventId(),
            event.slotKey(),
            event.version(),
            event.published(),
            event.updatedAt()
        ));
    }
}
