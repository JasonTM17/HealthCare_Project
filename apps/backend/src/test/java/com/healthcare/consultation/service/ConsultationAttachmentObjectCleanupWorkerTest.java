package com.healthcare.consultation.service;

import com.healthcare.storage.service.ConsultationAttachmentStorage;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ConsultationAttachmentObjectCleanupWorkerTest {

    @Test
    void claimQuerySaturatesAttemptsAndDoesNotOverflowDatabaseConstraint() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        String[] sql = new String[1];
        doAnswer(invocation -> {
            sql[0] = invocation.getArgument(0, String.class);
            return List.of();
        }).when(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));

        ConsultationAttachmentObjectCleanupWorker worker = new ConsultationAttachmentObjectCleanupWorker(
            jdbc, storage, transactions, true, 120);

        assertThat(worker.claimOne(new SimpleTransactionStatus())).isNull();
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
        assertThat(sql[0])
            .contains("attempts < ?", "attempts = q.attempts + 1")
            .doesNotContain("attempts <= ?");
    }

    @Test
    void expiredLeaseAtAttemptCeilingIsTerminalizedBeforeReclaim() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        String[] updateSql = new String[1];
        doAnswer(invocation -> {
            updateSql[0] = invocation.getArgument(0, String.class);
            return 1;
        }).when(jdbc).update(anyString(), any(Object[].class));
        doAnswer(invocation -> List.of())
            .when(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));

        ConsultationAttachmentObjectCleanupWorker worker = new ConsultationAttachmentObjectCleanupWorker(
            jdbc, storage, transactions, true, 120);

        assertThat(worker.claimOne(new SimpleTransactionStatus())).isNull();
        assertThat(updateSql[0])
            .contains("status = 'FAILED'", "attempts >= ?",
                "lease_expires_at <= CURRENT_TIMESTAMP",
                "ATTACHMENT_OBJECT_CLEANUP_LEASE_EXPIRED");
        verify(jdbc).update(anyString(), org.mockito.ArgumentMatchers.eq(20));
    }
}
