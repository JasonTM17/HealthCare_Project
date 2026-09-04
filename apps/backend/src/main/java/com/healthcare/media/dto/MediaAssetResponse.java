package com.healthcare.media.dto;

import com.healthcare.media.entity.MediaAsset;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MediaAssetResponse(
    UUID id,
    String url,
    String filename,
    String contentType,
    long sizeBytes,
    String purpose,
    OffsetDateTime createdAt
) {
    public static MediaAssetResponse from(MediaAsset asset) {
        return new MediaAssetResponse(
            asset.getId(),
            "/api/v1/media/" + asset.getId(),
            asset.getFilename(),
            asset.getContentType(),
            asset.getSizeBytes(),
            asset.getPurpose(),
            asset.getCreatedAt()
        );
    }
}
