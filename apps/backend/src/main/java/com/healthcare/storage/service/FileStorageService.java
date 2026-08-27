package com.healthcare.storage.service;

import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.storage.entity.StoredFile;
import com.healthcare.storage.entity.StoredFilePurpose;
import com.healthcare.storage.repository.StoredFileRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

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
    private static final Map<String, String> CONTENT_TYPE_BY_EXTENSION = Map.ofEntries(
        Map.entry(".pdf", "application/pdf"),
        Map.entry(".jpg", "image/jpeg"),
        Map.entry(".jpeg", "image/jpeg"),
        Map.entry(".png", "image/png"),
        Map.entry(".txt", "text/plain"),
        Map.entry(".doc", "application/msword"),
        Map.entry(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        Map.entry(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    );

    private final MinioClient minioClient;
    private final StoredFileRepository storedFileRepository;
    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final AttachmentScanner attachmentScanner;

    @Value("${storage.bucket:${minio.bucket:healthcare-files}}")
    private String bucket;

    @Value("${storage.max-file-size-bytes:" + DEFAULT_MAX_FILE_SIZE_BYTES + "}")
    private long maxFileSizeBytes;

    /** Uploads stay disabled in beta until private storage and AV are provisioned. */
    @Value("${storage.upload-enabled:true}")
    private boolean uploadEnabled = true;

    @Value("${storage.av.required:false}")
    private boolean avRequired;

    @Value("${storage.av.service-url:}")
    private String avServiceUrl;

    @Value("${storage.av.service-token:}")
    private String avServiceToken;

    @Value("${storage.av.mime-validation-required:true}")
    private boolean mimeValidationRequired = true;

    private volatile boolean bucketReady;

    /** Spring runtime constructor. */
    @Autowired
    public FileStorageService(
            MinioClient minioClient,
            StoredFileRepository storedFileRepository,
            UserRepository userRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            MedicalRecordRepository medicalRecordRepository,
            AttachmentScanner attachmentScanner) {
        this.minioClient = minioClient;
        this.storedFileRepository = storedFileRepository;
        this.userRepository = userRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.attachmentScanner = attachmentScanner == null
            ? new UnavailableAttachmentScanner()
            : attachmentScanner;
    }

    /** Compatibility constructor for focused adapters that do not provision AV. */
    public FileStorageService(
            MinioClient minioClient,
            StoredFileRepository storedFileRepository,
            UserRepository userRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            MedicalRecordRepository medicalRecordRepository) {
        this(
            minioClient,
            storedFileRepository,
            userRepository,
            patientProfileRepository,
            doctorRepository,
            appointmentRepository,
            medicalRecordRepository,
            new UnavailableAttachmentScanner());
    }

    /** Initializes the bucket lazily so a backend health check does not require MinIO. */
    public synchronized void init() throws Exception {
        ensureStoragePathIsEnabled();
        if (bucketReady) {
            return;
        }
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
        bucketReady = true;
    }

    @Transactional
    public String upload(MultipartFile file, UserDetails principal) throws Exception {
        return upload(file, null, StoredFilePurpose.GENERAL, principal).getObjectKey();
    }

    @Transactional
    public StoredFile upload(
            MultipartFile file,
            UUID patientId,
            StoredFilePurpose purpose,
            UserDetails principal) throws Exception {
        ensureUploadPathIsConfigured();
        validateUpload(file);
        User uploader = resolveUser(principal);
        PatientProfile patient = resolvePatientForUpload(patientId, principal);

        String filename = safeFilename(file.getOriginalFilename());
        String objectName = uploader.getId() + "-" + UUID.randomUUID() + "-" + filename;
        byte[] content;
        try (InputStream inputStream = file.getInputStream()) {
            content = readLimited(inputStream);
        }
        String contentType = file.getContentType().toLowerCase(Locale.ROOT);
        ensureMimeMatches(contentType, content);
        ensureCleanScan(objectName, contentType, content);
        init();
        try (InputStream inputStream = new ByteArrayInputStream(content)) {
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .stream(inputStream, content.length, -1)
                    .contentType(contentType)
                    .build()
            );
        }

        StoredFile storedFile = new StoredFile();
        storedFile.setObjectKey(objectName);
        storedFile.setUploader(uploader);
        storedFile.setPatient(patient);
        storedFile.setOriginalFilename(filename);
        storedFile.setContentType(contentType);
        storedFile.setSizeBytes(content.length);
        storedFile.setPurpose(purpose == null ? StoredFilePurpose.GENERAL : purpose);
        try {
            return storedFileRepository.saveAndFlush(storedFile);
        } catch (RuntimeException exception) {
            try {
                minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectName).build());
            } catch (Exception cleanupFailure) {
                exception.addSuppressed(cleanupFailure);
            }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public byte[] download(String objectName, UserDetails principal) throws Exception {
        validateObjectName(objectName);
        StoredFile metadata = storedFileRepository.findByObjectKey(objectName).orElse(null);
        if (metadata == null) {
            authorizeLegacyObjectAccess(objectName, principal);
        } else {
            authorizeMetadataAccess(metadata, principal);
        }
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

    @Transactional
    public void delete(String objectName) throws Exception {
        validateObjectName(objectName);
        init();
        minioClient.removeObject(
            RemoveObjectArgs.builder()
                .bucket(bucket)
                .object(objectName)
                .build()
        );
        storedFileRepository.findByObjectKey(objectName).ifPresent(storedFileRepository::delete);
    }

    @Transactional(readOnly = true)
    public Optional<StoredFile> findMetadata(String objectName) {
        return storedFileRepository.findByObjectKey(objectName);
    }

    @Transactional(readOnly = true)
    public StoredFile getAuthorizedMetadata(String objectName, UserDetails principal) {
        StoredFile metadata = storedFileRepository.findByObjectKey(objectName)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy metadata của tệp"));
        authorizeMetadataAccess(metadata, principal);
        return metadata;
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
        String extension = extensionStart < 0
            ? ""
            : filename.substring(extensionStart).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phần mở rộng tệp không được hỗ trợ");
        }
        if (!contentType.equals(CONTENT_TYPE_BY_EXTENSION.get(extension))) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Loại nội dung không khớp với phần mở rộng tệp");
        }
    }

    private void ensureUploadPathIsConfigured() {
        if (!uploadEnabled) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Kho tệp riêng tư chưa được bật cho môi trường này");
        }
        if (avRequired && (avServiceUrl == null || avServiceUrl.isBlank()
                || avServiceToken == null || avServiceToken.isBlank())) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ quét tệp chưa được cấu hình");
        }
    }

    /**
     * Generic uploads share the same AV boundary as consultation attachments.
     * Nothing is written to object storage until a required scanner returns
     * CLEAN. Scanner failures are intentionally opaque to callers so provider
     * details and raw exception text cannot leak through the API.
     */
    private void ensureCleanScan(String objectName, String contentType, byte[] content) {
        if (!avRequired) {
            return;
        }
        AttachmentScanner.ScanResult scanResult;
        try {
            scanResult = attachmentScanner == null
                ? AttachmentScanner.ScanResult.unavailable("scanner-not-configured")
                : attachmentScanner.scan(new AttachmentScanner.ScanRequest(
                    objectName, contentType, content.length, content));
        } catch (RuntimeException exception) {
            scanResult = AttachmentScanner.ScanResult.error("scanner-failed");
        }
        if (scanResult != null && scanResult.verdict() == AttachmentScanner.Verdict.CLEAN) {
            return;
        }
        if (scanResult != null && scanResult.verdict() == AttachmentScanner.Verdict.INFECTED) {
            throw new ResponseStatusException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "Tệp bị từ chối bởi dịch vụ quét");
        }
        throw new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "Dịch vụ quét tệp chưa sẵn sàng");
    }

    /**
     * Do not trust the multipart Content-Type header as evidence of the bytes
     * being stored. The detector intentionally supports only the allowlisted
     * beta document formats and rejects ambiguous or binary content.
     */
    private void ensureMimeMatches(String declaredContentType, byte[] content) {
        if (!mimeValidationRequired) {
            return;
        }
        String detectedContentType = detectMime(content);
        if (!declaredContentType.equals(detectedContentType)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Nội dung tệp không khớp với định dạng đã khai báo");
        }
    }

    private String detectMime(byte[] bytes) {
        if (hasPrefix(bytes, new int[] {0x25, 0x50, 0x44, 0x46, 0x2d})) {
            return "application/pdf";
        }
        if (hasPrefix(bytes, new int[] {0xff, 0xd8, 0xff})) {
            return "image/jpeg";
        }
        if (hasPrefix(bytes, new int[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})) {
            return "image/png";
        }
        if (hasPrefix(bytes, new int[] {0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1})) {
            return "application/msword";
        }
        String openXmlMime = detectOpenXmlMime(bytes);
        if (openXmlMime != null) {
            return openXmlMime;
        }
        return isUtf8PlainText(bytes) ? "text/plain" : null;
    }

    private String detectOpenXmlMime(byte[] bytes) {
        if (!hasPrefix(bytes, new int[] {0x50, 0x4b, 0x03, 0x04})) {
            return null;
        }
        boolean contentTypes = false;
        boolean wordDocument = false;
        boolean excelWorkbook = false;
        int entryCount = 0;
        try (ZipInputStream archive = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = archive.getNextEntry()) != null) {
                if (++entryCount > 1024) {
                    return null;
                }
                String name = entry.getName().replace('\\', '/').toLowerCase(Locale.ROOT);
                contentTypes |= "[content_types].xml".equals(name);
                wordDocument |= "word/document.xml".equals(name);
                excelWorkbook |= "xl/workbook.xml".equals(name);
            }
        } catch (IOException | RuntimeException exception) {
            return null;
        }
        if (contentTypes && wordDocument && !excelWorkbook) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
        if (contentTypes && excelWorkbook && !wordDocument) {
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }
        return null;
    }

    private boolean isUtf8PlainText(byte[] bytes) {
        try {
            CharBuffer characters = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes));
            while (characters.hasRemaining()) {
                char character = characters.get();
                if (character == '\0'
                        || (Character.isISOControl(character)
                            && character != '\n'
                            && character != '\r'
                            && character != '\t'
                            && character != '\f')) {
                    return false;
                }
            }
            return true;
        } catch (CharacterCodingException exception) {
            return false;
        }
    }

    private boolean hasPrefix(byte[] bytes, int[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if ((bytes[index] & 0xff) != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private void ensureStoragePathIsEnabled() {
        if (!uploadEnabled) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Kho tệp riêng tư chưa được bật cho môi trường này");
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

    private void authorizeLegacyObjectAccess(String objectName, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        UUID userId = resolveUserId(principal);
        if (!objectName.startsWith(userId + "-")) {
            throw new AccessDeniedException("Bạn không có quyền truy cập tệp này");
        }
    }

    private void authorizeMetadataAccess(StoredFile file, UserDetails principal) {
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        UUID userId = resolveUserId(principal);
        if (file.getUploader().getId().equals(userId)) {
            return;
        }
        PatientProfile patient = file.getPatient();
        if (patient != null && hasRole(principal, "PATIENT")
                && userId.equals(patient.getUserId())) {
            return;
        }
        if (patient != null && hasRole(principal, "DOCTOR")) {
            Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new AccessDeniedException("Tài khoản chưa liên kết hồ sơ bác sĩ"));
            boolean hasRecord = medicalRecordRepository.existsByPatientIdAndDoctorId(
                patient.getId(), doctor.getId());
            boolean hasVisit = appointmentRepository.existsByPatientIdAndDoctorIdAndStatusIn(
                patient.getId(),
                doctor.getId(),
                EnumSet.of(
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.CHECKED_IN,
                    AppointmentStatus.IN_PROGRESS,
                    AppointmentStatus.COMPLETED
                )
            );
            if (hasRecord || hasVisit) {
                return;
            }
        }
        throw new AccessDeniedException("Bạn không có quyền truy cập tệp này");
    }

    private PatientProfile resolvePatientForUpload(UUID patientId, UserDetails principal) {
        if (patientId == null) {
            return null;
        }
        PatientProfile patient = patientProfileRepository.findById(patientId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ bệnh nhân"));
        if (hasRole(principal, "ADMIN")) {
            return patient;
        }
        UUID userId = resolveUserId(principal);
        Doctor doctor = doctorRepository.findByUserId(userId)
            .orElseThrow(() -> new AccessDeniedException("Tài khoản chưa liên kết hồ sơ bác sĩ"));
        boolean hasRecord = medicalRecordRepository.existsByPatientIdAndDoctorId(patientId, doctor.getId());
        boolean hasVisit = appointmentRepository.existsByPatientIdAndDoctorIdAndStatusIn(
            patientId,
            doctor.getId(),
            EnumSet.of(
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED
            )
        );
        if (!hasRecord && !hasVisit) {
            throw new AccessDeniedException("Bác sĩ không có quan hệ điều trị với bệnh nhân này");
        }
        return patient;
    }

    private UUID resolveUserId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        throw new AccessDeniedException("Không thể xác định danh tính tài khoản");
    }

    private User resolveUser(UserDetails principal) {
        UUID userId = resolveUserId(principal);
        return userRepository.findById(userId)
            .orElseThrow(() -> new AccessDeniedException("Tài khoản không còn tồn tại"));
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
