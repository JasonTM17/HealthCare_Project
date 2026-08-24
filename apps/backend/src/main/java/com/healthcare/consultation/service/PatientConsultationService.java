package com.healthcare.consultation.service;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
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
    private static final List<String> MIME_TYPES = List.of("image/jpeg", "image/png", "application/pdf");

    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public PatientConsultationService(JdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
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
        if (!List.of("CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED").contains(status)) {
            throw new BusinessException(409, "CONSULTATION_APPOINTMENT_NOT_ELIGIBLE", "Lịch hẹn chưa mở cửa sổ tư vấn");
        }
        OffsetDateTime appointmentAt = (OffsetDateTime) appointment.get("appointment_time");
        if (appointmentAt == null || !appointmentAt.plusDays(30).isAfter(OffsetDateTime.now())) {
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
                   0::bigint unread_count
              FROM patient_consultation_threads t
              JOIN patient_profiles p ON p.id = t.patient_profile_id AND p.user_id = ?
              JOIN doctors d ON d.id = t.doctor_id
                 WHERE t.retention_expires_at > CURRENT_TIMESTAMP
             ORDER BY t.updated_at DESC
            """, (rs, n) -> mapSummary(rs), userId);
    }

    @Transactional(readOnly = true)
    public ConsultationContracts.Detail detail(UUID id, UserDetails principal) {
        UUID userId = currentUserId(principal);
        ConsultationContracts.ConsultationSummary summary = summary(id, userId);
        List<ConsultationContracts.Message> messages = messages(id, principal, 100);
        return new ConsultationContracts.Detail(summary, messages);
    }

    @Transactional(readOnly = true)
    public List<ConsultationContracts.Message> messages(UUID id, UserDetails principal, int limit) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        int bounded = Math.max(1, Math.min(limit, 100));
        List<ConsultationContracts.Message> messages = jdbc.query("""
            SELECT m.id, m.author_user_id, m.author_role_snapshot, m.body,
                   CASE WHEN m.author_user_id = ? THEN 'SENT' ELSE 'READ' END status,
                   m.created_at
              FROM patient_consultation_messages m
             WHERE m.thread_id = ? AND m.retention_expires_at > CURRENT_TIMESTAMP
             ORDER BY m.sequence_number ASC LIMIT ?
            """, (rs, n) -> new ConsultationContracts.Message(
                rs.getObject("id", UUID.class), rs.getObject("author_user_id", UUID.class),
                rs.getString("author_role_snapshot"), rs.getString("body"), rs.getString("status"),
                rs.getObject("created_at", OffsetDateTime.class), List.of()), userId, id, bounded);
        if (messages.isEmpty()) return messages;
        List<UUID> messageIds = messages.stream().map(ConsultationContracts.Message::id).toList();
        String placeholders = String.join(",", java.util.Collections.nCopies(messageIds.size(), "?"));
        Object[] attachmentArgs = new Object[messageIds.size() + 1];
        attachmentArgs[0] = id;
        for (int index = 0; index < messageIds.size(); index++) attachmentArgs[index + 1] = messageIds.get(index);
        Map<UUID, List<ConsultationContracts.Attachment>> attachments = new HashMap<>();
        String attachmentSql = "SELECT id, message_id, actual_mime_type, size_bytes, scan_status "
            + "FROM patient_consultation_attachments "
            + "WHERE thread_id = ? AND message_id IN (" + placeholders + ") "
            + "AND retention_expires_at > CURRENT_TIMESTAMP "
            + "ORDER BY created_at ASC, id ASC";
        jdbc.query(attachmentSql, rs -> {
                UUID messageId = rs.getObject("message_id", UUID.class);
                attachments.computeIfAbsent(messageId, ignored -> new ArrayList<>()).add(
                    new ConsultationContracts.Attachment(
                        rs.getObject("id", UUID.class), rs.getString("actual_mime_type"),
                        rs.getLong("size_bytes"), rs.getString("scan_status"), null));
            }, attachmentArgs);
        return messages.stream()
            .map(message -> new ConsultationContracts.Message(
                message.id(), message.authorUserId(), message.authorRole(), message.body(), message.status(),
                message.createdAt(), List.copyOf(attachments.getOrDefault(message.id(), List.of()))))
            .toList();
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
        if (request != null && request.lastReadMessageId() != null) {
            jdbc.update("""
                INSERT INTO patient_consultation_read_states
                    (thread_id, user_id, last_read_message_id, last_read_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (thread_id, user_id) DO UPDATE SET
                    last_read_message_id = EXCLUDED.last_read_message_id,
                    last_read_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                """, id, userId, request.lastReadMessageId());
            appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "STATUS_CHANGE",
                "{\"lastReadMessageId\":\"" + request.lastReadMessageId() + "\"}");
        }
    }

    @Transactional
    public void close(UUID id, UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        int changed = jdbc.update("UPDATE patient_consultation_threads SET status = 'CLOSED', version = version + 1 WHERE id = ? AND status <> 'CLOSED'", id);
        if (changed > 0) appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "STATUS_CHANGE", "{\"status\":\"CLOSED\"}");
    }

    @Transactional
    public ConsultationContracts.Attachment attachmentIntent(UUID id, ConsultationContracts.AttachmentIntentRequest request,
                                                              UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        validateAttachment(request);
        requireMessageAuthor(id, request.messageId(), userId);
        UUID attachmentId = UUID.randomUUID();
        // The browser may suggest a key for the upload protocol, but it is
        // never authoritative.  Generate the private object key server-side
        // so a client cannot select another thread's object or smuggle path
        // components into storage.  A trusted object-store/AV worker must
        // still verify the bytes and MIME before the attachment becomes CLEAN.
        String objectKey = "private/consultations/" + id + "/" + attachmentId;
        jdbc.update("""
            INSERT INTO patient_consultation_attachments
                (id, thread_id, message_id, private_object_key, actual_mime_type,
                 size_bytes, sha256_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, attachmentId, id, request.messageId(), objectKey, request.mimeType(),
            request.sizeBytes(), request.sha256Hash().toLowerCase());
        appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "SCAN_RESULT", "{\"attachmentId\":\"" + attachmentId + "\",\"status\":\"PENDING\"}");
        return new ConsultationContracts.Attachment(attachmentId, request.mimeType(), request.sizeBytes(), "PENDING", null);
    }

    @Transactional
    public ConsultationContracts.Attachment completeAttachment(UUID id, UUID attachmentId,
        ConsultationContracts.AttachmentCompleteRequest request,
                                                                 UserDetails principal) {
        UUID userId = currentUserId(principal);
        requireParticipant(id, userId);
        // A patient/doctor browser is not a scanner of record.  Keep the
        // attachment quarantined until a trusted AV/MIME worker calls the
        // internal scan service; never trust a client-provided `clean=true`.
        int changed = jdbc.update("UPDATE patient_consultation_attachments SET scan_status = 'PENDING' WHERE id = ? AND thread_id = ? AND scan_status = 'PENDING'", attachmentId, id);
        if (changed == 0) throw notFound();
        Map<String, Object> row = jdbc.queryForMap("SELECT actual_mime_type, size_bytes, scan_status FROM patient_consultation_attachments WHERE id = ? AND thread_id = ?", attachmentId, id);
        appendEvent(id, userId, isDoctor(userId) ? "DOCTOR" : "PATIENT", "SCAN_RESULT", "{\"attachmentId\":\"" + attachmentId + "\",\"status\":\"PENDING\"}");
        return new ConsultationContracts.Attachment(attachmentId, String.valueOf(row.get("actual_mime_type")), ((Number) row.get("size_bytes")).longValue(), String.valueOf(row.get("scan_status")), null);
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
                   t.consultation_open_until, t.updated_at, 0::bigint unread_count
             FROM patient_consultation_threads t
              JOIN doctors d ON d.id = t.doctor_id
              JOIN patient_consultation_participants p ON p.thread_id = t.id
             WHERE t.retention_expires_at > CURRENT_TIMESTAMP
               AND (d.user_id = ? OR (p.user_id = ? AND p.participant_role = 'HANDOFF_DOCTOR'))
             ORDER BY t.updated_at DESC
            """, (rs, n) -> mapSummary(rs), userId, userId);
    }

    @Transactional
    public void handoff(UUID id, ConsultationContracts.HandoffRequest request, UserDetails principal) {
        UUID actor = currentUserId(principal);
        requireDoctor(actor);
        requireDoctorParticipant(id, actor);
        UUID targetUser = scalarUuid("SELECT user_id FROM doctors WHERE id = ? AND active", request.doctorId());
        jdbc.update("""
            INSERT INTO patient_consultation_participants(thread_id, user_id, participant_role, assigned_by_user_id)
            VALUES (?, ?, 'HANDOFF_DOCTOR', ?)
            ON CONFLICT (thread_id, user_id, participant_role) DO NOTHING
            """, id, targetUser, actor);
        jdbc.update("UPDATE patient_consultation_threads SET status = 'WAITING_FOR_DOCTOR', version = version + 1 WHERE id = ? AND retention_expires_at > CURRENT_TIMESTAMP", id);
        appendEvent(id, actor, "DOCTOR", "HANDOFF", "{\"doctorId\":\"" + request.doctorId() + "\"}");
    }

    @Transactional(readOnly = true)
    public List<ConsultationContracts.ConsultationSummary> listForAdmin() {
        return jdbc.query("""
            SELECT t.id, t.appointment_id, t.doctor_id, d.full_name doctor_name,
                   t.subject,
                   CASE WHEN t.status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT')
                              AND t.consultation_open_until <= CURRENT_TIMESTAMP
                        THEN 'EXPIRED' ELSE t.status END AS status,
                   t.consultation_open_until, t.updated_at, 0::bigint unread_count
              FROM patient_consultation_threads t JOIN doctors d ON d.id = t.doctor_id
             WHERE t.retention_expires_at > CURRENT_TIMESTAMP ORDER BY t.updated_at DESC
            """, (rs, n) -> mapSummary(rs));
    }

    @Transactional
    public void assign(UUID id, ConsultationContracts.HandoffRequest request, UserDetails principal) {
        UUID admin = currentUserId(principal);
        requireAdmin(admin);
        UUID targetUser = scalarUuid("SELECT user_id FROM doctors WHERE id = ? AND active", request.doctorId());
        requireExists("SELECT id FROM patient_consultation_threads WHERE id = ? AND retention_expires_at > CURRENT_TIMESTAMP", id);
        jdbc.update("""
            INSERT INTO patient_consultation_participants(thread_id, user_id, participant_role, assigned_by_user_id)
            VALUES (?, ?, 'HANDOFF_DOCTOR', ?) ON CONFLICT DO NOTHING
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
                       t.consultation_open_until, t.updated_at, 0::bigint unread_count
                  FROM patient_consultation_threads t JOIN doctors d ON d.id = t.doctor_id
                 WHERE t.id = ?
                   AND t.retention_expires_at > CURRENT_TIMESTAMP
                   AND EXISTS (SELECT 1 FROM patient_consultation_participants p WHERE p.thread_id = t.id AND p.user_id = ?)
                """, (rs, n) -> mapSummary(rs), id, userId);
        } catch (EmptyResultDataAccessException ex) { throw notFound(); }
    }

    private Map<String, Object> appointmentForPatient(UUID appointmentId, UUID userId) {
        try {
            return jdbc.queryForMap("""
                SELECT a.id, a.patient_id, a.doctor_id, a.status, a.appointment_time
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
            Map<String, Object> row = jdbc.queryForMap("SELECT status, consultation_open_until FROM patient_consultation_threads WHERE id = ? FOR UPDATE", id);
            String status = String.valueOf(row.get("status"));
            OffsetDateTime openUntil = (OffsetDateTime) row.get("consultation_open_until");
            if (!List.of("OPEN", "WAITING_FOR_DOCTOR", "WAITING_FOR_PATIENT").contains(status)
                    || openUntil == null || !openUntil.isAfter(OffsetDateTime.now())) {
                throw new BusinessException(409, "CONSULTATION_WINDOW_CLOSED", "Cửa sổ tư vấn đã đóng");
            }
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
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
             WHERE p.thread_id = ? AND p.user_id = ? AND p.participant_role IN ('ASSIGNED_DOCTOR','HANDOFF_DOCTOR')
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

    private ConsultationContracts.Message mapMessage(Map<String, Object> row, String status) {
        return new ConsultationContracts.Message((UUID) row.get("id"), (UUID) row.get("author_user_id"),
            String.valueOf(row.get("author_role_snapshot")), String.valueOf(row.get("body")), status,
            (OffsetDateTime) row.get("created_at"), List.of());
    }

    private void validateAttachment(ConsultationContracts.AttachmentIntentRequest request) {
        if (!MIME_TYPES.contains(request.mimeType()) || request.sizeBytes() < 1 || request.sizeBytes() > MAX_ATTACHMENT_BYTES
                || !request.sha256Hash().matches("[0-9a-fA-F]{64}")
                || !request.objectKey().startsWith("private/consultations/")
                || request.objectKey().contains("..") || request.objectKey().contains("\\")) {
            throw new BusinessException(400, "CONSULTATION_ATTACHMENT_INVALID", "Tệp không đúng định dạng hoặc kích thước");
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

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("CONSULTATION_NOT_FOUND", "Không tìm thấy tư vấn");
    }
}
