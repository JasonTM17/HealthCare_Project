package com.healthcare.ai;

import com.healthcare.ai.controller.AiController;
import com.healthcare.ai.service.AiService;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiControllerTest {

    @Test
    void forwardsBoundedSearchToTheAiGateway() {
        AiService aiService = mock(AiService.class);
        when(aiService.search("đau đầu", 5)).thenReturn(Map.of("query", "đau đầu", "results", java.util.List.of()));

        Map<String, Object> body = new AiController(aiService)
            .search("đau đầu", 5)
            .getBody();

        assertThat(body).containsEntry("query", "đau đầu");
        verify(aiService).search("đau đầu", 5);
    }

    @Test
    void rejectsInvalidSearchBeforeTheAiGateway() {
        AiService aiService = mock(AiService.class);

        assertThatThrownBy(() -> new AiController(aiService).search("   ", 5))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode().value()).isEqualTo(400));
        assertThatThrownBy(() -> new AiController(aiService).search("đau đầu", 21))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode().value()).isEqualTo(400));
    }
}
