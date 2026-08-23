package com.healthcare.ai;

import com.healthcare.ai.controller.AiController;
import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.mockito.Mockito.verify;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiControllerTest {

    @Test
    void forwardsChatAndStripsUntrustedIdentityAndCitationUrls() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Hello",
            "recommended_specialty_id", "provider-id",
            "doctor_id", "provider-doctor",
            "service_slug", "provider-service",
            "citations", List.of(Map.of(
                "source_type", "article", "source_id", "article-1", "title", "Article",
                "url", "https://provider.example"
            ))
        ));

        Map<String, Object> body = new AiController(aiService, specialtyRepository)
            .chat(new AiController.ChatRequest("hello", List.of(new AiController.ChatTurn("user", "hi"))))
            .getBody();

        assertThat(body).containsEntry("answer", "Hello")
            .doesNotContainKey("recommended_specialty_id")
            .doesNotContainKeys("doctor_id", "service_slug")
            .containsEntry("citations", List.of(Map.of(
                "source_type", "article", "source_id", "article-1", "title", "Article")));
        verify(aiService).chat(Map.of(
            "message", "hello",
            "recent_history", List.of(new AiController.ChatTurn("user", "hi"))
        ));
    }

    @Test
    void chatTurnContentMatchesTheAiServiceBoundary() {
        var validator = Validation.buildDefaultValidatorFactory().getValidator();

        var violations = validator.validate(
            new AiController.ChatTurn("user", "a".repeat(2_001))
        );

        assertThat(violations)
            .anySatisfy(violation -> assertThat(violation.getPropertyPath().toString()).isEqualTo("content"));
    }

    @Test
    void dropsMalformedOrOversizedChatCitations() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Hello",
            "citations", List.of(
                Map.of("source_type", "faq", "source_id", "faq-1", "title", "  FAQ  "),
                Map.of("source_type", "faq", "source_id", "bad id", "title", "Bad"),
                Map.of("source_type", "faq", "source_id", "faq-2", "title", "x".repeat(301))
            )
        ));

        Map<String, Object> body = new AiController(aiService, specialtyRepository)
            .chat(new AiController.ChatRequest("hello", List.of()))
            .getBody();

        assertThat(body).containsEntry("citations", List.of(
            Map.of("source_type", "faq", "source_id", "faq-1", "title", "FAQ")
        ));
    }

    @Test
    void stripsUpstreamIdentityWhenNoActiveSpecialtyCanBeResolved() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        when(aiService.recommendSpecialty(any())).thenReturn(Map.of(
            "recommended_specialty", "A specialty that does not exist",
            "recommended_specialty_id", "30000000-0000-0000-0000-000000000001"
        ));
        when(specialtyRepository.findByActiveTrue()).thenReturn(List.of());

        Map<String, Object> body = new AiController(aiService, specialtyRepository)
            .specialtyRecommendation(new AiController.AiRequest("đau đầu"))
            .getBody();

        assertThat(body)
            .containsEntry("specialty_resolution", "UNRESOLVED")
            .doesNotContainKeys("recommended_specialty_id", "recommended_specialty_slug");
    }

    @Test
    void returnsOnlyTheActiveCatalogIdentityForAResolvedRecommendation() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        UUID id = UUID.randomUUID();
        Specialty specialty = new Specialty();
        specialty.setId(id);
        specialty.setName("Tim mạch");
        specialty.setSlug("tim-mach");
        specialty.setActive(true);
        when(aiService.recommendSpecialty(any())).thenReturn(Map.of(
            "recommended_specialty", "Tim mạch",
            "recommended_specialty_id", "00000000-0000-0000-0000-000000000001"
        ));
        when(specialtyRepository.findByActiveTrue()).thenReturn(List.of(specialty));

        Map<String, Object> body = new AiController(aiService, specialtyRepository)
            .specialtyRecommendation(new AiController.AiRequest("đau ngực"))
            .getBody();

        assertThat(body)
            .containsEntry("specialty_resolution", "RESOLVED")
            .containsEntry("recommended_specialty_id", id.toString())
            .containsEntry("recommended_specialty_slug", "tim-mach");
    }

    @Test
    void doesNotResolvePunctuationOnlyRecommendationToAnArbitrarySpecialty() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        Specialty specialty = new Specialty();
        specialty.setId(UUID.randomUUID());
        specialty.setName("Tim mạch");
        specialty.setSlug("tim-mach");
        specialty.setActive(true);
        when(aiService.recommendSpecialty(any())).thenReturn(Map.of("recommended_specialty", "!!!"));
        when(specialtyRepository.findByActiveTrue()).thenReturn(List.of(specialty));

        Map<String, Object> body = new AiController(aiService, specialtyRepository)
            .specialtyRecommendation(new AiController.AiRequest("đau ngực"))
            .getBody();

        assertThat(body)
            .containsEntry("specialty_resolution", "UNRESOLVED")
            .doesNotContainKeys("recommended_specialty_id", "recommended_specialty_slug");
    }

    @Test
    void exposesOnlyIdentityOnlyCitationsFromTheAiBoundary() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        UUID id = UUID.randomUUID();
        Specialty specialty = new Specialty();
        specialty.setId(id);
        specialty.setName("Tim mạch");
        specialty.setSlug("tim-mach");
        specialty.setActive(true);
        when(aiService.recommendSpecialty(any())).thenReturn(Map.of(
            "recommended_specialty", "Tim mạch",
            "citations", List.of(
                Map.of("source_type", "specialty", "source_id", "tim-mach", "title", "Tim mạch"),
                Map.of("source_type", "article", "source_id", "news-1", "title", "Tin sức khỏe", "url", "https://external.example"),
                Map.of("label", "provider supplied label", "url", "https://external.example"),
                "provider supplied string"
            )
        ));
        when(specialtyRepository.findByActiveTrue()).thenReturn(List.of(specialty));

        Map<String, Object> body = new AiController(aiService, specialtyRepository)
            .specialtyRecommendation(new AiController.AiRequest("đau ngực"))
            .getBody();

        assertThat(body.get("citations")).isEqualTo(List.of(
            Map.of("source_type", "specialty", "source_id", "tim-mach", "title", "Tim mạch"),
            Map.of("source_type", "article", "source_id", "news-1", "title", "Tin sức khỏe")
        ));
        assertThat(body.get("citations").toString()).doesNotContain("url", "external.example", "provider supplied");
    }
}
