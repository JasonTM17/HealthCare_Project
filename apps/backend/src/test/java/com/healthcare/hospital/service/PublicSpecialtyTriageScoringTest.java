package com.healthcare.hospital.service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Regression tests for guest triage scoring (CNPM bug 1: the frontend only
 * shows the booking CTA when {@code specialty_resolution == RESOLVED}, and
 * the resolver used to dead-end in UNRESOLVED or suggest the wrong
 * specialty). Runs without Spring or a database: {@code bestMatch} and
 * {@code score} only need in-memory {@link Specialty} rows.
 */
class PublicSpecialtyTriageScoringTest {

    private final SpecialtyRepository repository = mock(SpecialtyRepository.class);
    private final PublicSpecialtyTriageService service =
        new PublicSpecialtyTriageService(repository, true);

    private Specialty specialty(String name, String slug, String... symptoms) {
        Specialty specialty = new Specialty();
        // triage() stringifies the id for the citation payload, so in-memory
        // rows need a stable identifier even without a persistence context.
        specialty.setId(java.util.UUID.nameUUIDFromBytes(slug.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        specialty.setName(name);
        specialty.setSlug(slug);
        specialty.setActive(true);
        if (symptoms.length > 0) {
            var array = JsonNodeFactory.instance.arrayNode();
            for (String symptom : symptoms) {
                array.add(symptom);
            }
            specialty.setCommonSymptoms(array);
        }
        return specialty;
    }

    @Test
    void sharedSymptomAcrossSpecialtiesStillResolves() {
        // Three catalog specialties carry the exact needle "Mệt mỏi kéo dài"
        // (Nội tổng hợp in V95; every large-data seed row adds it too). Equal
        // scores used to return null -> UNRESOLVED -> no booking CTA.
        Specialty noi = specialty("Nội tổng hợp", "noi-tong-hop",
            "Mệt mỏi kéo dài", "Chỉ số đường huyết bất thường");
        Specialty huyet = specialty("Huyết học", "huyet-hoc",
            "Mệt mỏi kéo dài", "Thiếu máu da xanh xao");
        Specialty dinh = specialty("Dinh dưỡng", "dinh-duong",
            "Mệt mỏi kéo dài", "Sụt cân không rõ nguyên nhân");
        when(repository.findByActiveTrue()).thenReturn(List.of(noi, huyet, dinh));

        Map<String, Object> body = service.triage("mệt mỏi kéo dài");

        assertThat(body.get("specialty_resolution")).isEqualTo("RESOLVED");
        assertThat((String) body.get("recommended_specialty"))
            .isIn("Nội tổng hợp", "Huyết học", "Dinh dưỡng");
    }

    @Test
    void headacheWithInsomniaDoesNotSuggestEyeSpecialty() {
        // "mất ngủ" folds to "mat ngu", which contains the same "mat" word as
        // the "Mắt" name/slug; contains() scoring triple-counted it into 10
        // points and the eye specialty outranked neurology's real 4-point
        // symptom phrase "đau đầu kéo dài".
        Specialty thanKinh = specialty("Thần kinh", "than-kinh",
            "Đau đầu kéo dài", "Chóng mặt");
        Specialty mat = specialty("Mắt", "mat");
        Specialty rangHamMat = specialty("Răng hàm mặt", "rang-ham-mat");
        when(repository.findByActiveTrue())
            .thenReturn(List.of(thanKinh, mat, rangHamMat));

        Map<String, Object> body = service.triage("Tôi bị đau đầu kéo dài và mất ngủ");

        assertThat(body.get("specialty_resolution")).isEqualTo("RESOLVED");
        assertThat(body.get("recommended_specialty")).isEqualTo("Thần kinh");
    }

    @Test
    void realSymptomPhraseStillOutranksSharedSymptom() {
        // A specialty with its own (unshared) symptom evidence must beat the
        // deterministic tie-break: Nội tổng hợp matches "mệt mỏi kéo dài"
        // plus its unique blood-sugar needle, so it wins over the two
        // shared-only specialties even though all three start at +4.
        Specialty noi = specialty("Nội tổng hợp", "noi-tong-hop",
            "Mệt mỏi kéo dài", "Chỉ số đường huyết bất thường");
        Specialty huyet = specialty("Huyết học", "huyet-hoc",
            "Mệt mỏi kéo dài", "Thiếu máu da xanh xao");
        Specialty dinh = specialty("Dinh dưỡng", "dinh-duong",
            "Mệt mỏi kéo dài", "Sụt cân không rõ nguyên nhân");
        when(repository.findByActiveTrue()).thenReturn(List.of(dinh, huyet, noi));

        Map<String, Object> body =
            service.triage("mệt mỏi kéo dài kèm chỉ số đường huyết bất thường");

        assertThat(body.get("specialty_resolution")).isEqualTo("RESOLVED");
        assertThat(body.get("recommended_specialty")).isEqualTo("Nội tổng hợp");
    }

    @Test
    void dizzinessPhraseDoesNotSuggestEyeSpecialty() {
        // "chóng mặt" also folds a "mat" word into the haystack; neurology's
        // symptom evidence must keep outranking the eye specialty.
        Specialty thanKinh = specialty("Thần kinh", "than-kinh",
            "Đau đầu kéo dài", "Chóng mặt");
        Specialty mat = specialty("Mắt", "mat");
        when(repository.findByActiveTrue()).thenReturn(List.of(mat, thanKinh));

        Map<String, Object> body = service.triage("Tôi hay bị chóng mặt");

        assertThat(body.get("specialty_resolution")).isEqualTo("RESOLVED");
        assertThat(body.get("recommended_specialty")).isEqualTo("Thần kinh");
    }
}
