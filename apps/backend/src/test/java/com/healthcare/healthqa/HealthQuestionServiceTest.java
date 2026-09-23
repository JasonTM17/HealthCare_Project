package com.healthcare.healthqa;

import com.healthcare.ai.service.AiClinicalContentRevisionService;
import com.healthcare.exception.BusinessException;
import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.UUID;
import java.util.List;
import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class HealthQuestionServiceTest {
    @Test
    void adminQueueKeepsSqlBoundaryBetweenLateralJoinAndWhereClause() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        HealthQuestionService service = new HealthQuestionService(jdbc, users);

        service.adminQueue(null);

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class));
        assertThat(sql.getValue())
            .contains("ON TRUE WHERE q.status")
            .contains("AND q.retention_expires_at")
            .doesNotContain("TRUEWHERE");
    }

    @Test
    void vietnamesePhoneAndIdentityLikeNumbersAreRejectedBeforePersistence() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        User user = new User();
        user.setId(UUID.randomUUID());
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        HealthQuestionService service = new HealthQuestionService(jdbc, users);

        var request = new HealthQuestionContracts.CreateRequest(
            "noi-tiet", "Tôi bị đau đầu, liên hệ số 0912345678", "Benh nhan 01");
        assertThatThrownBy(() -> service.create(request, principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("HEALTH_QUESTION_PII");
        verifyNoInteractions(jdbc);
    }

    @Test
    void clearQuestionUsesPublicAliasPlaceholderBeforeModeration() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        User user = new User();
        UUID userId = UUID.randomUUID();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        UUID profileId = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), any(Object[].class))).thenReturn(profileId);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        HealthQuestionContracts.Summary summary = new HealthQuestionContracts.Summary(
            UUID.randomUUID(), "noi-tiet", "Tôi hay khát nước", "Benh nhan 01",
            "PENDING_MODERATION", null, null, null);
        doReturn(List.of(summary)).when(jdbc).query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class));

        HealthQuestionService service = new HealthQuestionService(jdbc, users);
        service.create(new HealthQuestionContracts.CreateRequest(
            "noi-tiet", "Tôi hay khát nước", "Benh nhan 01"), principal);

        verify(jdbc).update(contains("INSERT INTO health_questions"), any(Object[].class));
    }

    @Test
    void reportRejectsUnknownReasonBeforeWritingModerationData() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        User user = new User();
        user.setId(UUID.randomUUID());
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        UUID questionId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("status = 'PUBLISHED'"), eq(UUID.class), eq(questionId)))
            .thenReturn(questionId);

        HealthQuestionService service = new HealthQuestionService(jdbc, users);
        assertThatThrownBy(() -> service.report(questionId,
            new HealthQuestionContracts.ReportRequest("FREE_TEXT"), principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("HEALTH_QUESTION_REPORT_REASON_INVALID");
        verify(jdbc, never()).update(contains("INSERT INTO health_question_reports"), any(Object[].class));
    }

    @Test
    void reportRequiresQuestionToStillBePublished() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        User user = new User();
        user.setId(UUID.randomUUID());
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        UUID questionId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("status = 'PUBLISHED'"), eq(UUID.class), eq(questionId)))
            .thenThrow(new EmptyResultDataAccessException(1));

        HealthQuestionService service = new HealthQuestionService(jdbc, users);
        assertThatThrownBy(() -> service.report(questionId,
            new HealthQuestionContracts.ReportRequest("SPAM"), principal))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class)
            .extracting("code").isEqualTo("HEALTH_QUESTION_NOT_FOUND");
        verify(jdbc).queryForObject(contains("status = 'PUBLISHED'"), eq(UUID.class), eq(questionId));
        verify(jdbc, never()).update(contains("INSERT INTO health_question_reports"), any(Object[].class));
    }

    @Test
    void removalReportUnpublishesFaqThroughClinicalRevisionAuthority() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        when(principal.getUsername()).thenReturn("admin@example.test");
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(admin));
        when(jdbc.queryForObject(contains("r.code = 'ADMIN'"), eq(Boolean.class), eq(adminId)))
            .thenReturn(true);
        UUID questionId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        UUID faqId = UUID.randomUUID();
        when(jdbc.update(contains("UPDATE health_question_reports"), any(Object[].class))).thenReturn(1);
        doReturn(List.of(faqId)).when(jdbc).query(
            contains("SELECT id FROM faqs"), any(org.springframework.jdbc.core.RowMapper.class), eq(questionId));
        var report = new HealthQuestionContracts.ReportSummary(
            reportId, questionId, "SAFETY_CONCERN", "RESOLVED", OffsetDateTime.now(),
            OffsetDateTime.now(), "REMOVED");
        when(jdbc.queryForObject(contains("FROM health_question_reports"),
            any(org.springframework.jdbc.core.RowMapper.class), eq(reportId), eq(questionId)))
            .thenReturn(report);
        Faq faq = new Faq();
        faq.setId(faqId);
        faq.setQuestion("Q");
        faq.setAnswer("A");
        faq.setActive(true);
        faq.setPublishedAt(OffsetDateTime.now());
        FaqRepository faqs = mock(FaqRepository.class);
        when(faqs.findById(faqId)).thenReturn(Optional.of(faq));
        when(faqs.saveAndFlush(faq)).thenReturn(faq);
        AiClinicalContentRevisionService revisions = mock(AiClinicalContentRevisionService.class);
        HealthQuestionService service = new HealthQuestionService(jdbc, users, faqs, revisions);

        service.decideReport(questionId, reportId,
            new HealthQuestionContracts.ReportDecisionRequest("RESOLVED", "REMOVED"), principal);

        assertThat(faq.isActive()).isFalse();
        assertThat(faq.getPublishedAt()).isNull();
        verify(revisions).recordFaq(faq, principal);
    }

    @Test
    void closeModerationTargetsPostModerationStatesInsteadOfPendingQueue() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        when(principal.getUsername()).thenReturn("admin@example.test");
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(admin));
        when(jdbc.queryForObject(contains("r.code = 'ADMIN'"), eq(Boolean.class), eq(adminId)))
            .thenReturn(true);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        HealthQuestionService service = new HealthQuestionService(jdbc, users);
        UUID questionId = UUID.randomUUID();

        // The admin queue offers "close" on answered/published questions; the
        // update used to match only PENDING_MODERATION rows and 404'd on all of them.
        service.moderate(questionId,
            new HealthQuestionContracts.ModerationRequest("CLOSE", "SAFETY_REVIEW"), principal);

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        var args = org.mockito.ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(sql.capture(), args.capture());
        assertThat(sql.getValue())
            .contains("status IN ('AWAITING_DOCTOR', 'ANSWER_SUBMITTED', 'PUBLISHED')")
            .doesNotContain("status = 'PENDING_MODERATION'");
        assertThat(args.getValue()).containsExactly("CLOSED", adminId, "SAFETY_REVIEW", questionId);
    }

    @Test
    void approveModerationStillRequiresPendingModerationState() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        when(principal.getUsername()).thenReturn("admin@example.test");
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(admin));
        when(jdbc.queryForObject(contains("r.code = 'ADMIN'"), eq(Boolean.class), eq(adminId)))
            .thenReturn(true);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        HealthQuestionService service = new HealthQuestionService(jdbc, users);

        service.moderate(UUID.randomUUID(),
            new HealthQuestionContracts.ModerationRequest("APPROVE", null), principal);

        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture(), any(Object[].class));
        assertThat(sql.getValue()).contains("status IN ('PENDING_MODERATION')");
    }

    @Test
    void closeModerationStillReportsNotFoundWhenNoRowMatches() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        when(principal.getUsername()).thenReturn("admin@example.test");
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(admin));
        when(jdbc.queryForObject(contains("r.code = 'ADMIN'"), eq(Boolean.class), eq(adminId)))
            .thenReturn(true);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);
        HealthQuestionService service = new HealthQuestionService(jdbc, users);

        assertThatThrownBy(() -> service.moderate(UUID.randomUUID(),
            new HealthQuestionContracts.ModerationRequest("CLOSE", "OTHER"), principal))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class)
            .extracting("code").isEqualTo("HEALTH_QUESTION_NOT_FOUND");
    }

    @Test
    void duplicateReportReusesExistingRowThroughTheResultSetMapper() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID reporterId = UUID.randomUUID();
        User reporter = new User();
        reporter.setId(reporterId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(reporter));
        UUID questionId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("status = 'PUBLISHED'"), eq(UUID.class), eq(questionId)))
            .thenReturn(questionId);
        // The PostgreSQL JDBC driver hands queryForMap a java.sql.Timestamp for
        // timestamptz columns, so the legacy map-cast path blew up with a
        // ClassCastException on every duplicate report. The dedup read must go
        // through the row mapper instead.
        java.util.Map<String, Object> legacyRow = new java.util.HashMap<>();
        legacyRow.put("id", UUID.randomUUID());
        legacyRow.put("question_id", questionId);
        legacyRow.put("reason_code", "SPAM");
        legacyRow.put("status", "OPEN");
        legacyRow.put("created_at", java.sql.Timestamp.from(java.time.Instant.parse("2026-09-23T16:35:15Z")));
        legacyRow.put("handled_at", null);
        legacyRow.put("resolution_code", null);
        when(jdbc.queryForMap(anyString(), eq(questionId), eq(reporterId), eq("SPAM"))).thenReturn(legacyRow);
        HealthQuestionContracts.ReportSummary existing = new HealthQuestionContracts.ReportSummary(
            (UUID) legacyRow.get("id"), questionId, "SPAM", "OPEN",
            OffsetDateTime.parse("2026-09-23T16:35:15Z"), null, null);
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class),
            eq(questionId), eq(reporterId), eq("SPAM"))).thenReturn(List.of(existing));
        HealthQuestionService service = new HealthQuestionService(jdbc, users);

        var out = service.report(questionId,
            new HealthQuestionContracts.ReportRequest("SPAM"), principal);

        assertThat(out).isSameAs(existing);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
}
