package com.healthcare.cms.controller;

import com.healthcare.cms.dto.CmsContentRequest;
import com.healthcare.cms.dto.CmsContentResponse;
import com.healthcare.cms.dto.CmsContentHistoryResponse;
import com.healthcare.cms.dto.CmsRollbackRequest;
import com.healthcare.cms.dto.CmsDraftRequest;
import com.healthcare.cms.dto.CmsDraftResponse;
import com.healthcare.cms.dto.CmsPublishRequest;
import com.healthcare.cms.service.CmsContentService;
import com.healthcare.cms.service.CmsDraftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

@Tag(name = "CMS & Content Delivery", description = "Quản lý nội dung động, giao diện và các slot hiển thị CMS")
@RestController
@RequestMapping("/api/v1/admin/cms/content")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCmsContentController {

    private final CmsContentService contentService;
    private final CmsDraftService draftService;

    public AdminCmsContentController(CmsContentService contentService, CmsDraftService draftService) {
        this.contentService = contentService;
        this.draftService = draftService;
    }

    @Operation(summary = "Admin lấy danh sách tất cả các slot nội dung CMS", description = "Truy xuất danh sách slot nội dung động, banner, trang tĩnh kèm thông tin phân trang qua HTTP headers")
    @GetMapping
    public ResponseEntity<List<CmsContentResponse>> list(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        // HC-11: bounded window; body stays an array for the current client,
        // paging contract exposed via headers (see AdminAiCreditController).
        Page<CmsContentResponse> result = contentService.listForAdmin(page, size);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Total-Count", Long.toString(result.getTotalElements()));
        headers.set("X-Page", Integer.toString(result.getNumber()));
        headers.set("X-Page-Size", Integer.toString(result.getSize()));
        headers.set("X-Total-Pages", Integer.toString(result.getTotalPages()));
        return ResponseEntity.ok()
            .headers(headers)
            .cacheControl(CacheControl.noStore())
            .body(result.getContent());
    }

    @Operation(summary = "Admin xem chi tiết nội dung CMS theo slotKey", description = "Lấy dữ liệu cấu hình JSON, nội dung đa phương tiện của slotKey")
    @GetMapping("/{slotKey}")
    public ResponseEntity<CmsContentResponse> get(@PathVariable String slotKey) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(contentService.getForAdmin(slotKey));
    }

    @GetMapping("/{slotKey}/draft")
    public ResponseEntity<CmsDraftResponse> draft(@PathVariable String slotKey) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(draftService.get(slotKey));
    }

    @PutMapping("/{slotKey}/draft")
    public ResponseEntity<CmsDraftResponse> saveDraft(@PathVariable String slotKey,
            @Valid @RequestBody CmsDraftRequest request, @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(draftService.save(slotKey, request, actor));
    }

    @PostMapping("/{slotKey}/publish")
    public ResponseEntity<CmsDraftResponse> publish(@PathVariable String slotKey,
            @Valid @RequestBody CmsPublishRequest request, @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(draftService.publish(slotKey, request, actor));
    }

    @PostMapping("/{slotKey}/restore-draft")
    public ResponseEntity<CmsDraftResponse> restoreDraft(@PathVariable String slotKey,
            @Valid @RequestBody CmsRollbackRequest request, @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(draftService.restore(slotKey, request, actor));
    }

    @Operation(summary = "Admin cập nhật hoặc tạo mới slot nội dung CMS", description = "Tạo mới hoặc cập nhật nội dung giao diện, tự động ghi nhận phiên bản lịch sử")
    @PutMapping("/{slotKey}")
    public ResponseEntity<CmsContentResponse> upsert(
        @PathVariable String slotKey,
        @Valid @RequestBody CmsContentRequest request,
        @AuthenticationPrincipal UserDetails actor
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.upsert(slotKey, request, actor));
    }

    @Operation(summary = "Admin xem lịch sử thay đổi của slot nội dung CMS", description = "Danh sách các lần chỉnh sửa trước đây của slotKey kèm mã hash và người chỉnh sửa")
    @GetMapping("/{slotKey}/history")
    public ResponseEntity<List<CmsContentHistoryResponse>> history(
        @PathVariable String slotKey,
        @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.history(slotKey, limit));
    }

    @Operation(summary = "Admin khôi phục (rollback) nội dung CMS về phiên bản trước", description = "Khôi phục trạng thái slotKey về mã hash hoặc phiên bản cụ thể")
    @PostMapping("/{slotKey}/rollback")
    public ResponseEntity<CmsContentResponse> rollback(
        @PathVariable String slotKey,
        @Valid @RequestBody CmsRollbackRequest request,
        @AuthenticationPrincipal UserDetails actor
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.rollback(slotKey, request, actor));
    }
}
