package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.node.TextNode;
import com.healthcare.cms.dto.CmsContentResponse;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsPublicationStatus;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

class CmsPublishedContentCacheTest {

    private static final String SLOT_KEY = "homepage.hero";

    @Test
    void staleReadCannotRepopulateAfterEviction() {
        CmsPublishedContentCache cache = new CmsPublishedContentCache();
        CmsPublishedContentCache.ReadToken staleRead = cache.beginRead(SLOT_KEY);
        CmsContentResponse staleResponse = response("old");

        cache.evict(SLOT_KEY);
        cache.put(staleRead, staleResponse, 1L);

        assertNull(cache.get(SLOT_KEY));
    }

    @Test
    void currentReadCanPopulateAfterAnEarlierEviction() {
        CmsPublishedContentCache cache = new CmsPublishedContentCache();
        cache.evict(SLOT_KEY);
        CmsPublishedContentCache.ReadToken currentRead = cache.beginRead(SLOT_KEY);
        CmsContentResponse currentResponse = response("current");

        cache.put(currentRead, currentResponse, 1L);

        assertSame(currentResponse, cache.get(SLOT_KEY));
    }

    private CmsContentResponse response(String body) {
        return new CmsContentResponse(
            SLOT_KEY,
            CmsComponentType.HERO,
            TextNode.valueOf(body),
            CmsPublicationStatus.PUBLISHED,
            1L,
            OffsetDateTime.parse("2026-08-18T00:00:00Z")
        );
    }
}
