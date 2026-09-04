package com.healthcare.media.controller;

import com.healthcare.media.dto.MediaAssetResponse;
import com.healthcare.media.entity.MediaAsset;
import com.healthcare.media.service.MediaAssetService;
import org.springframework.http.CacheControl;
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

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/media")
public class MediaAssetController {

    private final MediaAssetService mediaAssetService;

    public MediaAssetController(MediaAssetService mediaAssetService) {
        this.mediaAssetService = mediaAssetService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    public ResponseEntity<MediaAssetResponse> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "purpose", defaultValue = "GENERAL") String purpose,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {
        MediaAssetResponse response = mediaAssetService.uploadImage(file, purpose, userDetails);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getMedia(@PathVariable UUID id) {
        MediaAsset asset = mediaAssetService.getMedia(id);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(asset.getContentType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
            .contentType(mediaType)
            .contentLength(asset.getSizeBytes())
            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + asset.getFilename() + "\"")
            .body(asset.getData());
    }
}
