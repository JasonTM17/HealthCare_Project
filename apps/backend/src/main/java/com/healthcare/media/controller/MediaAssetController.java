package com.healthcare.media.controller;

import com.healthcare.media.dto.MediaAssetResponse;
import com.healthcare.media.entity.MediaAsset;
import com.healthcare.media.service.MediaAssetService;
import com.healthcare.media.service.MediaAssetService.MediaAssetContent;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ, bài viết)")
@RestController
@RequestMapping("/api/v1/media")
public class MediaAssetController {

    private final MediaAssetService mediaAssetService;

    public MediaAssetController(MediaAssetService mediaAssetService) {
        this.mediaAssetService = mediaAssetService;
    }

    @Operation(summary = "Tải lên tệp đa phương tiện", description = "Tải lên hình ảnh bác sĩ, chứng chỉ chuyên môn, hoặc ảnh minh họa bài viết y khoa")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<MediaAssetResponse> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "purpose", defaultValue = "GENERAL") String purpose,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {
        MediaAssetResponse response = mediaAssetService.uploadImage(file, purpose, userDetails);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Tải dữ liệu tệp đa phương tiện", description = "Truy xuất nội dung tệp hình ảnh theo ID")
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getMedia(@PathVariable UUID id) {
        MediaAssetContent content = mediaAssetService.getMediaContent(id);
        MediaAsset asset = content.asset();
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(asset.getContentType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        // Public catalog portraits legitimately render these URLs, so the GET
        // stays public; a bounded TTL keeps a removed asset from lingering in
        // shared caches for up to a year.
        String safeFilename = asset.getFilename() == null ? "asset" : asset.getFilename();
        return ResponseEntity.ok()
            .contentType(mediaType)
            .contentLength(content.bytes().length)
            .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.inline().filename(safeFilename, StandardCharsets.UTF_8).build().toString())
            .body(content.bytes());
    }
}
