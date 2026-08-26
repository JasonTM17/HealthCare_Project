package com.healthcare.ai;

import com.healthcare.ai.service.AiClinicalProjectionIndexService;
import com.healthcare.ai.service.AiService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiClinicalProjectionIndexServiceTest {

    @Test
    void indexesOnlyDatabaseAuthorizedClinicalMetadataAndRemovesStaleClinicalProjection() {
        AiService aiService = mock(AiService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);

        UUID currentId = UUID.randomUUID();
        Map<String, Object> approved = new LinkedHashMap<>();
        approved.put("source_type", "article");
        approved.put("source_id", currentId.toString());
        approved.put("title", "Hướng dẫn đã duyệt");
        approved.put("content", "Nội dung giáo dục sức khỏe.");
        approved.put("content_revision", 4L);
        approved.put("eligibility_revision", 9L);
        approved.put("content_hash", "a".repeat(64));
        approved.put("approval_round", 2L);
        approved.put("approval_expires_at", "2027-01-01T00:00:00Z");
        when(jdbc.queryForList(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(List.of(approved));

        UUID staleId = UUID.randomUUID();
        when(aiService.listIndexedDocuments()).thenReturn(List.of(Map.of(
            "source_type", "faq",
            "source_id", staleId.toString(),
            "projection_kind", "CLINICAL",
            "content_revision", 3L,
            "eligibility_revision", 3L
        )));
        when(jdbc.queryForObject(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(Long.class),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        )).thenReturn(4L);

        AiClinicalProjectionIndexService service = new AiClinicalProjectionIndexService(aiService, jdbc);
        assertThat(service.synchronizeClinicalNow()).isEqualTo(2);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(aiService).indexDocument(payload.capture());
        assertThat(payload.getValue())
            .containsEntry("source_type", "article")
            .containsEntry("source_id", currentId.toString())
            .containsEntry("active", true)
            .containsEntry("published", true);
        assertThat(payload.getValue().get("metadata")).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> metadata = (Map<String, String>) payload.getValue().get("metadata");
        assertThat(metadata)
            .containsEntry("projection_kind", "CLINICAL")
            .containsEntry("content_revision", "4")
            .containsEntry("eligibility_revision", "9")
            .containsEntry("approval_state", "APPROVED")
            .containsEntry("approval_id", "2")
            .containsEntry("content_hash", "a".repeat(64));
        verify(aiService).removeIndexedDocument("faq", staleId.toString(), 4L, "CLINICAL");
    }

    @Test
    void failsClosedWhenStaleClinicalSourceHasNoDatabaseReviewHead() {
        AiService aiService = mock(AiService.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        UUID staleId = UUID.randomUUID();
        when(jdbc.queryForList(org.mockito.ArgumentMatchers.anyString())).thenReturn(List.of());
        when(aiService.listIndexedDocuments()).thenReturn(List.of(Map.of(
            "source_type", "article",
            "source_id", staleId.toString(),
            "projection_kind", "CLINICAL",
            "content_revision", 3L,
            "eligibility_revision", 3L
        )));
        when(jdbc.queryForObject(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq(Long.class),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        )).thenReturn(null);

        AiClinicalProjectionIndexService service = new AiClinicalProjectionIndexService(aiService, jdbc);

        assertThatThrownBy(service::synchronizeClinicalNow)
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("clinical review head revision is unavailable");
    }
}
