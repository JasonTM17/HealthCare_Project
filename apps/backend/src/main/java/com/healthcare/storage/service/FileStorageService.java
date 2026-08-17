package com.healthcare.storage.service;

import com.healthcare.security.HealthcareUserPrincipal;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final long DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
        "application/pdf",
        "image/jpeg",
        "image/png",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
        ".pdf", ".jpg", ".jpeg", ".png", ".txt", ".doc", ".docx", ".xlsx"
    );

    private final MinioClient minioClient;

    @Value("${minio.bucket:healthcare-files}")
    private String bucket;

    @Value("${storage.max-file-size-bytes:" + DEFAULT_MAX_FILE_SIZE_BYTES + "}")
    private long maxFileSizeBytes;

    private volatile boolean bucketReady;

    public FileStorageService(MinioClient minioClient) {
        this.minioClient = minioClient;
    }

    /** Initializes the bucket lazily so a backend health check does not require MinIO. */
    public synchronized void init() throws Exception {
        if (bucketReady) {
            return;
        }
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
        bucketReady = true;
    }

    public String upload(MultipartFile file, UserDetails principal) throws Exception {
        validateUpload(file);
        UUID ownerId = resolveUserId(principal);
        init();

        String objectName = ownerId + "-" + UUID.randomUUID() + "-" + safeFilename(file.getOriginalFilename());
        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(inputStream, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build()
            );
        }
        return objectName;
    }

    public byte[] download(String objectName, UserDetails principal) throws Exception {
        validateObjectName(objectName);
        authorizeObjectAccess(objectName, principal);
        init();
        try (InputStream stream = minioClient.getObject(
            GetObjectArgs.builder()
                .bucket(bucket)
                .object(objectName)
                .build()
        )) {
            return readLimited(stream);
        }
    }

    public void delete(String objectName) throws Exception {
        validateObjectName(objectName);
        init();
        minioClient.removeObject(
            RemoveObjectArgs.builder()
                .bucket(bucket)
                .object(objectName)
                .build()
        );
    }

    private void validateUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp tải lên không được để trống");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Tệp vượt quá kích thước cho phép");
        }
        String contentType = file.getContentType() == null
            ? ""
            : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Định dạng tệp không được hỗ trợ");
        }
        String filename = safeFilename(file.getOriginalFilename());
        int extensionStart = filename.lastIndexOf('.');
        if (extensionStart < 0
                || !ALLOWED_EXTENSIONS.contains(filename.substring(extensionStart).toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phần mở rộng tệp không được hỗ trợ");
        }
    }

    private byte[] readLimited(InputStream stream) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;
        while ((read = stream.read(buffer)) != -1) {
            total += read;
            if (total > maxFileSizeBytes) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Tệp lưu trữ vượt quá kích thước cho phép");
            }
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private void authorizeObjectAccess(String objectName, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        UUID userId = resolveUserId(principal);
        if (!objectName.startsWith(userId + "-")) {
            throw new AccessDeniedException("Bạn không có quyền truy cập tệp này");
        }
    }

    private UUID resolveUserId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        throw new AccessDeniedException("Không thể xác định danh tính tài khoản");
    }

    private boolean hasRole(UserDetails principal, String role) {
        return principal != null && principal.getAuthorities().stream()
            .anyMatch(authority -> ("ROLE_" + role).equals(authority.getAuthority()));
    }

    private void validateObjectName(String objectName) {
        if (objectName == null || objectName.isBlank() || objectName.contains("..")
                || objectName.startsWith("/") || objectName.contains("\\")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên object không hợp lệ");
        }
    }

    private String safeFilename(String originalFilename) {
        String raw = originalFilename == null || originalFilename.isBlank() ? "upload.bin" : originalFilename;
        Path path = Paths.get(raw);
        String filename = path.getFileName().toString()
            .replaceAll("[^A-Za-z0-9._-]", "_")
            .replaceAll("^\\.+", "");
        if (filename.isBlank()) {
            return "upload.bin";
        }
        return filename.length() > 120 ? filename.substring(filename.length() - 120) : filename;
    }
}
