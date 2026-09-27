package com.healthcare.media.repository;

import com.healthcare.media.entity.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

    /**
     * Counts the assets one uploader created after the given instant. Backed by
     * idx_media_assets_uploader_id (V57), so the per-upload quota check in
     * {@code MediaAssetService} stays an index-range scan instead of a table
     * walk over inline image blobs.
     */
    long countByUploaderIdAndCreatedAtAfter(UUID uploaderId, OffsetDateTime createdAt);
}
