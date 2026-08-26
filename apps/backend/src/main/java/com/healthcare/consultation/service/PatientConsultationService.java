package com.healthcare.consultation.service;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.Instant;
import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Owner-scoped consultation authority.  Body text never enters logs or AI
 * calls; SQL predicates deliberately resolve the owner before every read.
 */
@Service
public class PatientConsultationService {
    private static final String CONSENT_VERSION = "consultation-v1";
    private static final long MAX_ATTACHMENT_BYTES = 10_485_760L;
    private static final int MAX_PAGE_SIZE = 100;
    private static final List<String> MIME_TYPES = List.of("image/jpeg", "image/png", "application/pdf");
    private static final byte[] CURSOR_KEY =
        MessageDigestHolder.sha256("healthcare-consultation-cursor-v1");

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final ConsultationAttachmentStorage attachmentStorage;

    /** Direct-to-object-store consultation uploads remain disabled until the
     * beta private bucket and AV/MIME worker are provisioned. */
    @Value("${storage.consultation.enabled:${storage.upload-enabled:false}}")
    private boolean attachmentStorageEnabled = true;

    /** Compatibility constructor used by focused unit tests and local slices. */
    public PatientConsultationService(JdbcTemplate jdbc, UserRepository users) {
        this(jdbc, users, null);
    }

    @Autowired
    public PatientConsultationService(JdbcTemplate jdbc, UserRepository users,
                                      ObjectProvider<ConsultationAttachmentStorage> storageProvider) {
        this.jdbc = jdbc;
        this.users = users;
        this.attachmentStorage = storageProvider == null ? null : storageProvider.getIfAvailable();
    }

    @Transactional
    public ConsultationContracts.ConsultationSummary create(
            ConsultationContracts.CreateRequest request, UserDetails principal) {
        UUID userId = currentUserId(principal);
        if (!Boolean.TRUE.equals(request.consentAccepted())
                || !CONSENT_VERSION.equals(request.consentVersion())) {
            throw new BusinessException(409, "CONSULTATION_CONSENT_REQUIRED", "Cần chấp nhận chính sách tư vấn hiện hành");
        }
        Map<String, Object> appointment = appointmentForPatient(request.appointmentId(), userId);
        String status = String.valueOf(appointment.get("status"));
        if (!List.of("CONFIRMED", "CHECKED_IN", "COMPLETED").contains(status)) {
            throw new BusinessException(409, "CONSULTATION_APPOINTMENT_NOT_ELIGIBLE", "Lịch hẹn chưa mở cửa sổ tư vấn");
        }
        OffsetDateTime appointmentAt = asOffsetDateTime(appointment.get("appointment_time"));
        OffsetDateTime databaseNow = asOffsetDateTime(appointment.get("database_now"));
        // The production query always supplies PostgreSQL CURRENT_TIMESTAMP;
        // the fallback keeps the small constructor-based unit seam usable.
        if (databaseNow == null) databaseNow = OffsetDateTime.now();
        if (appointmentAt == null
                || !appointmentAt.plusDays(30).isAfter(databaseNow)) {
            throw new BusinessException(409, "CONSULTATION_WINDOW_CLOSED", "Cửa sổ tư vấn đã đóng");
        }
        UUID patientId = (UUID) appointment.get("patient_id");
        UUID doctorId = (UUID) appointment.get("doctor_id");
        try {
            UUID id = UUID.randomUUID();
            jdbc.update("""
                INSERT INTO patient_consultation_threads
                    (id, appointment_id, patient_profile_id, doctor_id, subject,
                     consent_version, consented_at, first_response_due_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')
                """, id, request.appointmentId(), patientId, doctorId, request.subject().trim(),
                CONSENT_VERSION);
            UUID patientUser = userId;
            UUID doctorUser = scalarUuid("SELECT user_id FROM doctors WHERE id = ? AND active", doctorId);
            jdbc.update("""
                INSERT INTO patient_consultation_participants
                    (thread_id, user_id, participant_role, assigned_by_user_id)
                VALUES (?, ?, 'PATIENT', NULL), (?, ?, 'ASSIGNED_DOCTOR', ?)
                """, id, patientUser, id, doctorUser, userId);
            appendEvent(id, userId, "PATIENT", "CREATED", "{}");
            return summary(id, userId);
        } catch (DataAccessException ex) {
            if (String.valueOf(ex.getMessage()).contains("uq_patient_consultation_threads_appointment")) {
                throw new BusinessException(409, "CONSULTATION_ALREADY_EXISTS", "Lịch hẹn đã có kênh tư vấn");
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<ConsultationContracts.ConsultationSummary> listForPatient(UserDetails principal) {
        UUID userId = currentUserId(principal);
        return jdbc.query("""
            SELECT t.id, t.appointment_id, t.doctor_id, d.full_name doctor_name,
                   t.subject,
                   CASE WHEN t.status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
                              AND t.consultation_open_until <= CURRENT_TIMESTAMP
                        THEN 'EXPIRED' ELSE t.status END AS status,
                   t.consultation_open_until, t.updated_at,
                   COALESCE((
                       SELECT COUNT(*)
                         FROM patient_consultation_messages m
                         LEFT JOIN patient_consultation_read_states rs
                           ON rs.thread_id = t.id AND rs.user_id = ?
                         LEFT JOIN patient_consultation_messages lm
                           ON lm.id = rs.last_read_message_id AND lm.thread_id = t.id
                        WHERE m.thread_id = t.id
                          AND m.retention_expires_at > CURRENT_TIMESTAMP
                          AND m.author_user_id <> ?
                          AND (rs.last_read_message_id IS NULL
                               OR m.sequence_number > COALESCE(lm.sequence_number, 0))
                   ), 0)::bigint unread_count
              FROM patient_consultation_threads t
              JOIN patient_profiles p ON p.id = t.patient_profile_id AND p.user_id = ?
              JOIN doctors d ON d.id = t.doctor_id
                 WHERE t.retention_expires_at > CURRENT_TIMESTAMP
                   AND EXISTS (
                       SELECT 1
                         FROM patient_consultation_participants cp
                        WHERE cp.thread_id = t.id
                          AND cp.user_id = ?
                          AND cp.left_at IS NULL
                   )
             ORDER BY t.updated_at DESC, t.id DESC
             """, (rs, n) -> mapSummary(rs), userId, userId, userId, userId);
    }

    @Transactional(readOnly = true)
    public ConsultationContracts.Detail detail(UUID id, UserDetails principal) {
        UUID userId = currentUserId(principal);
        ConsultationContracts.ConsultationSummary summary = summary(id, userId);
        List<ConsultationContracts.Message> messages = messagesLegacy(id, principal, 100);
        return new ConsultationContracts.Detail(summary, messages);
    }

    @Transactional(readOnly = true)
    public ConsultationContracts.MessagePage messages(UUID id, UserDetails principal, int limit) {
        return messages(id, principal, null, limit);
    }

    /** Legacy detail/Java seam; the HTTP endpoint uses the page contract. */
    public List<ConsultationContracts.Message> messagesLegacy(UUID id, UserDetails principal, int limit) {
        return messages(id, principal, null, limit).items();
    }

    @Transactional(readOnly = true)
    public ConsultationContracts.MessagePage messages(UUID id, UserDetails principal,
                                                      String rawCursor, int limit) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        int bounded = validateLimit(limit);
        Cursor cursor = decodeCursor(rawCursor);
        List<MessageRow> rows;
        if (cursor == null) {
            rows = jdbc.query("""
            SELECT m.id, m.author_user_id, m.author_role_snapshot, m.body,
                   CASE WHEN m.author_user_id = ? THEN 'SENT' ELSE 'READ' END status,
                   m.created_at, m.sequence_number
              FROM patient_consultation_messages m
             WHERE m.thread_id = ? AND m.retention_expires_at > CURRENT_TIMESTAMP
             ORDER BY m.sequence_number ASC, m.id ASC LIMIT ?
            """, this::mapMessageRow, userId, id, bounded + 1);
        } else {
            rows = jdbc.query("""
            SELECT m.id, m.author_user_id, m.author_role_snapshot, m.body,
                   CASE WHEN m.author_user_id = ? THEN 'SENT' ELSE 'READ' END status,
                   m.created_at, m.sequence_number
              FROM patient_consultation_messages m
             WHERE m.thread_id = ? AND m.retention_expires_at > CURRENT_TIMESTAMP
               AND (m.sequence_number, m.id) > (?, ?)
             ORDER BY m.sequence_number ASC, m.id ASC LIMIT ?
            """, this::mapMessageRow, userId, id, cursor.sequence(), cursor.id(), bounded + 1);
        }
        boolean hasMore = rows.size() > bounded;
        if (hasMore) rows = new ArrayList<>(rows.subList(0, bounded));
        if (rows.isEmpty()) return new ConsultationContracts.MessagePage(List.of(), null, false);
        List<UUID> messageIds = rows.stream().map(MessageRow::id).toList();
        String placeholders = String.join(",", java.util.Collections.nCopies(messageIds.size(), "?"));
        Object[] attachmentArgs = new Object[messageIds.size() + 1];
        attachmentArgs[0] = id;
        for (int index = 0; index < messageIds.size(); index++) attachmentArgs[index + 1] = messageIds.get(index);
        Map<UUID, List<ConsultationContracts.Attachment>> attachments = new HashMap<>();
        String attachmentSql = "SELECT id, message_id, actual_mime_type, declared_mime_type, size_bytes, "
            + "scan_status, upload_status, upload_expires_at "
            + "FROM patient_consultation_attachments "
            + "WHERE thread_id = ? AND message_id IN (" + placeholders + ") "
            + "AND retention_expires_at > CURRENT_TIMESTAMP "
            + "ORDER BY created_at ASC, id ASC";
        jdbc.query(attachmentSql, rs -> {
                UUID messageId = rs.getObject("message_id", UUID.class);
                attachments.computeIfAbsent(messageId, ignored -> new ArrayList<>()).add(
                    new ConsultationContracts.Attachment(
                        rs.getObject("id", UUID.class),
                        rs.getString("declared_mime_type") == null
                            ? rs.getString("actual_mime_type") : rs.getString("declared_mime_type"),
                        rs.getLong("size_bytes"), rs.getString("scan_status"), null,
                        rs.getString("upload_status"), null,
                        rs.getObject("upload_expires_at", OffsetDateTime.class)));
            }, attachmentArgs);
        List<ConsultationContracts.Message> messages = rows.stream()
            .map(message -> new ConsultationContracts.Message(
                message.id(), message.authorUserId(), message.authorRole(), message.body(), message.status(),
                message.createdAt(), List.copyOf(attachments.getOrDefault(message.id(), List.of()))))
            .toList();
        MessageRow last = rows.get(rows.size() - 1);
        return new ConsultationContracts.MessagePage(messages,
            hasMore ? encodeCursor(last.sequence(), last.id()) : null, hasMore);
    }

    @Transactional
    public ConsultationContracts.Message send(UUID id, ConsultationContracts.MessageRequest request,
                                               String idempotencyKey, UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 128) {
            throw new BusinessException(400, "IDEMPOTENCY_KEY_REQUIRED", "Thiếu Idempotency-Key hợp lệ");
        }
        String normalizedKey = idempotencyKey.trim();
        String normalizedBody = request.body().trim();
        // A replay must remain idempotent even after the consultation window
        // closes.  A reused key with a different body is a client conflict,
        // never a second message.
        ConsultationContracts.Message replay = findIdempotentMessage(id, userId, normalizedKey, normalizedBody);
        if (replay != null) return replay;
        // Serialize sequence allocation and the idempotency replay check.  The
        // database owns the optimistic version and a closed/expired thread
        // must never accept a message after its 30-day window.
        lockOpenThread(id);
        replay = findIdempotentMessage(id, userId, normalizedKey, normalizedBody);
        if (replay != null) return replay;
        String role = isDoctor(userId) ? "DOCTOR" : "PATIENT";
        UUID participantId = participantId(id, userId);
        jdbc.update("""
            INSERT INTO patient_consultation_messages
                (thread_id, author_user_id, author_role_snapshot, sequence_number,
                 author_participant_id, body, idempotency_key)
            SELECT ?, ?, ?, COALESCE(MAX(sequence_number), 0) + 1, ?, ?, ?
              FROM patient_consultation_messages
             WHERE thread_id = ?
            """, id, userId, role, participantId, normalizedBody, normalizedKey, id);
        jdbc.update("""
            UPDATE patient_consultation_threads
               SET status = CASE WHEN ? = 'DOCTOR' THEN 'WAITING_FOR_PATIENT' ELSE 'WAITING_FOR_DOCTOR' END,
                   first_responded_at = CASE WHEN ? = 'DOCTOR' THEN COALESCE(first_responded_at, CURRENT_TIMESTAMP) ELSE first_responded_at END,
                   version = version + 1
             WHERE id = ? AND consultation_open_until > CURRENT_TIMESTAMP
            """, role, role, id);
        Map<String, Object> row = jdbc.queryForMap("""
            SELECT id, author_user_id, author_role_snapshot, body, created_at
             FROM patient_consultation_messages
             WHERE thread_id = ? AND author_user_id = ? AND idempotency_key = ?
            """, id, userId, normalizedKey);
        appendEvent(id, userId, role, "MESSAGE_SENT",
            "{\"messageId\":\"" + row.get("id") + "\"}");
        return mapMessage(row, "SENT");
    }

    private ConsultationContracts.Message findIdempotentMessage(
            UUID threadId, UUID userId, String idempotencyKey, String body) {
        try {
            Map<String, Object> existing = jdbc.queryForMap("""
                SELECT id, author_user_id, author_role_snapshot, body, created_at
                  FROM patient_consultation_messages
                 WHERE thread_id = ? AND author_user_id = ? AND idempotency_key = ?
                """, threadId, userId, idempotencyKey);
            if (existing == null || existing.isEmpty()) return null;
            if (!body.equals(String.valueOf(existing.get("body")))) {
                throw new BusinessException(409, "CONSULTATION_IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key đã được dùng cho nội dung khác");
            }
            return mapMessage(existing, "SENT");
        } catch (EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private UUID participantId(UUID threadId, UUID userId) {
        try {
            return jdbc.queryForObject("""
                SELECT id FROM patient_consultation_participants
                 WHERE thread_id = ? AND user_id = ? AND left_at IS NULL
                 ORDER BY CASE participant_role WHEN 'PATIENT' THEN 0 WHEN 'ASSIGNED_DOCTOR' THEN 1 ELSE 2 END
                 LIMIT 1
                """, UUID.class, threadId, userId);
        } catch (DataAccessException ex) {
            throw notFound();
        }
    }

    @Transactional
    public void markRead(UUID id, ConsultationContracts.ReadRequest request, UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        UUID throughMessageId = request == null ? null : request.throughMessageId();
        // A bodyless POST is intentionally a no-op for old clients.
        if (throughMessageId != null) {
            Map<String, Object> target;
            try {
                target = jdbc.queryForMap("""
                    SELECT id, sequence_number, author_user_id
                      FROM patient_consultation_messages
                     WHERE id = ? AND thread_id = ?
                       AND retention_expires_at > CURRENT_TIMESTAMP
                    """, throughMessageId, id);
            } catch (DataAccessException ex) {
                throw notFound();
            }
            // Read progress represents messages delivered by another
            // participant. Accepting the caller's own later message as the
            // watermark can skip an unseen clinical reply inserted just
            // before it, so an own-message target is intentionally a no-op.
            if (userId.toString().equalsIgnoreCase(String.valueOf(target.get("author_user_id")))) {
                return;
            }
            long targetSequence = ((Number) target.get("sequence_number")).longValue();
            // The comparison and write must be one database operation.  A
            // read-then-upsert sequence allows a delayed lower read to
            // overwrite a newer read when two tabs/devices race.  PostgreSQL
            // serializes the conflicting row and evaluates this predicate
            // against the committed current state, so read progress can only
            // move forward.
            int changed = jdbc.update("""
                INSERT INTO patient_consultation_read_states
                    (thread_id, user_id, last_read_message_id, last_read_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (thread_id, user_id) DO UPDATE SET
                    last_read_message_id = EXCLUDED.last_read_message_id,
                    last_read_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE COALESCE((
                    SELECT m.sequence_number
                      FROM patient_consultation_messages m
                     WHERE m.id = patient_consultation_read_states.last_read_message_id
                       AND m.thread_id = patient_consultation_read_states.thread_id
                ), 0) < ?
                """, id, userId, throughMessageId, targetSequence);
            if (changed > 0) {
                appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "STATUS_CHANGE",
                    "{\"throughMessageId\":\"" + throughMessageId + "\"}");
            }
        }
    }

    @Transactional
    public void close(UUID id, UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        expireIfDue(id);
        int changed = jdbc.update("""
            UPDATE patient_consultation_threads
               SET status = 'CLOSED', version = version + 1
             WHERE id = ?
               AND status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT', 'RESOLVED')
               AND consultation_open_until > CURRENT_TIMESTAMP
            """, id);
        if (changed > 0) appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "STATUS_CHANGE", "{\"status\":\"CLOSED\"}");
    }

    @Transactional
    public void resolve(UUID id, UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireDoctorParticipant(id, userId);
        expireIfDue(id);
        int changed = jdbc.update("""
            UPDATE patient_consultation_threads
               SET status = 'RESOLVED', version = version + 1
             WHERE id = ?
               AND status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
               AND consultation_open_until > CURRENT_TIMESTAMP
            """, id);
        if (changed > 0) appendEvent(id, userId, "DOCTOR", "STATUS_CHANGE", "{\"status\":\"RESOLVED\"}");
    }

    @Transactional
    public void reopen(UUID id, UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        expireIfDue(id);
        int changed = jdbc.update("""
            UPDATE patient_consultation_threads t
               SET status = 'WAITING_FOR_DOCTOR',
                   version = version + 1
             WHERE t.id = ?
               AND t.status IN ('CLOSED', 'RESOLVED')
               AND t.consultation_open_until > CURRENT_TIMESTAMP
            """, id);
        if (changed > 0) appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "STATUS_CHANGE", "{\"status\":\"REOPENED\"}");
    }

    @Transactional
    public ConsultationContracts.Attachment attachmentIntent(UUID id, ConsultationContracts.AttachmentIntentRequest request,
                                                              UserDetails principal) {
        if (!attachmentStorageEnabled) {
            throw new BusinessException(503, ErrorCodes.CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE,
                "Kho tệp tư vấn chưa được cấu hình");
        }
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        validateAttachment(request);
        requireMessageAuthor(id, request.messageId(), userId);
        lockOpenThread(id);
        if (attachmentStorage == null || !attachmentStorage.isEnabled()) {
            throw new BusinessException(503, ErrorCodes.CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE,
                "Kho tệp tư vấn chưa được cấu hình");
        }
        ConsultationAttachmentStorage.UploadIntent intent = attachmentStorage.createUploadIntent(
            new ConsultationAttachmentStorage.UploadIntentRequest(
                id, request.messageId(), request.mimeType(), request.sizeBytes(),
                request.sha256Hash().toLowerCase(), null));
        if (intent.availability() != ConsultationAttachmentStorage.Availability.ENABLED
                || intent.attachmentId() == null || intent.privateObjectKey() == null
                || intent.signedPutUrl() == null || intent.putUrlExpiresAt() == null) {
            throw new BusinessException(503, ErrorCodes.CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE,
                "Kho tệp tư vấn chưa sẵn sàng");
        }
        UUID attachmentId = intent.attachmentId();
        String objectKey = intent.privateObjectKey();
        OffsetDateTime uploadExpiresAt = intent.putUrlExpiresAt().atOffset(ZoneOffset.UTC);
        jdbc.update("""
            INSERT INTO patient_consultation_attachments
                (id, thread_id, message_id, private_object_key, upload_object_key, actual_mime_type,
                 declared_mime_type, size_bytes, sha256_hash, upload_status,
                 upload_expires_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'REQUESTED', ?)
            """, attachmentId, id, request.messageId(), objectKey, objectKey, request.mimeType(),
            request.sizeBytes(), request.sha256Hash().toLowerCase(), uploadExpiresAt);
        appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "SCAN_RESULT", "{\"attachmentId\":\"" + attachmentId + "\",\"status\":\"PENDING\"}");
        return new ConsultationContracts.Attachment(attachmentId, request.mimeType(), request.sizeBytes(),
            "PENDING", null, "REQUESTED", intent.signedPutUrl().toString(), uploadExpiresAt);
    }

    @Transactional
    public ConsultationContracts.Attachment completeAttachment(UUID id, UUID attachmentId,
        ConsultationContracts.AttachmentCompleteRequest request,
                                                                 UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        // This browser endpoint only HEAD-acknowledges an upload. Byte reads,
        // MIME/hash/AV checks and CLEAN authority belong to the leased worker.
        Map<String, Object> row = attachmentRowForCompletion(id, attachmentId);
        requireMessageAuthor(id, (UUID) row.get("message_id"), userId);
        String persistedScanStatus = String.valueOf(row.get("scan_status"));
        if (isTerminalAttachmentStatus(persistedScanStatus) || "UPLOADED".equals(row.get("upload_status"))) {
            return persistedAttachment(attachmentId, row);
        }
        String objectKey = String.valueOf(row.get("private_object_key"));
        String declaredMime = String.valueOf(row.get("declared_mime_type"));
        long expectedSize = ((Number) row.get("size_bytes")).longValue();
        String expectedSha = String.valueOf(row.get("sha256_hash"));
        OffsetDateTime uploadExpiresAt = asOffsetDateTime(row.get("upload_expires_at"));
        OffsetDateTime databaseNow = asOffsetDateTime(row.get("database_now"));
        // Upload expiry applies until acknowledgment, not to a queued scan.
        if (uploadExpiresAt != null && databaseNow != null
                && !uploadExpiresAt.isAfter(databaseNow)) {
            int expired = jdbc.update("""
                UPDATE patient_consultation_attachments
                   SET scan_status = 'REJECTED', upload_status = 'EXPIRED',
                       rejection_code = 'ATTACHMENT_UPLOAD_EXPIRED',
                       scanned_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND thread_id = ?
                   AND scan_status = 'PENDING'
                   AND private_object_key = ?
                   AND upload_status IN ('REQUESTED', 'UPLOADING')
                """, attachmentId, id, objectKey);
            if (expired != 1) {
                return persistedAttachment(
                    attachmentId, attachmentRowForCompletion(id, attachmentId));
            }
            appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "SCAN_RESULT",
                "{\"attachmentId\":\"" + attachmentId + "\",\"status\":\"EXPIRED\"}");
            return new ConsultationContracts.Attachment(attachmentId,
                declaredMime, expectedSize, "REJECTED", null, "EXPIRED", null,
                uploadExpiresAt);
        }
        if (!attachmentStorageEnabled || attachmentStorage == null || !attachmentStorage.isEnabled()
                || !attachmentStorage.isUploadPresent(new ConsultationAttachmentStorage.CompletionRequest(
                    id, attachmentId, objectKey, declaredMime, expectedSize, expectedSha))) {
            throw new BusinessException(503, ErrorCodes.CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE,
                "Chưa xác nhận được tệp tải lên, vui lòng thử lại");
        }
        int updated = jdbc.update("""
            UPDATE patient_consultation_attachments
               SET upload_status = 'UPLOADED', uploaded_at = statement_timestamp(),
                   scan_available_at = statement_timestamp()
             WHERE id = ? AND thread_id = ?
               AND scan_status = 'PENDING'
               AND private_object_key = ?
               AND upload_status IN ('REQUESTED', 'UPLOADING')
               AND retention_expires_at > statement_timestamp()
               AND upload_expires_at > statement_timestamp()
            """, attachmentId, id, objectKey);
        if (updated != 1) {
            return persistedAttachment(
                attachmentId, attachmentRowForCompletion(id, attachmentId));
        }
        appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "SCAN_RESULT",
            "{\"attachmentId\":\"" + attachmentId + "\",\"status\":\"QUEUED\"}");
        return new ConsultationContracts.Attachment(attachmentId, declaredMime, expectedSize,
            "PENDING", null, "UPLOADED", null,
            asOffsetDateTime(row.get("upload_expires_at")));
    }

    private Map<String, Object> attachmentRowForCompletion(UUID id, UUID attachmentId) {
        try {
            return jdbc.queryForMap("""
                SELECT actual_mime_type, private_object_key, declared_mime_type,
                       size_bytes, sha256_hash, scan_status, upload_status, upload_expires_at,
                       clock_timestamp() AS database_now, message_id
                 FROM patient_consultation_attachments
                 WHERE id = ? AND thread_id = ? AND retention_expires_at > CURRENT_TIMESTAMP
                """, attachmentId, id);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    private boolean isTerminalAttachmentStatus(String scanStatus) {
        return "CLEAN".equals(scanStatus) || "REJECTED".equals(scanStatus);
    }

    private ConsultationContracts.Attachment persistedAttachment(
            UUID attachmentId, Map<String, Object> row) {
        Object actualMime = row.get("actual_mime_type");
        Object declaredMime = row.get("declared_mime_type");
        String mimeType = String.valueOf(actualMime == null ? declaredMime : actualMime);
        return new ConsultationContracts.Attachment(
            attachmentId,
            mimeType,
            ((Number) row.get("size_bytes")).longValue(),
            String.valueOf(row.get("scan_status")),
            null,
            String.valueOf(row.get("upload_status")),
            null,
            asOffsetDateTime(row.get("upload_expires_at")));
    }

    @Transactional(readOnly = true)
    public ConsultationContracts.Attachment attachmentStatus(UUID id, UUID attachmentId, UserDetails principal) {
        requireParticipant(id, currentUserId(principal));
        return persistedAttachment(attachmentId, attachmentRowForCompletion(id, attachmentId));
    }

    @Transactional(readOnly = true)
    public ConsultationContracts.Attachment downloadIntent(UUID id, UUID attachmentId,
                                                            UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        try {
            Map<String, Object> row = jdbc.queryForMap("""
                SELECT private_object_key, declared_mime_type, actual_mime_type, size_bytes, scan_status,
                       upload_status, upload_expires_at
                  FROM patient_consultation_attachments
                 WHERE id = ? AND thread_id = ? AND scan_status = 'CLEAN'
                   AND retention_expires_at > CURRENT_TIMESTAMP
                """, attachmentId, id);
            if (attachmentStorage == null || !attachmentStorage.isEnabled()) {
                throw new BusinessException(503, ErrorCodes.CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE,
                    "Kho tệp tư vấn chưa được cấu hình");
            }
            ConsultationAttachmentStorage.DownloadUrl intent = attachmentStorage.issueDownloadUrl(
                new ConsultationAttachmentStorage.DownloadRequest(
                    id, attachmentId, String.valueOf(row.get("private_object_key")),
                    ConsultationAttachmentStorage.ScanStatus.CLEAN,
                    ((Number) row.get("size_bytes")).longValue()));
            if (intent.availability() != ConsultationAttachmentStorage.Availability.ENABLED
                    || intent.signedGetUrl() == null) {
                throw new BusinessException(503, ErrorCodes.CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE,
                    "Kho tệp tư vấn chưa sẵn sàng");
            }
            Object declared = row.get("declared_mime_type");
            return new ConsultationContracts.Attachment(attachmentId,
                String.valueOf(declared == null ? row.get("actual_mime_type") : declared),
                ((Number) row.get("size_bytes")).longValue(), String.valueOf(row.get("scan_status")),
                intent.signedGetUrl().toString(), String.valueOf(row.get("upload_status")), null,
                asOffsetDateTime(row.get("upload_expires_at")));
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    @Transactional(readOnly = true)
    public List<ConsultationContracts.ConsultationSummary> listForDoctor(UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireDoctor(userId);
        return jdbc.query("""
            SELECT DISTINCT t.id, t.appointment_id, t.doctor_id, d.full_name doctor_name,
                   t.subject,
                   CASE WHEN t.status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
                              AND t.consultation_open_until <= CURRENT_TIMESTAMP
                        THEN 'EXPIRED' ELSE t.status END AS status,
                   t.consultation_open_until, t.updated_at,
                   COALESCE((
                       SELECT COUNT(*)
                         FROM patient_consultation_messages m
                         LEFT JOIN patient_consultation_read_states rs
                           ON rs.thread_id = t.id AND rs.user_id = ?
                         LEFT JOIN patient_consultation_messages lm
                           ON lm.id = rs.last_read_message_id AND lm.thread_id = t.id
                        WHERE m.thread_id = t.id
                          AND m.retention_expires_at > CURRENT_TIMESTAMP
                          AND m.author_user_id <> ?
                          AND (rs.last_read_message_id IS NULL
                               OR m.sequence_number > COALESCE(lm.sequence_number, 0))
                   ), 0)::bigint unread_count
             FROM patient_consultation_threads t
              JOIN doctors d ON d.id = t.doctor_id
              JOIN patient_consultation_participants p
                ON p.thread_id = t.id AND p.left_at IS NULL
             WHERE t.retention_expires_at > CURRENT_TIMESTAMP
               AND (d.user_id = ? OR (p.user_id = ? AND p.participant_role = 'HANDOFF_DOCTOR'))
             ORDER BY t.updated_at DESC, t.id DESC
            """, (rs, n) -> mapSummary(rs), userId, userId, userId);
    }

    @Transactional(readOnly = true)
    public List<ConsultationContracts.HandoffDoctor> handoffDirectory(UUID threadId,
                                                                       UserDetails principal) {
        UUID actor = currentUserId(principal);
        requireDoctor(actor);
        requireDoctorParticipant(threadId, actor);
        return jdbc.query("""
            SELECT DISTINCT d.id AS doctor_id, d.full_name,
                   s.slug AS specialty_slug, b.slug AS branch_slug
              FROM patient_consultation_threads t
              JOIN appointments a ON a.id = t.appointment_id
              JOIN doctors d ON d.active AND d.user_id <> ?
              JOIN users u ON u.id = d.user_id AND u.status = 'ACTIVE'
              JOIN user_roles ur ON ur.user_id = u.id
              JOIN roles r ON r.id = ur.role_id AND r.code = 'DOCTOR'
              LEFT JOIN doctor_specialties ds ON ds.doctor_id = d.id
              LEFT JOIN specialties s ON s.id = ds.specialty_id AND s.active
              LEFT JOIN doctor_branches db ON db.doctor_id = d.id
              LEFT JOIN branches b ON b.id = db.branch_id AND b.active
             WHERE t.id = ?
               AND (a.specialty_id IS NULL OR ds.specialty_id = a.specialty_id)
               AND (a.branch_id IS NULL OR db.branch_id = a.branch_id)
             ORDER BY d.full_name ASC, d.id ASC
            """, (rs, n) -> new ConsultationContracts.HandoffDoctor(
                rs.getObject("doctor_id", UUID.class), rs.getString("full_name"),
                rs.getString("specialty_slug"), rs.getString("branch_slug")), actor, threadId);
    }

    @Transactional
    public void handoff(UUID id, ConsultationContracts.HandoffRequest request, UserDetails principal) {
        UUID actor = currentUserId(principal);
        requireDoctor(actor);
        requireDoctorParticipant(id, actor);
        UUID targetUser = resolveHandoffDoctor(id, request.doctorId(), actor);
        if (targetUser.equals(actor)) {
            throw new BusinessException(409, "CONSULTATION_HANDOFF_INVALID", "Không thể chuyển lại cho chính bác sĩ hiện tại");
        }
        jdbc.update("""
            INSERT INTO patient_consultation_participants(thread_id, user_id, participant_role, assigned_by_user_id)
            VALUES (?, ?, 'HANDOFF_DOCTOR', ?)
            ON CONFLICT (thread_id, user_id, participant_role) DO UPDATE
                SET left_at = NULL,
                    assigned_by_user_id = EXCLUDED.assigned_by_user_id
            """, id, targetUser, actor);
        jdbc.update("UPDATE patient_consultation_threads SET status = 'WAITING_FOR_DOCTOR', version = version + 1 WHERE id = ? AND retention_expires_at > CURRENT_TIMESTAMP", id);
        appendEvent(id, actor, "DOCTOR", "HANDOFF", "{\"doctorId\":\"" + request.doctorId() + "\"}");
    }

    @Transactional(readOnly = true)
    public List<ConsultationContracts.AdminQueueItem> listForAdmin() {
        return jdbc.query("""
            SELECT t.id AS thread_id,
                   CASE WHEN t.status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
                              AND t.consultation_open_until <= CURRENT_TIMESTAMP
                        THEN 'EXPIRED' ELSE t.status END AS status,
                   t.first_response_due_at, t.first_responded_at,
                   t.consultation_open_until, t.updated_at,
                   s.slug AS specialty_slug,
                   assignment.participant_role AS assignment_role,
                   assignment.assignment_permission,
                   assignment.joined_at AS assigned_at
              FROM patient_consultation_threads t
              JOIN appointments a ON a.id = t.appointment_id
              LEFT JOIN specialties s ON s.id = a.specialty_id
              LEFT JOIN LATERAL (
                    SELECT p.participant_role, p.assignment_permission, p.joined_at
                      FROM patient_consultation_participants p
                     WHERE p.thread_id = t.id
                       AND p.participant_role IN ('ASSIGNED_DOCTOR', 'HANDOFF_DOCTOR')
                       AND p.left_at IS NULL
                     ORDER BY CASE WHEN p.participant_role = 'HANDOFF_DOCTOR' THEN 0 ELSE 1 END,
                              p.joined_at DESC, p.id DESC
                     LIMIT 1
              ) assignment ON TRUE
             WHERE t.retention_expires_at > CURRENT_TIMESTAMP ORDER BY t.updated_at DESC
            """, (rs, n) -> mapAdminQueueItem(rs));
    }

    @Transactional
    public void assign(UUID id, ConsultationContracts.HandoffRequest request, UserDetails principal) {
        UUID admin = currentUserId(principal);
        requireAdmin(admin);
        UUID targetUser = resolveHandoffDoctor(id, request.doctorId(), admin);
        requireExists("SELECT id FROM patient_consultation_threads WHERE id = ? AND retention_expires_at > CURRENT_TIMESTAMP", id);
        jdbc.update("""
            INSERT INTO patient_consultation_participants(thread_id, user_id, participant_role, assigned_by_user_id)
            VALUES (?, ?, 'HANDOFF_DOCTOR', ?)
            ON CONFLICT (thread_id, user_id, participant_role) DO UPDATE
                SET left_at = NULL,
                    assigned_by_user_id = EXCLUDED.assigned_by_user_id
            """, id, targetUser, admin);
        appendEvent(id, admin, "ADMIN", "ASSIGNMENT", "{\"doctorId\":\"" + request.doctorId() + "\"}");
    }

    private ConsultationContracts.ConsultationSummary summary(UUID id, UUID userId) {
        try {
            return jdbc.queryForObject("""
                SELECT t.id, t.appointment_id, t.doctor_id, d.full_name doctor_name,
                       t.subject,
                       CASE WHEN t.status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
                                  AND t.consultation_open_until <= CURRENT_TIMESTAMP
                            THEN 'EXPIRED' ELSE t.status END AS status,
                       t.consultation_open_until, t.updated_at,
                       COALESCE((
                           SELECT COUNT(*)
                             FROM patient_consultation_messages m
                             LEFT JOIN patient_consultation_read_states rs
                               ON rs.thread_id = t.id AND rs.user_id = ?
                             LEFT JOIN patient_consultation_messages lm
                               ON lm.id = rs.last_read_message_id AND lm.thread_id = t.id
                            WHERE m.thread_id = t.id
                              AND m.retention_expires_at > CURRENT_TIMESTAMP
                              AND m.author_user_id <> ?
                              AND (rs.last_read_message_id IS NULL
                                   OR m.sequence_number > COALESCE(lm.sequence_number, 0))
                       ), 0)::bigint unread_count
                  FROM patient_consultation_threads t JOIN doctors d ON d.id = t.doctor_id
                 WHERE t.id = ?
                   AND t.retention_expires_at > CURRENT_TIMESTAMP
                    AND EXISTS (
                        SELECT 1
                          FROM patient_consultation_participants p
                         WHERE p.thread_id = t.id
                           AND p.user_id = ?
                           AND p.left_at IS NULL
                    )
                """, (rs, n) -> mapSummary(rs), userId, userId, id, userId);
        } catch (EmptyResultDataAccessException ex) { throw notFound(); }
    }

    private Map<String, Object> appointmentForPatient(UUID appointmentId, UUID userId) {
        try {
            return jdbc.queryForMap("""
                SELECT a.id, a.patient_id, a.doctor_id, a.status, a.appointment_time,
                       CURRENT_TIMESTAMP AS database_now
                  FROM appointments a JOIN patient_profiles p ON p.id = a.patient_id
                 WHERE a.id = ? AND p.user_id = ?
                """, appointmentId, userId);
        } catch (EmptyResultDataAccessException ex) { throw notFound(); }
    }

    private void requireParticipant(UUID id, UUID userId) {
        try {
            requireExists("""
                SELECT p.thread_id
                  FROM patient_consultation_participants p
                  JOIN patient_consultation_threads t ON t.id = p.thread_id
                 WHERE p.thread_id = ? AND p.user_id = ?
                   AND p.left_at IS NULL
                   AND t.retention_expires_at > CURRENT_TIMESTAMP
                """, id, userId);
        }
        catch (DataAccessException ex) { throw notFound(); }
    }

    private void requireMessageAuthor(UUID threadId, UUID messageId, UUID userId) {
        try {
            jdbc.queryForObject("SELECT id FROM patient_consultation_messages WHERE id = ? AND thread_id = ? AND author_user_id = ?", UUID.class, messageId, threadId, userId);
        } catch (DataAccessException ex) {
            throw notFound();
        }
    }

    private void lockOpenThread(UUID id) {
        try {
            Map<String, Object> row = jdbc.queryForMap("""
                SELECT status, consultation_open_until, CURRENT_TIMESTAMP AS database_now
                  FROM patient_consultation_threads WHERE id = ? FOR UPDATE
                """, id);
            String status = String.valueOf(row.get("status"));
            OffsetDateTime openUntil = asOffsetDateTime(row.get("consultation_open_until"));
            OffsetDateTime databaseNow = asOffsetDateTime(row.get("database_now"));
            if (databaseNow == null) databaseNow = OffsetDateTime.now();
            if (!List.of("OPEN", "WAITING_FOR_DOCTOR", "WAITING_FOR_PATIENT").contains(status)
                    || openUntil == null || !openUntil.isAfter(databaseNow)) {
                expireIfDue(id);
                throw new BusinessException(409, "CONSULTATION_WINDOW_CLOSED", "Cửa sổ tư vấn đã đóng");
            }
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    /** Persist the terminal expiry using PostgreSQL time, never JVM wall time. */
    private void expireIfDue(UUID id) {
        jdbc.update("""
            UPDATE patient_consultation_threads
               SET status = 'EXPIRED', version = version + 1
             WHERE id = ?
               AND status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
               AND consultation_open_until <= CURRENT_TIMESTAMP
            """, id);
    }

    private void appendEvent(UUID threadId, UUID actor, String role, String type, String metadataJson) {
        jdbc.update("""
            INSERT INTO patient_consultation_events
                (thread_id, actor_user_id, actor_role_snapshot, event_type, metadata)
            VALUES (?, ?, ?, ?, ?::jsonb)
            """, threadId, actor, role, type, metadataJson);
    }

    private void requireDoctorParticipant(UUID id, UUID userId) {
        requireExists("""
            SELECT p.thread_id FROM patient_consultation_participants p
             JOIN patient_consultation_threads t ON t.id = p.thread_id
              WHERE p.thread_id = ? AND p.user_id = ?
                AND p.participant_role IN ('ASSIGNED_DOCTOR','HANDOFF_DOCTOR')
                AND p.left_at IS NULL
                AND t.retention_expires_at > CURRENT_TIMESTAMP
            """, id, userId);
    }

    private void requireDoctor(UUID userId) {
        requireExists("""
            SELECT d.id
              FROM doctors d
              JOIN users u ON u.id = d.user_id
              JOIN user_roles ur ON ur.user_id = u.id
              JOIN roles r ON r.id = ur.role_id
             WHERE d.user_id = ? AND d.active AND u.status = 'ACTIVE' AND r.code = 'DOCTOR'
            """, userId);
    }

    private void requireAdmin(UUID userId) {
        requireExists("""
            SELECT u.id
              FROM users u
              JOIN user_roles ur ON ur.user_id = u.id
              JOIN roles r ON r.id = ur.role_id
             WHERE u.id = ? AND u.status = 'ACTIVE' AND r.code = 'ADMIN'
            """, userId);
    }

    private void requireExists(String sql, Object... args) {
        try { jdbc.queryForObject(sql, UUID.class, args); }
        catch (DataAccessException ex) { throw notFound(); }
    }

    private UUID scalarUuid(String sql, Object... args) {
        try { return jdbc.queryForObject(sql, UUID.class, args); }
        catch (DataAccessException ex) { throw new BusinessException(409, "CONSULTATION_DOCTOR_UNAVAILABLE", "Bác sĩ không còn khả dụng"); }
    }

    private ConsultationContracts.ConsultationSummary mapSummary(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ConsultationContracts.ConsultationSummary(rs.getObject("id", UUID.class), rs.getObject("appointment_id", UUID.class),
            rs.getObject("doctor_id", UUID.class), rs.getString("doctor_name"), rs.getString("subject"), rs.getString("status"),
            rs.getObject("consultation_open_until", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class), rs.getLong("unread_count"));
    }

    /** Resolve only a currently active directory doctor assigned to the same
     * appointment specialty and branch; a UUID alone is never authority. */
    private UUID resolveHandoffDoctor(UUID threadId, UUID doctorId, UUID actorId) {
        try {
            return jdbc.queryForObject("""
                SELECT d.user_id
                  FROM doctors d
                  JOIN users u ON u.id = d.user_id AND u.status = 'ACTIVE'
                  JOIN user_roles ur ON ur.user_id = u.id
                  JOIN roles r ON r.id = ur.role_id AND r.code = 'DOCTOR'
                  JOIN patient_consultation_threads t ON t.id = ?
                  JOIN appointments a ON a.id = t.appointment_id
                 WHERE d.id = ? AND d.active
                   AND EXISTS (
                       SELECT 1 FROM doctor_specialties ds
                        JOIN specialties s ON s.id = ds.specialty_id
                       WHERE ds.doctor_id = d.id AND s.active
                         AND (a.specialty_id IS NULL OR ds.specialty_id = a.specialty_id)
                   )
                   AND EXISTS (
                       SELECT 1 FROM doctor_branches db
                        JOIN branches b ON b.id = db.branch_id
                       WHERE db.doctor_id = d.id AND b.active
                         AND (a.branch_id IS NULL OR db.branch_id = a.branch_id)
                   )
                   AND d.user_id <> ?
                """, UUID.class, threadId, doctorId, actorId);
        } catch (DataAccessException ex) {
            throw new BusinessException(409, "CONSULTATION_DOCTOR_UNAVAILABLE", "Bác sĩ không còn khả dụng");
        }
    }

    private ConsultationContracts.AdminQueueItem mapAdminQueueItem(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ConsultationContracts.AdminQueueItem(
            rs.getObject("thread_id", UUID.class), rs.getString("status"),
            rs.getObject("first_response_due_at", OffsetDateTime.class),
            rs.getObject("first_responded_at", OffsetDateTime.class),
            rs.getObject("consultation_open_until", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class), rs.getString("specialty_slug"),
            rs.getString("assignment_role"), rs.getString("assignment_permission"),
            rs.getObject("assigned_at", OffsetDateTime.class));
    }

    private ConsultationContracts.Message mapMessage(Map<String, Object> row, String status) {
        return new ConsultationContracts.Message((UUID) row.get("id"), (UUID) row.get("author_user_id"),
            String.valueOf(row.get("author_role_snapshot")), String.valueOf(row.get("body")), status,
            asOffsetDateTime(row.get("created_at")), List.of());
    }

    private void validateAttachment(ConsultationContracts.AttachmentIntentRequest request) {
        if (!MIME_TYPES.contains(request.mimeType()) || request.sizeBytes() < 1 || request.sizeBytes() > MAX_ATTACHMENT_BYTES
                || !request.sha256Hash().matches("[0-9a-fA-F]{64}")) {
            throw new BusinessException(400, "CONSULTATION_ATTACHMENT_INVALID", "Tệp không đúng định dạng hoặc kích thước");
        }
    }

    private int validateLimit(int limit) {
        if (limit < 1 || limit > MAX_PAGE_SIZE) {
            throw new BusinessException(400, "CONSULTATION_LIMIT_INVALID", "Limit phải nằm trong khoảng 1 đến 100");
        }
        return limit;
    }

    private MessageRow mapMessageRow(java.sql.ResultSet rs, int rowNumber) throws java.sql.SQLException {
        return new MessageRow(
            rs.getObject("id", UUID.class),
            rs.getObject("author_user_id", UUID.class),
            rs.getString("author_role_snapshot"),
            rs.getString("body"),
            rs.getString("status"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getLong("sequence_number"));
    }

    private String encodeCursor(long sequence, UUID id) {
        String payload = sequence + ":" + id;
        String signature = sign(payload);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(
            (payload + "." + signature).getBytes(StandardCharsets.UTF_8));
    }

    private Cursor decodeCursor(String rawCursor) {
        if (rawCursor == null || rawCursor.isBlank()) return null;
        try {
            String token = new String(Base64.getUrlDecoder().decode(rawCursor), StandardCharsets.UTF_8);
            int dot = token.lastIndexOf('.');
            int colon = token.indexOf(':');
            if (dot <= 0 || colon <= 0 || colon >= dot) throw new IllegalArgumentException();
            String payload = token.substring(0, dot);
            String expected = sign(payload);
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                    token.substring(dot + 1).getBytes(StandardCharsets.US_ASCII))) {
                throw new IllegalArgumentException();
            }
            long sequence = Long.parseLong(payload.substring(0, colon));
            UUID id = UUID.fromString(payload.substring(colon + 1));
            if (sequence <= 0) throw new IllegalArgumentException();
            return new Cursor(sequence, id);
        } catch (RuntimeException ex) {
            throw new BusinessException(400, "CONSULTATION_CURSOR_INVALID", "Cursor tư vấn không hợp lệ");
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(CURSOR_KEY, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Unable to sign consultation cursor", ex);
        }
    }

    private record Cursor(long sequence, UUID id) {}

    private record MessageRow(UUID id, UUID authorUserId, String authorRole,
                              String body, String status, OffsetDateTime createdAt,
                              long sequence) {}

    private static final class MessageDigestHolder {
        private static byte[] sha256(String value) {
            try {
                return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            } catch (GeneralSecurityException ex) {
                throw new ExceptionInInitializerError(ex);
            }
        }
    }

    private boolean isDoctor(UUID userId) {
        try { return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(
                SELECT 1 FROM doctors d
                JOIN users u ON u.id = d.user_id
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE d.user_id = ? AND d.active AND u.status = 'ACTIVE' AND r.code = 'DOCTOR'
            )
            """, Boolean.class, userId)); }
        catch (DataAccessException ex) { return false; }
    }

    private UUID currentUserId(UserDetails principal) {
        if (principal == null) throw new AccessDeniedException("Authentication required");
        if (principal instanceof HealthcareUserPrincipal hp) return hp.getUserId();
        return users.findByEmail(principal.getUsername()).map(User::getId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    /** JdbcTemplate may expose PostgreSQL timestamptz as Timestamp depending on
     * driver/result-map path. Normalize at the boundary instead of casting. */
    private OffsetDateTime asOffsetDateTime(Object value) {
        if (value == null) return null;
        if (value instanceof OffsetDateTime offset) return offset;
        if (value instanceof Instant instant) return instant.atOffset(ZoneOffset.UTC);
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant().atOffset(ZoneOffset.UTC);
        if (value instanceof java.util.Date date) return date.toInstant().atOffset(ZoneOffset.UTC);
        if (value instanceof LocalDateTime local) return local.atOffset(ZoneOffset.UTC);
        if (value instanceof CharSequence text) {
            try { return OffsetDateTime.parse(text.toString()); }
            catch (RuntimeException ignored) { return LocalDateTime.parse(text.toString()).atOffset(ZoneOffset.UTC); }
        }
        throw new IllegalArgumentException("Unsupported consultation timestamp type");
    }

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("CONSULTATION_NOT_FOUND", "Không tìm thấy tư vấn");
    }
}
