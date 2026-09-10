package com.healthcare.cms.controller;

import com.healthcare.cms.dto.CmsContentRequest;
import com.healthcare.cms.dto.CmsContentResponse;
import com.healthcare.cms.dto.CmsContentHistoryResponse;
import com.healthcare.cms.dto.CmsRollbackRequest;
import com.healthcare.cms.service.CmsContentService;
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

@RestController
@RequestMapping("/api/v1/admin/cms/content")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCmsContentController {

    private final CmsContentService contentService;

    public AdminCmsContentController(CmsContentService contentService) {
        this.contentService = contentService;
    }

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
        headers.set("X-Total-Pages", Integer.toString(result.getTotalPages()));
        return ResponseEntity.ok()
            .headers(headers)
            .cacheControl(CacheControl.noStore())
            .body(result.getContent());
    }

    @GetMapping("/{slotKey}")
    public ResponseEntity<CmsContentResponse> get(@PathVariable String slotKey) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(contentService.getForAdmin(slotKey));
    }

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

    @GetMapping("/{slotKey}/history")
    public ResponseEntity<List<CmsContentHistoryResponse>> history(
        @PathVariable String slotKey,
        @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(contentService.history(slotKey, limit));
    }

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
