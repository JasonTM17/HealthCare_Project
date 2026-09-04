package com.healthcare.media.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.media.dto.MediaAssetResponse;
import com.healthcare.media.entity.MediaAsset;
import com.healthcare.media.repository.MediaAssetRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaAssetService {

    private static final long MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    );

    private final MediaAssetRepository mediaAssetRepository;
    private final UserRepository userRepository;

    public MediaAssetService(MediaAssetRepository mediaAssetRepository, UserRepository userRepository) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public MediaAssetResponse uploadImage(MultipartFile file, String purpose, UserDetails userDetails) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "Tệp hình ảnh tải lên không được để trống.");
        }

        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new BusinessException(400, "Kích thước hình ảnh vượt quá giới hạn tối đa cho phép (10 MB).");
        }

        String rawContentType = file.getContentType();
        String contentType = rawContentType != null ? rawContentType.toLowerCase(Locale.ROOT).trim() : "";
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new BusinessException(400, "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận định dạng ảnh JPEG, PNG, WEBP hoặc GIF.");
        }

        byte[] bytes = file.getBytes();
        if (!isValidImageMagicBytes(bytes, contentType)) {
            throw new BusinessException(400, "Nội dung tệp không hợp lệ hoặc bị giả mạo định dạng hình ảnh.");
        }

        UUID uploaderId = null;
        String uploaderRole = "USER";

        if (userDetails != null) {
            uploaderId = userRepository.findByEmail(userDetails.getUsername())
                .map(User::getId)
                .orElse(null);

            uploaderRole = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .findFirst()
                .orElse("USER");
        }

        String originalFilename = file.getOriginalFilename();
        String safeFilename = originalFilename != null && !originalFilename.isBlank()
            ? originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_")
            : "upload_" + System.currentTimeMillis() + ".jpg";

        MediaAsset asset = new MediaAsset(
            safeFilename,
            contentType,
            file.getSize(),
            bytes,
            uploaderId,
            uploaderRole,
            purpose != null && !purpose.isBlank() ? purpose.toUpperCase(Locale.ROOT).trim() : "GENERAL"
        );

        MediaAsset saved = mediaAssetRepository.save(asset);
        return MediaAssetResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public MediaAsset getMedia(UUID id) {
        return mediaAssetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Tệp hình ảnh không tồn tại hoặc đã bị xóa khỏi hệ thống."));
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
}
