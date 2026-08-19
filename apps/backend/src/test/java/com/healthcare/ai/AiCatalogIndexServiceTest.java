package com.healthcare.ai;

import com.healthcare.ai.service.AiCatalogIndexService;
import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiCatalogIndexServiceTest {

    @Test
    void mirrorsActiveCatalogIdentityAndContentToProtectedIngestClient() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);

        Specialty specialty = new Specialty();
        specialty.setId(UUID.randomUUID());
        specialty.setName("Thần kinh");
        specialty.setSlug("than-kinh");
        specialty.setDescription("Khám đau đầu và chóng mặt");
        specialty.setActive(true);
        when(specialties.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(specialty)));
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        int processed = new AiCatalogIndexService(aiService, specialties, doctors, services, packages, articles, faqs)
            .synchronizeCatalogNow();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(aiService).indexDocument(payload.capture());
        assertThat(payload.getValue())
            .containsEntry("source_type", "specialty")
            .containsEntry("source_id", specialty.getId().toString())
            .containsEntry("active", true)
            .containsEntry("published", true);
        assertThat(payload.getValue().get("content").toString()).contains("đau đầu");
        assertThat(payload.getValue().get("metadata")).isEqualTo(Map.of("slug", "than-kinh"));
        assertThat(processed).isEqualTo(1);
    }
}
