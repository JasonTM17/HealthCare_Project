package com.healthcare.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Production evidence (2026-10-01): a single FAQ rejected by the AI service
 * egress gate aborted the whole 60s reconciliation pass, so none of the
 * remaining eligible sources were ever pushed and the tombstone sweep never
 * ran. These tests pin the per-document fault isolation.
 */
class AiClinicalProjectionIndexServiceTest {

    private static Map<String, Object> approvedRow(String sourceId) {
        Map<String, Object> row = new HashMap<>();
        row.put("source_type", "faq");
        row.put("source_id", sourceId);
        row.put("title", "Approved FAQ");
        row.put("content", "Approved public content");
        row.put("content_revision", 1L);
        row.put("eligibility_revision", 1L);
        row.put("approval_round", 1L);
        row.put("content_hash", "a".repeat(64));
        row.put("approval_expires_at", "2027-03-18 18:47:04+00");
        return row;
    }

    @Test
    void oneRejectedPushDoesNotStarveTheRestOfTheSnapshot() {
        AiService aiService = mock(AiService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        when(jdbc.queryForList(anyString()))
            .thenReturn(List.of(approvedRow("id-a"), approvedRow("id-b")));
        when(aiService.listIndexedDocuments()).thenReturn(List.of());
        doThrow(new RuntimeException("Input rejected by safety policy"))
            .doReturn(Map.of())
            .when(aiService).indexDocument(any());

        AiClinicalProjectionIndexService service =
            new AiClinicalProjectionIndexService(aiService, jdbc);
        int processed = service.synchronizeClinicalNow();

        // The first push was rejected; the second must still be attempted,
        // and the pass must complete without throwing.
        assertThat(processed).isEqualTo(1);
        verify(aiService, times(2)).indexDocument(any());
    }

    @Test
    void aRejectedPushStillLetsTheTombstoneSweepRun() {
        AiService aiService = mock(AiService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        when(jdbc.queryForList(anyString()))
            .thenReturn(List.of(approvedRow("id-a")));
        when(aiService.listIndexedDocuments()).thenReturn(List.of());
        doThrow(new RuntimeException("Input rejected by safety policy"))
            .when(aiService).indexDocument(any());

        AiClinicalProjectionIndexService service =
            new AiClinicalProjectionIndexService(aiService, jdbc);
        int processed = service.synchronizeClinicalNow();

        assertThat(processed).isZero();
        // The sweep must be reached even when every push in the snapshot
        // failed — otherwise revoked/expired sources never tombstone.
        verify(aiService).listIndexedDocuments();
    }
}
