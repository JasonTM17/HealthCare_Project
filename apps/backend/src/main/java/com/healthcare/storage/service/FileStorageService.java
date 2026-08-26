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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.EnumSet;
import java.util.Optional;
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
    private final StoredFileRepository storedFileRepository;
    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;

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

    private volatile boolean bucketReady;

    public FileStorageService(
            MinioClient minioClient,
            StoredFileRepository storedFileRepository,
            UserRepository userRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            MedicalRecordRepository medicalRecordRepository) {
        this.minioClient = minioClient;
        this.storedFileRepository = storedFileRepository;
        this.userRepository = userRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordRepository = medicalRecordRepository;
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
        init();

        String filename = safeFilename(file.getOriginalFilename());
        String objectName = uploader.getId() + "-" + UUID.randomUUID() + "-" + filename;
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

        StoredFile storedFile = new StoredFile();
        storedFile.setObjectKey(objectName);
        storedFile.setUploader(uploader);
        storedFile.setPatient(patient);
        storedFile.setOriginalFilename(filename);
        storedFile.setContentType(file.getContentType().toLowerCase(Locale.ROOT));
        storedFile.setSizeBytes(file.getSize());
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
        if (extensionStart < 0
                || !ALLOWED_EXTENSIONS.contains(filename.substring(extensionStart).toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phần mở rộng tệp không được hỗ trợ");
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
