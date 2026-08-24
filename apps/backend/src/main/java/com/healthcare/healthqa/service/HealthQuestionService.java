package com.healthcare.healthqa.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.healthqa.dto.HealthQuestionContracts;
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class HealthQuestionService {
    private static final Pattern PII = Pattern.compile("(?i)([A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|(?:\\+?84|0)(?:3|5|7|8|9)\\d{8}|\\b\\d{9,12}\\b)");
    private static final List<String> REPORT_REASONS = List.of(
        "PII_DETECTED", "SAFETY_CONCERN", "OUT_OF_SCOPE", "DUPLICATE", "SPAM", "LEGAL_REQUEST");
    private static final List<String> REPORT_STATUSES = List.of("UNDER_REVIEW", "RESOLVED", "DISMISSED");
    private static final List<String> REPORT_RESOLUTIONS = List.of(
        "REMOVED", "ESCALATED", "DUPLICATE", "DISMISSED", "NO_ACTION");
    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public HealthQuestionService(JdbcTemplate jdbc, UserRepository users) { this.jdbc = jdbc; this.users = users; }

    @Transactional
    public HealthQuestionContracts.Summary create(HealthQuestionContracts.CreateRequest request, UserDetails principal) {
        UUID userId = currentUser(principal);
        String topic = request.topicSlug().trim().toLowerCase();
        if (!topic.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) throw new BusinessException(400, "HEALTH_QUESTION_TOPIC_INVALID", "Chủ đề không hợp lệ");
        String question = request.question().trim();
        if (PII.matcher(question).find()) throw new BusinessException(400, "HEALTH_QUESTION_PII", "Không đưa thông tin liên hệ hoặc định danh vào câu hỏi");
        UUID profile = scalar("SELECT id FROM patient_profiles WHERE user_id = ?", userId);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO health_questions(id, patient_profile_id, author_user_id, topic_slug,
                normalized_question, public_alias, pii_scan_status, pii_scanned_at, status)
            VALUES (?, ?, ?, ?, ?, ?, 'CLEAR', CURRENT_TIMESTAMP, 'PENDING_MODERATION')
            """, id, profile, userId, topic, question, request.publicAlias().trim());
        return get(id, userId, true);
    }

    @Transactional(readOnly = true)
    public List<HealthQuestionContracts.Summary> patientList(UserDetails principal) {
        UUID user = currentUser(principal);
        UUID profile = scalar("SELECT id FROM patient_profiles WHERE user_id = ?", user);
        return list("WHERE q.patient_profile_id = ?", profile);
    }

    /** A patient can report a published question without adding free-text moderation data. */
    @Transactional
    public HealthQuestionContracts.ReportSummary report(
            UUID questionId, HealthQuestionContracts.ReportRequest request, UserDetails principal) {
        UUID reporter = currentUser(principal);
        requirePublishedQuestion(questionId);
        String reason = normalizeReportReason(request.reasonCode());
        try {
            Map<String, Object> existing = jdbc.queryForMap("""
                SELECT id, question_id, reason_code, status, created_at, handled_at, resolution_code
                  FROM health_question_reports
                 WHERE question_id = ? AND reporter_user_id = ? AND reason_code = ?
                   AND status IN ('OPEN', 'UNDER_REVIEW')
                 ORDER BY created_at DESC LIMIT 1
                """, questionId, reporter, reason);
            if (existing != null && !existing.isEmpty()) return mapReport(existing);
        } catch (EmptyResultDataAccessException ignored) {
            // First report for this question/reason.
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO health_question_reports(id, question_id, reporter_user_id, reason_code)
            VALUES (?, ?, ?, ?)
            """, id, questionId, reporter, reason);
        return reportById(questionId, id);
    }

    @Transactional(readOnly = true)
    public List<HealthQuestionContracts.ReportSummary> adminReports(UUID questionId, String status) {
        if (status != null && !status.isBlank() && !List.of("OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED").contains(status.trim().toUpperCase())) {
            throw new BusinessException(400, "HEALTH_QUESTION_REPORT_STATUS_INVALID", "Trạng thái báo cáo không hợp lệ");
        }
        String normalized = status == null || status.isBlank() ? null : status.trim().toUpperCase();
        String sql = """
            SELECT id, question_id, reason_code, status, created_at, handled_at, resolution_code
              FROM health_question_reports
             WHERE question_id = ? AND retention_expires_at > CURRENT_TIMESTAMP
            """ + (normalized == null ? "" : " AND status = ?")
            + " ORDER BY created_at DESC LIMIT 200";
        Object[] args = normalized == null ? new Object[] { questionId } : new Object[] { questionId, normalized };
        try {
            return jdbc.query(sql, (rs, n) -> mapReport(rs), args);
        } catch (EmptyResultDataAccessException ignored) {
            return List.of();
        }
    }

    @Transactional
    public HealthQuestionContracts.ReportSummary decideReport(
            UUID questionId, UUID reportId, HealthQuestionContracts.ReportDecisionRequest request,
            UserDetails principal) {
        UUID admin = currentUser(principal);
        requireAdmin(admin);
        String status = request.status().trim().toUpperCase();
        if (!REPORT_STATUSES.contains(status)) {
            throw new BusinessException(400, "HEALTH_QUESTION_REPORT_STATUS_INVALID", "Trạng thái xử lý báo cáo không hợp lệ");
        }
        String resolution = request.resolutionCode() == null ? null : request.resolutionCode().trim().toUpperCase();
        if (("RESOLVED".equals(status) || "DISMISSED".equals(status))
                && (resolution == null || !REPORT_RESOLUTIONS.contains(resolution))) {
            throw new BusinessException(400, "HEALTH_QUESTION_REPORT_RESOLUTION_REQUIRED", "Cần mã xử lý hợp lệ");
        }
        if ("UNDER_REVIEW".equals(status) && resolution != null) {
            throw new BusinessException(400, "HEALTH_QUESTION_REPORT_RESOLUTION_INVALID", "Báo cáo đang xem xét không có mã kết quả");
        }
        int changed = jdbc.update("""
            UPDATE health_question_reports
               SET status = ?, handled_by_admin_user_id = ?, handled_at = CURRENT_TIMESTAMP,
                   resolution_code = ?
             WHERE id = ? AND question_id = ? AND status IN ('OPEN', 'UNDER_REVIEW')
               AND retention_expires_at > CURRENT_TIMESTAMP
            """, status, admin, resolution, reportId, questionId);
        if (changed == 0) throw reportNotFound();
        if ("RESOLVED".equals(status) && "REMOVED".equals(resolution)) {
            jdbc.update("UPDATE health_questions SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PUBLISHED'", questionId);
            jdbc.update("UPDATE faqs SET active = FALSE, published_at = NULL WHERE origin_question_id = ?", questionId);
        }
        return reportById(questionId, reportId);
    }

    @Transactional(readOnly = true)
    public List<HealthQuestionContracts.Summary> adminQueue(String state) {
        if (state == null || state.isBlank()) return list("WHERE q.status <> 'CLOSED'");
        return list("WHERE q.status = ?", state.trim());
    }

    @Transactional(readOnly = true)
    public List<HealthQuestionContracts.Summary> doctorQueue(UserDetails principal) {
        UUID doctor = currentUser(principal);
        requireDoctor(doctor);
        return list("WHERE q.status IN ('AWAITING_DOCTOR', 'ANSWER_SUBMITTED')");
    }

    @Transactional
    public void moderate(UUID id, HealthQuestionContracts.ModerationRequest request, UserDetails principal) {
        UUID admin = currentUser(principal);
        requireAdmin(admin);
        String decision = request.decision().trim().toUpperCase();
        if (!List.of("APPROVE", "REJECT", "CLOSE").contains(decision)) throw new BusinessException(400, "HEALTH_QUESTION_DECISION_INVALID", "Quyết định kiểm duyệt không hợp lệ");
        if (!"APPROVE".equals(decision) && (request.reasonCode() == null || request.reasonCode().isBlank())) {
            throw new BusinessException(400, "HEALTH_QUESTION_REASON_REQUIRED", "Cần nêu lý do khi từ chối hoặc đóng câu hỏi");
        }
        String status = switch (decision) { case "APPROVE" -> "AWAITING_DOCTOR"; case "REJECT" -> "REJECTED"; default -> "CLOSED"; };
        int changed = jdbc.update("""
            UPDATE health_questions SET status = ?, moderator_user_id = ?, moderated_at = CURRENT_TIMESTAMP,
                   moderation_reason_code = ? WHERE id = ? AND status = 'PENDING_MODERATION'
            """, status, admin, request.reasonCode(), id);
        if (changed == 0) throw notFound();
    }

    @Transactional
    public void answer(UUID id, HealthQuestionContracts.AnswerRequest request, UserDetails principal) {
        UUID doctor = currentUser(principal);
        requireDoctor(doctor);
        String answer = request.answer().trim();
        if (PII.matcher(answer).find()) throw new BusinessException(400, "HEALTH_QUESTION_PII", "Không đưa thông tin liên hệ hoặc định danh vào câu trả lời");
        String hash = sha256(answer);
        lockQuestion(id, "AWAITING_DOCTOR");
        int changed = jdbc.update("""
            INSERT INTO health_question_answers(question_id, revision, doctor_user_id, answer_text, answer_hash)
            SELECT ?, COALESCE(MAX(revision), 0) + 1, ?, ?, ? FROM health_question_answers WHERE question_id = ?
        """, id, doctor, answer, hash, id);
        if (changed == 0) throw notFound();
        jdbc.update("UPDATE health_questions SET status = 'ANSWER_SUBMITTED' WHERE id = ?", id);
    }

    @Transactional
    public void decide(UUID id, HealthQuestionContracts.DecisionRequest request, UserDetails principal) {
        UUID reviewer = currentUser(principal);
        requireDoctor(reviewer);
        String decision = request.decision().trim().toUpperCase();
        String status = switch (decision) { case "APPROVE" -> "APPROVED"; case "REQUEST_CHANGES" -> "CHANGES_REQUESTED"; case "REVOKE" -> "REVOKED"; default -> throw new BusinessException(400, "HEALTH_QUESTION_DECISION_INVALID", "Quyết định không hợp lệ"); };
        if (!"APPROVE".equals(decision) && (request.reasonCode() == null || request.reasonCode().isBlank())) {
            throw new BusinessException(400, "HEALTH_QUESTION_REASON_REQUIRED", "Cần nêu lý do khi yêu cầu sửa hoặc revoke");
        }
        lockQuestion(id, "ANSWER_SUBMITTED");
        MapRow answer = latestAnswer(id);
        if (answer.doctorId().equals(reviewer)) throw new BusinessException(403, "HEALTH_QUESTION_SELF_APPROVAL", "Bác sĩ không thể tự duyệt câu trả lời của mình");
        int changed = jdbc.update("""
            UPDATE health_question_answers SET status = ?, reviewer_user_id = ?, reviewed_at = CURRENT_TIMESTAMP,
                   review_reason_code = ? WHERE id = ? AND status = 'SUBMITTED'
            """, status, reviewer, request.reasonCode(), answer.id());
        if (changed == 0) throw new BusinessException(409, "HEALTH_QUESTION_ALREADY_DECIDED", "Câu trả lời đã được quyết định");
        if ("APPROVED".equals(status)) {
            jdbc.update("UPDATE health_questions SET status = 'PUBLISHED' WHERE id = ?", id);
            // Materialize an inactive FAQ revision for the existing clinical
            // review queue. It is intentionally not public/RAG-eligible until
            // the normal AI content approval workflow approves it.
            jdbc.update("""
                INSERT INTO faqs(id, question, answer, category, topic_slug, origin_question_id,
                                 active, published_at, published_by, version)
                SELECT gen_random_uuid(), q.normalized_question, a.answer_text, 'Q&A', q.topic_slug,
                       q.id, FALSE, NULL, NULL, 1
                  FROM health_questions q
                  JOIN health_question_answers a ON a.question_id = q.id AND a.id = ?
                 WHERE q.id = ? AND NOT EXISTS (
                       SELECT 1 FROM faqs f WHERE f.origin_question_id = q.id)
                """, answer.id(), id);
        } else if ("CHANGES_REQUESTED".equals(status)) {
            jdbc.update("UPDATE health_questions SET status = 'AWAITING_DOCTOR' WHERE id = ?", id);
        } else {
            jdbc.update("UPDATE health_questions SET status = 'CLOSED' WHERE id = ?", id);
        }
    }

    @Transactional(readOnly = true)
    public List<HealthQuestionContracts.Summary> publicList(String topic) {
        if (topic == null || topic.isBlank()) return list("WHERE q.status = 'PUBLISHED'");
        String normalized = topic.trim().toLowerCase();
        if (!normalized.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) return List.of();
        return list("WHERE q.status = 'PUBLISHED' AND q.topic_slug = ?", normalized);
    }

    private List<HealthQuestionContracts.Summary> list(String where, Object... args) {
        return jdbc.query("""
            SELECT q.id, q.topic_slug, q.normalized_question, q.public_alias, q.status, q.created_at,
                   a.answer_text, a.status answer_status
              FROM health_questions q LEFT JOIN LATERAL (
                    SELECT answer_text, status FROM health_question_answers
                     WHERE question_id = q.id ORDER BY revision DESC LIMIT 1
              ) a ON TRUE """ + (where.isBlank() ? "WHERE" : where + " AND")
            + " q.retention_expires_at > CURRENT_TIMESTAMP AND q.deleted_at IS NULL ORDER BY q.created_at DESC LIMIT 200", (rs, n) -> new HealthQuestionContracts.Summary(
                rs.getObject("id", UUID.class), rs.getString("topic_slug"), rs.getString("normalized_question"),
                rs.getString("public_alias"), rs.getString("status"), rs.getObject("created_at", OffsetDateTime.class),
                rs.getString("answer_text"), rs.getString("answer_status")), args);
    }

    private HealthQuestionContracts.Summary get(UUID id, UUID userId, boolean owner) {
        List<HealthQuestionContracts.Summary> values = list(owner ? "WHERE q.id = ? AND q.author_user_id = ?" : "WHERE q.id = ?", owner ? new Object[]{id, userId} : new Object[]{id});
        if (values.isEmpty()) throw notFound();
        return values.get(0);
    }

    private MapRow latestAnswer(UUID id) {
        try { return jdbc.queryForObject("SELECT id, doctor_user_id FROM health_question_answers WHERE question_id = ? ORDER BY revision DESC LIMIT 1", (rs, n) -> new MapRow(rs.getObject("id", UUID.class), rs.getObject("doctor_user_id", UUID.class)), id); }
        catch (DataAccessException ex) { throw notFound(); }
    }
    private record MapRow(UUID id, UUID doctorId) {}

    private void requirePublishedQuestion(UUID id) {
        try {
            jdbc.queryForObject("SELECT id FROM health_questions WHERE id = ? AND status = 'PUBLISHED' AND pii_scan_status = 'CLEAR' AND retention_expires_at > CURRENT_TIMESTAMP AND deleted_at IS NULL", UUID.class, id);
        } catch (DataAccessException ex) {
            throw new ResourceNotFoundException("HEALTH_QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi");
        }
    }

    private String normalizeReportReason(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        if (!REPORT_REASONS.contains(normalized)) {
            throw new BusinessException(400, "HEALTH_QUESTION_REPORT_REASON_INVALID", "Lý do báo cáo không hợp lệ");
        }
        return normalized;
    }

    private HealthQuestionContracts.ReportSummary reportById(UUID questionId, UUID reportId) {
        try {
            return jdbc.queryForObject("""
                SELECT id, question_id, reason_code, status, created_at, handled_at, resolution_code
                  FROM health_question_reports
                 WHERE id = ? AND question_id = ? AND retention_expires_at > CURRENT_TIMESTAMP
                """, (rs, n) -> mapReport(rs), reportId, questionId);
        } catch (DataAccessException ex) {
            throw reportNotFound();
        }
    }

    private HealthQuestionContracts.ReportSummary mapReport(Map<String, Object> row) {
        return new HealthQuestionContracts.ReportSummary(
            (UUID) row.get("id"), (UUID) row.get("question_id"), String.valueOf(row.get("reason_code")),
            String.valueOf(row.get("status")), (OffsetDateTime) row.get("created_at"),
            (OffsetDateTime) row.get("handled_at"), row.get("resolution_code") == null ? null : String.valueOf(row.get("resolution_code")));
    }

    private HealthQuestionContracts.ReportSummary mapReport(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new HealthQuestionContracts.ReportSummary(
            rs.getObject("id", UUID.class), rs.getObject("question_id", UUID.class), rs.getString("reason_code"),
            rs.getString("status"), rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("handled_at", OffsetDateTime.class), rs.getString("resolution_code"));
    }

    private ResourceNotFoundException reportNotFound() {
        return new ResourceNotFoundException("HEALTH_QUESTION_REPORT_NOT_FOUND", "Không tìm thấy báo cáo");
    }

    private void lockQuestion(UUID id, String expectedStatus) {
        try {
            String state = jdbc.queryForObject("SELECT status FROM health_questions WHERE id = ? FOR UPDATE", String.class, id);
            if (!expectedStatus.equals(state)) {
                throw new BusinessException(409, "HEALTH_QUESTION_NOT_SUBMITTED", "Câu hỏi không ở trạng thái có thể xử lý");
            }
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    private UUID scalar(String sql, Object... args) { try { return jdbc.queryForObject(sql, UUID.class, args); } catch (DataAccessException ex) { throw new AccessDeniedException("Patient profile unavailable"); } }
    private void requireDoctor(UUID id) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(
                SELECT 1
                  FROM doctors d
                  JOIN users u ON u.id = d.user_id
                  JOIN user_roles ur ON ur.user_id = u.id
                  JOIN roles r ON r.id = ur.role_id
                 WHERE d.user_id = ? AND d.active AND u.status = 'ACTIVE' AND r.code = 'DOCTOR'
            )
            """, Boolean.class, id))) throw new AccessDeniedException("Doctor authentication required");
    }

    private void requireAdmin(UUID id) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(
                SELECT 1
                  FROM user_roles ur
                  JOIN roles r ON r.id = ur.role_id
                  JOIN users u ON u.id = ur.user_id
                 WHERE ur.user_id = ? AND u.status = 'ACTIVE' AND r.code = 'ADMIN'
            )
            """, Boolean.class, id))) throw new AccessDeniedException("Admin authentication required");
    }
    private UUID currentUser(UserDetails principal) { if (principal instanceof HealthcareUserPrincipal hp) return hp.getUserId(); if (principal == null) throw new AccessDeniedException("Authentication required"); return users.findByEmail(principal.getUsername()).map(User::getId).orElseThrow(() -> new AccessDeniedException("Authenticated user unavailable")); }
    private String sha256(String value) { try { byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); StringBuilder out = new StringBuilder(); for (byte b : digest) out.append(String.format("%02x", b)); return out.toString(); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private ResourceNotFoundException notFound() { return new ResourceNotFoundException("HEALTH_QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi"); }
}
