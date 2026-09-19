package com.healthcare.cms.controller;

import com.healthcare.cms.service.CmsChangeFeedHub;
import com.healthcare.cms.service.CmsContentService;
import com.healthcare.cms.dto.CmsContentResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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

@Tag(name = "CMS & Content Delivery", description = "Quản lý nội dung động, giao diện và các slot hiển thị CMS")
@RestController
@RequestMapping("/api/v1/cms/content")
public class CmsContentController {

    private final CmsContentService contentService;
    private final CmsChangeFeedHub changeFeedHub;

    public CmsContentController(CmsContentService contentService, CmsChangeFeedHub changeFeedHub) {
        this.contentService = contentService;
        this.changeFeedHub = changeFeedHub;
    }

    @Operation(summary = "Lấy danh sách các slot nội dung đã xuất bản", description = "Danh sách các slot giao diện, banner trang chủ đang ở trạng thái PUBLISHED")
    @GetMapping
    public ResponseEntity<List<CmsContentResponse>> listPublished() {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.listPublished());
    }

    @Operation(summary = "Lấy nội dung slot CMS công khai theo slotKey", description = "Truy xuất nội dung JSON của slotKey đã xuất bản để hiển thị trên frontend")
    @GetMapping("/{slotKey}")
    public ResponseEntity<CmsContentResponse> getPublished(
        @PathVariable String slotKey,
        @RequestParam(value = "afterEventId", required = false) Long afterEventId
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.getPublished(slotKey, afterEventId));
    }

    @Operation(summary = "Đăng ký nhận luồng sự kiện Server-Sent Events (SSE) của CMS", description = "Mở kết nối SSE theo thời gian thực để nhận cập nhật ngay lập tức khi banner hoặc nội dung CMS thay đổi")
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
