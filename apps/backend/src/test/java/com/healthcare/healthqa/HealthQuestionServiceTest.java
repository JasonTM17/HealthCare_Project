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
}
