package com.healthcare.cms.controller;

import com.healthcare.cms.service.CmsChangeFeedHub;
import com.healthcare.cms.service.CmsContentService;
import com.healthcare.cms.dto.CmsContentResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cms/content")
public class CmsContentController {

    private final CmsContentService contentService;
    private final CmsChangeFeedHub changeFeedHub;

    public CmsContentController(CmsContentService contentService, CmsChangeFeedHub changeFeedHub) {
        this.contentService = contentService;
        this.changeFeedHub = changeFeedHub;
    }

    @GetMapping
    public ResponseEntity<List<CmsContentResponse>> listPublished() {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.listPublished());
    }

    @GetMapping("/{slotKey}")
    public ResponseEntity<CmsContentResponse> getPublished(@PathVariable String slotKey) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.getPublished(slotKey));
    }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> events(
        @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId,
        @RequestParam(value = "after", required = false) String after
    ) {
        Long cursor = parseCursor(after != null ? after : lastEventId);
        SseEmitter emitter = changeFeedHub.open(cursor);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Accel-Buffering", "no")
            .body(emitter);
    }

    private Long parseCursor(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            long cursor = Long.parseLong(value);
            return cursor >= 0 ? cursor : null;
        } catch (NumberFormatException ex) {
            // A malformed reconnect cursor is safe to treat as a fresh snapshot request.
            return null;
        }
    }
}
