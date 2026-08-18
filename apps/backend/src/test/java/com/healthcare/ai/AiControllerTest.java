package com.healthcare.ai;

import com.healthcare.ai.controller.AiController;
import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiControllerTest {

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
}
