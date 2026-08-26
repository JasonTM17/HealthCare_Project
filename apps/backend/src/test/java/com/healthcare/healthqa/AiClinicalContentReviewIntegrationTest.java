package com.healthcare.healthqa;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.service.AiClinicalContentRevisionService;
import com.healthcare.ai.service.AiClinicalOutboxService;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.sync.outbox.SyncAppendDecision;
import com.healthcare.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiClinicalContentReviewIntegrationTest {

    @Test
    void outboxFailureRollsBackAnswerApprovalAndQuestionPublication() {
        var fixture = HealthQuestionDecisionTestSupport.fixture(false);
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            throw new IllegalStateException("synthetic clinical outbox failure");
        }).when(fixture.revisions()).recordFaqFromDoctorReview(any(), eq(fixture.reviewerId()));

        assertThatThrownBy(fixture::approve)
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("synthetic clinical outbox failure");

        verify(fixture.faqs()).saveAndFlush(any());
        verify(fixture.revisions()).recordFaqFromDoctorReview(any(), eq(fixture.reviewerId()));
        assertThat(fixture.questionStatus()).isEqualTo("ANSWER_SUBMITTED");
        assertThat(fixture.answerStatus()).isEqualTo("SUBMITTED");
        assertThat(fixture.answerReviewer()).isNull();
    }

    @Test
    void doctorMaterializationWritesDraftRevisionEventAndMetadataOnlyOutbox() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        EntityManager entityManager = mock(EntityManager.class);
        AiClinicalOutboxService outbox = mock(AiClinicalOutboxService.class);
        UUID faqId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        String hash = "b".repeat(64);
        String snapshot = "{\"active\":false,\"answer\":\"A\",\"id\":\"" + faqId
            + "\",\"question\":\"Q\"}";
        when(jdbc.queryForObject(contains("FROM faqs"), eq(String.class), any(Object[].class)))
            .thenReturn(snapshot);
        when(jdbc.queryForList(contains("FROM ai_content_review_heads"), any(Object[].class)))
            .thenReturn(List.of());
        when(jdbc.queryForObject(contains("SELECT encode(digest"), eq(String.class), any(Object[].class)))
            .thenReturn(hash);
        when(jdbc.execute(any(ConnectionCallback.class))).thenReturn(null);
        when(outbox.append("FAQ", faqId, 1L, 1L, hash, "UPSERT"))
            .thenReturn(SyncAppendDecision.ACCEPTED);

        Faq faq = new Faq();
        faq.setId(faqId);
        faq.setQuestion("Q");
        faq.setAnswer("A");
        faq.setActive(false);
        var service = new AiClinicalContentRevisionService(
            jdbc, new ObjectMapper(), mock(UserRepository.class), entityManager, outbox);

        service.recordFaqFromDoctorReview(faq, doctorId);

        verify(entityManager).flush();
        verify(outbox).append("FAQ", faqId, 1L, 1L, hash, "UPSERT");
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc, times(3)).update(sql.capture(), args.capture());
        assertThat(sql.getAllValues()).anySatisfy(value -> assertThat(value)
            .contains("INSERT INTO ai_content_revisions"));
        assertThat(sql.getAllValues()).anySatisfy(value -> assertThat(value)
            .contains("INSERT INTO ai_content_review_heads")
            .contains("'DRAFT'"));
        int eventIndex = java.util.stream.IntStream.range(0, sql.getAllValues().size())
            .filter(index -> sql.getAllValues().get(index).contains("INSERT INTO ai_content_review_events"))
            .findFirst().orElseThrow();
        assertThat(args.getAllValues().get(eventIndex)[8]).isEqualTo(doctorId);
        assertThat(args.getAllValues().get(eventIndex)[9]).isEqualTo("DOCTOR");
        assertThat(args.getAllValues().get(eventIndex)[7]).isEqualTo("EDITED");
    }
}
