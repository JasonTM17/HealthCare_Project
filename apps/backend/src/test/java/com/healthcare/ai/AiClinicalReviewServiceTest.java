package com.healthcare.ai;

import com.healthcare.ai.service.AiClinicalReviewService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class AiClinicalReviewServiceTest {

    @Test
    void explicitApprovalRoundMustMatchTheLockedHead() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UUID reviewerId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        User reviewer = new User();
        reviewer.setId(reviewerId);
        reviewer.setEmail("doctor@example.com");
        when(users.findByEmail("doctor@example.com")).thenReturn(java.util.Optional.of(reviewer));
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of(
            "content_revision", 2L,
            "content_hash", "a".repeat(64),
            "eligibility_revision", 3L,
            "current_approval_round", 2L,
            "eligibility_state", "SUBMITTED"
        )));

        AiClinicalReviewService service = new AiClinicalReviewService(jdbc, users);
        UserDetails principal = mock(UserDetails.class);
        when(principal.getUsername()).thenReturn("doctor@example.com");

        assertThatThrownBy(() -> service.decide(
            "ARTICLE", sourceId, 2, 1, "APPROVE", null, principal))
            .hasMessage("Review round is stale")
            .extracting(error -> ((com.healthcare.exception.BusinessException) error).getCode())
            .isEqualTo("AI_CONTENT_REVISION_STALE");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getValue()).contains("FOR UPDATE");
    }

    @Test
    void adminInventoryAppliesBoundedTypeAndStateFilters() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        Map<String, Object> page = new AiClinicalReviewService(jdbc, users)
            .adminQueuePage("ARTICLE", "DRAFT", 2, 25);

        assertThat(page).containsEntry("page", 2).containsEntry("size", 25)
            .containsEntry("hasMore", false).containsEntry("content", List.of());
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getValue()).contains("h.eligibility_state = ?")
            .contains("h.source_type = ?")
            .contains("LIMIT ? OFFSET ?");
    }

    @Test
    void adminInventoryRejectsUnknownTypeWithoutQueryingDatabase() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);

        assertThatThrownBy(() -> new AiClinicalReviewService(jdbc, users)
            .adminQueuePage("UNKNOWN", "DRAFT", 0, 20))
            .extracting(error -> ((com.healthcare.exception.BusinessException) error).getCode())
            .isEqualTo("AI_CONTENT_TYPE_INVALID");
        org.mockito.Mockito.verifyNoInteractions(jdbc);
    }

    @Test
    void revisionNormalizesJdbcJsonbAndOpaqueApprovalRound() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UUID sourceId = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), any(Object[].class)))
            .thenReturn(List.of(Map.of(
                "source_type", "ARTICLE",
                "source_id", sourceId,
                "content_revision", 2L,
                "content_hash", "b".repeat(64),
                "content_snapshot", "{\"title\":\"Hướng dẫn\"}",
                "created_by", UUID.randomUUID(),
                "created_at", "2026-08-25T10:15:30Z")))
            .thenReturn(List.of(Map.of(
                "eligibility_state", "SUBMITTED",
                "current_approval_round", 2L,
                "approval_expires_at", "2027-02-25T10:15:30Z")));

        Map<String, Object> result = new AiClinicalReviewService(jdbc, users)
            .revision("ARTICLE", sourceId, 2);

        assertThat(result.get("snapshot")).isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) result.get("snapshot")).get("title")).isEqualTo("Hướng dẫn");
        assertThat(result.get("approvalId")).isEqualTo("2");
    }
}
