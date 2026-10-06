package com.healthcare.document.service;

import com.healthcare.database.IndependentClinicalTransactions;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DocumentObjectCleanupServiceTest {

    private static IndependentClinicalTransactions sideEffectsOn(JdbcTemplate jdbc) {
        IndependentClinicalTransactions sideEffects = mock(IndependentClinicalTransactions.class);
        doAnswer(invocation -> {
            invocation.getArgument(0, Consumer.class).accept(jdbc);
            return null;
        }).when(sideEffects).write(any());
        return sideEffects;
    }

    @Test
    void trackCandidateDefersCleanupAndUpsertsByObjectKey() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DocumentObjectStore objectStore = mock(DocumentObjectStore.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        String[] sql = new String[1];
        doAnswer(invocation -> {
            sql[0] = invocation.getArgument(0, String.class);
            return 1;
        }).when(jdbc).update(anyString(), any(Object[].class));
        DocumentObjectCleanupService cleanup = new DocumentObjectCleanupService(
                jdbc, objectStore, transactions, true, 120, sideEffectsOn(jdbc));

        cleanup.trackCandidate("documents/patient/document.pdf");

        verify(jdbc).update(anyString(), org.mockito.ArgumentMatchers.eq("documents/patient/document.pdf"),
                org.mockito.ArgumentMatchers.eq(DocumentObjectCleanupService.INITIAL_GRACE_SECONDS),
                org.mockito.ArgumentMatchers.eq(DocumentObjectCleanupService.INITIAL_GRACE_SECONDS));
        assertThat(sql[0])
                .contains("patient_document_object_cleanup", "ON CONFLICT (object_key) DO UPDATE")
                .contains("CURRENT_TIMESTAMP + (? * INTERVAL '1 second')");
    }

    @Test
    void claimQueryNeverDeletesObjectsStillReferencedByPatientDocuments() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DocumentObjectStore objectStore = mock(DocumentObjectStore.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        String[] querySql = new String[1];
        doAnswer(invocation -> {
            querySql[0] = invocation.getArgument(0, String.class);
            return List.of();
        }).when(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
        DocumentObjectCleanupService cleanup = new DocumentObjectCleanupService(
                jdbc, objectStore, transactions, true, 120, sideEffectsOn(jdbc));

        assertThat(cleanup.claimOne(new SimpleTransactionStatus())).isNull();

        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
        assertThat(querySql[0])
                .contains("NOT EXISTS", "FROM patient_documents d", "d.object_key = q.object_key")
                .contains("FOR UPDATE SKIP LOCKED")
                .contains("attempts < ?")
                .doesNotContain("attempts <= ?");
    }

    @Test
    void keyReferencedAfterClaimIsNeverDeletedAndResolvesMarker() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DocumentObjectStore objectStore = mock(DocumentObjectStore.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        org.mockito.Mockito.when(transactions.getTransaction(any()))
                .thenReturn(new SimpleTransactionStatus());
        // objectStore must be "configured" for the worker to run
        org.mockito.Mockito.when(objectStore.isConfigured()).thenReturn(true);
        DocumentObjectCleanupService.CleanupClaim claim = new DocumentObjectCleanupService.CleanupClaim(
                java.util.UUID.randomUUID(), "documents/patient/x.pdf",
                java.util.UUID.randomUUID(), java.time.OffsetDateTime.now().plusSeconds(60));
        org.mockito.Mockito.when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of(claim));
        // A patient_documents row committed between claim and delete: the
        // pre-delete re-check must see it and skip the object removal.
        org.mockito.Mockito.when(jdbc.queryForObject(anyString(),
                        org.mockito.ArgumentMatchers.eq(Boolean.class), any(Object.class)))
                .thenReturn(true);
        DocumentObjectCleanupService cleanup = new DocumentObjectCleanupService(
                jdbc, objectStore, transactions, true, 120, sideEffectsOn(jdbc));

        cleanup.cleanupOne();

        org.mockito.Mockito.verify(objectStore, org.mockito.Mockito.never()).delete(anyString());
        org.mockito.Mockito.verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains("status = 'DONE'"),
                org.mockito.ArgumentMatchers.eq(claim.id()),
                org.mockito.ArgumentMatchers.eq(claim.leaseToken()));
    }

    @Test
    void expiredLeaseAtAttemptCeilingIsTerminalizedBeforeReclaim() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        DocumentObjectStore objectStore = mock(DocumentObjectStore.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        String[] updateSql = new String[1];
        doAnswer(invocation -> {
            updateSql[0] = invocation.getArgument(0, String.class);
            return 1;
        }).when(jdbc).update(anyString(), any(Object[].class));
        doAnswer(invocation -> List.of())
                .when(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
        DocumentObjectCleanupService cleanup = new DocumentObjectCleanupService(
                jdbc, objectStore, transactions, true, 120, sideEffectsOn(jdbc));

        assertThat(cleanup.claimOne(new SimpleTransactionStatus())).isNull();

        assertThat(updateSql[0])
                .contains("status = 'FAILED'", "attempts >= ?",
                        "lease_expires_at <= CURRENT_TIMESTAMP",
                        "DOCUMENT_OBJECT_CLEANUP_LEASE_EXPIRED");
        verify(jdbc).update(anyString(), org.mockito.ArgumentMatchers.eq(DocumentObjectCleanupService.MAX_ATTEMPTS));
    }
}
