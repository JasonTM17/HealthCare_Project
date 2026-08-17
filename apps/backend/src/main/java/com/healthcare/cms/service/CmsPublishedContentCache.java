package com.healthcare.cms.service;

import com.healthcare.cms.dto.CmsContentResponse;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class CmsPublishedContentCache {

    private final ConcurrentMap<String, CmsContentResponse> entries = new ConcurrentHashMap<>();

    public CmsContentResponse get(String slotKey) {
        return entries.get(slotKey);
    }

    public void put(CmsContentResponse response) {
        entries.put(response.slotKey(), response);
    }

    public void evict(String slotKey) {
        entries.remove(slotKey);
    }

    public void clear() {
        entries.clear();
    }
}
