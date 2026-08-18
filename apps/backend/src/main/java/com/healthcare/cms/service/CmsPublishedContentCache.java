package com.healthcare.cms.service;

import com.healthcare.cms.dto.CmsContentResponse;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class CmsPublishedContentCache {

    private final ConcurrentMap<String, CachedContent> entries = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> slotGenerations = new ConcurrentHashMap<>();
    private long clearGeneration;

    public synchronized CmsContentResponse get(String slotKey) {
        CachedContent cached = entries.get(slotKey);
        return cached == null ? null : cached.response();
    }

    public synchronized CachedContent getEntry(String slotKey) {
        return entries.get(slotKey);
    }

    /** Captures the invalidation boundary before a repository read begins. */
    public synchronized ReadToken beginRead(String slotKey) {
        return new ReadToken(
            slotKey,
            clearGeneration,
            slotGenerations.getOrDefault(slotKey, 0L)
        );
    }

    /**
     * Publishes a read result only if no eviction or clear crossed its read
     * boundary. This prevents a slow cache miss from resurrecting a snapshot
     * after an unpublish event evicted the slot.
     */
    public synchronized void put(ReadToken token, CmsContentResponse response, long eventId) {
        if (!token.slotKey().equals(response.slotKey())
            || token.clearGeneration() != clearGeneration
            || token.slotGeneration() != slotGenerations.getOrDefault(response.slotKey(), 0L)) {
            return;
        }
        entries.put(response.slotKey(), new CachedContent(response, eventId));
    }

    /** Test/fixture hook for seeding an explicit cache snapshot. */
    public synchronized void put(CmsContentResponse response) {
        put(response, 0L);
    }

    /** Test/fixture hook for seeding a snapshot at a durable event watermark. */
    public synchronized void put(CmsContentResponse response, long eventId) {
        entries.put(response.slotKey(), new CachedContent(response, eventId));
    }

    public synchronized void evict(String slotKey) {
        slotGenerations.merge(slotKey, 1L, Long::sum);
        entries.remove(slotKey);
    }

    public synchronized void clear() {
        clearGeneration++;
        entries.clear();
        slotGenerations.clear();
    }

    public record ReadToken(String slotKey, long clearGeneration, long slotGeneration) {
    }

    public record CachedContent(CmsContentResponse response, long eventId) {
    }
}
