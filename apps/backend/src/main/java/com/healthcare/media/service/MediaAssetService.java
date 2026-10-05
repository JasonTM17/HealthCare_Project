package com.healthcare.media.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.media.dto.MediaAssetResponse;
import com.healthcare.media.entity.MediaAsset;
import com.healthcare.media.repository.MediaAssetRepository;
import com.healthcare.storage.service.FileStorageService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaAssetService {

    private static final Logger log = LoggerFactory.getLogger(MediaAssetService.class);

    /**
     * Safety-net per-file ceiling used when {@code media.upload.max-file-mb}
     * is absent or misconfigured to a non-positive value.
     */
    private static final int DEFAULT_MAX_FILE_MB = 5;

    /** Safety-net per-uploader daily quota, matching the configured default. */
    private static final int DEFAULT_MAX_FILES_PER_DAY = 20;

    /**
     * Length of the rolling window the daily quota counts over. A rolling
     * window (instead of a calendar day) keeps a burst straddling midnight
     * from doubling the effective limit.
     */
    private static final java.time.Duration QUOTA_WINDOW = java.time.Duration.ofHours(24);

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    );

    // The frontend contract (ImageUpload) sends exactly these values; anything
    // else is either a drifted caller or an attempt to smuggle purpose text
    // that later access-control scoping would have to trust.
    private static final Set<String> ALLOWED_PURPOSES = Set.of(
        "GENERAL",
        "ARTICLE_COVER",
        "DOCTOR_PORTRAIT",
        "PATIENT_AVATAR"
    );

    private final MediaAssetRepository mediaAssetRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    /**
     * Per-file ceiling in megabytes. P7 (H-01): when the object store is
     * disabled the image bytes land inline in Postgres, so the ceiling is
     * enforced before the file is even read into memory — not only at the
     * multipart resolver, whose 10 MB bound predates the quota policy.
     */
    @Value("${media.upload.max-file-mb:5}")
    private int maxFileMb = DEFAULT_MAX_FILE_MB;

    /** Per-uploader uploads allowed inside the rolling {@link #QUOTA_WINDOW}. */
    @Value("${media.upload.max-files-per-day:20}")
    private int maxFilesPerDay = DEFAULT_MAX_FILES_PER_DAY;

    public MediaAssetService(MediaAssetRepository mediaAssetRepository, UserRepository userRepository) {
        this(mediaAssetRepository, userRepository, null);
    }

    @Autowired
    public MediaAssetService(
            MediaAssetRepository mediaAssetRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public MediaAssetResponse uploadImage(MultipartFile file, String purpose, UserDetails userDetails) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "Tệp hình ảnh tải lên không được để trống.");
        }

        int effectiveMaxFileMb = maxFileMb > 0 ? maxFileMb : DEFAULT_MAX_FILE_MB;
        long maxFileBytes = effectiveMaxFileMb * 1024L * 1024L;
        if (file.getSize() > maxFileBytes) {
            throw new BusinessException(
                413,
                ErrorCodes.MEDIA_FILE_TOO_LARGE,
                "Kích thước hình ảnh vượt quá giới hạn tối đa cho phép (" + effectiveMaxFileMb + " MB)."
            );
        }

        String normalizedPurpose = purpose != null && !purpose.isBlank()
            ? purpose.toUpperCase(Locale.ROOT).trim()
            : "GENERAL";
        if (!ALLOWED_PURPOSES.contains(normalizedPurpose) || normalizedPurpose.length() > 32) {
            throw new BusinessException(400, "Mục đích sử dụng tệp không hợp lệ.");
        }

        String rawContentType = file.getContentType();
        String contentType = rawContentType != null ? rawContentType.toLowerCase(Locale.ROOT).trim() : "";
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new BusinessException(400, "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận định dạng ảnh JPEG, PNG, WEBP hoặc GIF.");
        }

        UUID uploaderId = null;
        String uploaderRole = "USER";

        if (userDetails != null) {
            uploaderId = userRepository.findByEmail(userDetails.getUsername())
                .map(User::getId)
                .orElse(null);

            java.util.Set<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .collect(java.util.stream.Collectors.toSet());
            // findFirst() on an unordered authority stream is nondeterministic
            // for multi-role accounts; resolve by descending privilege so a
            // PATIENT+DOCTOR principal is not silently treated as patient-only.
            uploaderRole = roles.contains("ADMIN") ? "ADMIN"
                : roles.contains("DOCTOR") ? "DOCTOR"
                : roles.contains("PATIENT") ? "PATIENT"
                : roles.stream().findFirst().orElse("USER");
        }

        // Every stored asset is publicly retrievable by id, so the only
        // purpose a patient may claim is their own avatar — anything else
        // would let a patient publish arbitrary images under the clinic
        // domain labeled as catalog content. A principal that also carries a
        // staff role resolved above is bound by that role instead.
        if ("PATIENT".equals(uploaderRole) && !"PATIENT_AVATAR".equals(normalizedPurpose)) {
            throw new BusinessException(403, "Bạn không có quyền tải ảnh cho mục đích này.");
        }

        // Quota runs before the bytes are buffered and before any row is
        // written: with the object store disabled an accepted upload persists
        // the image inline in Postgres, so an unbounded uploader could exhaust
        // the database within the 20 requests/minute rate limit (P7 H-01).
        if (uploaderId != null) {
            int dailyLimit = maxFilesPerDay > 0 ? maxFilesPerDay : DEFAULT_MAX_FILES_PER_DAY;
            long uploadedInWindow = mediaAssetRepository.countByUploaderIdAndCreatedAtAfter(
                uploaderId, OffsetDateTime.now().minus(QUOTA_WINDOW));
            if (uploadedInWindow >= dailyLimit) {
                log.warn(
                    "Media upload rejected by daily quota: uploaderId={} uploadsInWindow={} limit={} windowHours={}",
                    uploaderId, uploadedInWindow, dailyLimit, QUOTA_WINDOW.toHours());
                throw new BusinessException(
                    429,
                    ErrorCodes.MEDIA_UPLOAD_QUOTA_EXCEEDED,
                    "Bạn đã tải lên tối đa " + dailyLimit + " tệp trong vòng 24 giờ. Vui lòng thử lại sau."
                );
            }
        }

        byte[] bytes = file.getBytes();
        if (!isValidImageMagicBytes(bytes, contentType)) {
            throw new BusinessException(400, "Nội dung tệp không hợp lệ hoặc bị giả mạo định dạng hình ảnh.");
        }

        String originalFilename = file.getOriginalFilename();
        String safeFilename = originalFilename != null && !originalFilename.isBlank()
            ? originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_")
            : "upload_" + System.currentTimeMillis() + ".jpg";

        String objectKey = null;
        byte[] inlineData = bytes;
        if (fileStorageService != null && fileStorageService.isUploadEnabled()) {
            objectKey = storePublicMedia(safeFilename, contentType, bytes);
            inlineData = null;
        }

        MediaAsset asset = new MediaAsset(
            safeFilename,
            contentType,
            file.getSize(),
            inlineData,
            uploaderId,
            uploaderRole,
            normalizedPurpose
        );
        asset.setObjectKey(objectKey);

        MediaAsset saved;
        try {
            saved = mediaAssetRepository.saveAndFlush(asset);
        } catch (RuntimeException exception) {
            removePublicMediaAfterMetadataFailure(objectKey, exception);
            throw exception;
        }
        return MediaAssetResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public MediaAsset getMedia(UUID id) {
        return mediaAssetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Tệp hình ảnh không tồn tại hoặc đã bị xóa khỏi hệ thống."));
    }

    @Transactional(readOnly = true)
    public MediaAssetContent getMediaContent(UUID id) {
        MediaAsset asset = getMedia(id);
        byte[] inlineData = asset.getData();
        if (inlineData != null) {
            return new MediaAssetContent(asset, inlineData);
        }
        String objectKey = asset.getObjectKey();
        if (objectKey == null || objectKey.isBlank()) {
            throw new ResourceNotFoundException("Tệp hình ảnh không tồn tại hoặc đã bị xóa khỏi hệ thống.");
        }
        if (fileStorageService == null || !fileStorageService.isUploadEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kho media chưa được bật cho môi trường này.");
        }
        try {
            return new MediaAssetContent(asset, fileStorageService.downloadPublicMedia(objectKey));
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kho media chưa sẵn sàng.");
        }
    }

    /**
     * Deletes an owned asset row and its object. Without a lifecycle path,
     * every "change/remove" in the upload widgets orphans the previous asset
     * forever. Only the uploader or an administrator may delete; callers are
     * responsible for not deleting assets still referenced by saved content.
     */
    @Transactional
    public void deleteMedia(UUID id, UserDetails userDetails) {
        MediaAsset asset = mediaAssetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Tệp hình ảnh không tồn tại hoặc đã bị xóa khỏi hệ thống."));
        boolean admin = userDetails != null && userDetails.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch("ROLE_ADMIN"::equals);
        UUID requesterId = userDetails == null ? null
            : userRepository.findByEmail(userDetails.getUsername()).map(User::getId).orElse(null);
        if (!admin && (requesterId == null || !requesterId.equals(asset.getUploaderId()))) {
            throw new AccessDeniedException("Bạn không có quyền xóa tệp hình ảnh này.");
        }
        mediaAssetRepository.delete(asset);
        String objectKey = asset.getObjectKey();
        if (objectKey != null && !objectKey.isBlank()
                && fileStorageService != null && fileStorageService.isUploadEnabled()) {
            try {
                fileStorageService.deletePublicMedia(objectKey);
            } catch (Exception cleanupFailure) {
                // The row is gone; a stranded object is retrievable only by an
                // operator sweep — log and move on rather than resurrecting the
                // metadata the caller just deleted.
                log.warn("Media asset {} deleted but object cleanup failed for key {}", id, objectKey);
            }
        }
    }

    private boolean isValidImageMagicBytes(byte[] data, String mimeType) {
        if (data == null || data.length < 8) return false;

        return switch (mimeType) {
            case "image/jpeg" ->
                (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF;
            case "image/png" ->
                (data[0] & 0xFF) == 0x89 && (data[1] & 0xFF) == 0x50 && (data[2] & 0xFF) == 0x4E && (data[3] & 0xFF) == 0x47;
            case "image/gif" ->
                data[0] == 'G' && data[1] == 'I' && data[2] == 'F' && data[3] == '8';
            case "image/webp" ->
                data.length >= 12
                    && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F'
                    && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P';
            default -> false;
        };
    }

    private String storePublicMedia(String safeFilename, String contentType, byte[] bytes) {
        try {
            return fileStorageService.uploadPublicMedia(safeFilename, contentType, bytes);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kho media chưa sẵn sàng.");
        }
    }

    private void removePublicMediaAfterMetadataFailure(String objectKey, RuntimeException exception) {
        if (objectKey == null || objectKey.isBlank() || fileStorageService == null) {
            return;
        }
        try {
            fileStorageService.deletePublicMedia(objectKey);
        } catch (Exception cleanupFailure) {
            exception.addSuppressed(cleanupFailure);
        }
    }

    public record MediaAssetContent(MediaAsset asset, byte[] bytes) {}
}
