package com.healthcare.ai;

import com.healthcare.ai.service.AiCatalogIndexService;
import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
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
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

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
        assertThat(payload.getValue().get("metadata"))
            .isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> metadata = (Map<String, String>) payload.getValue().get("metadata");
        assertThat(metadata)
            .containsEntry("slug", "than-kinh")
            .containsKey("_sync_revision");
        assertThat(processed).isEqualTo(1);
    }

    @Test
    void mirrorsActiveBranchOperationalContextForHospitalSupport() {
        AiService aiService = mock(AiService.class);
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);

        Branch branch = new Branch();
        branch.setId(UUID.randomUUID());
        branch.setName("Cơ sở Trung tâm");
        branch.setSlug("co-so-trung-tam");
        branch.setAddress("1 Đường Sức Khỏe");
        branch.setPhone("028 1234 5678");
        branch.setWorkingHours("07:00-17:00");
        when(branches.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(branch)));
        when(specialties.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        int processed = new AiCatalogIndexService(
            aiService, branches, specialties, doctors, services, packages, articles, faqs, null)
            .synchronizeCatalogNow();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(aiService).indexDocument(payload.capture());
        assertThat(payload.getValue())
            .containsEntry("source_type", "branch")
            .containsEntry("source_id", branch.getId().toString())
            .containsEntry("active", true)
            .containsEntry("published", true);
        assertThat(payload.getValue().get("content").toString())
            .contains("Cơ sở Trung tâm", "1 Đường Sức Khỏe", "028 1234 5678");
        assertThat(payload.getValue().get("metadata"))
            .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
            .containsEntry("slug", "co-so-trung-tam")
            .containsEntry("projection_kind", "OPERATIONAL");
        assertThat(processed).isEqualTo(1);
    }

    @Test
    void sendsInactiveBranchAsOperationalTombstonePayloadWithFullSupportContext() {
        AiService aiService = mock(AiService.class);
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        Branch branch = new Branch();
        branch.setId(UUID.randomUUID());
        branch.setName("Cơ sở cũ");
        branch.setSlug("co-so-cu");
        branch.setAddress("Địa chỉ cũ");
        branch.setPhone("0900 111 222");
        branch.setWorkingHours("Đã đóng cửa");
        branch.setEmergencyHotline("115");
        branch.setMapUrl("https://maps.example/old");
        branch.setAmenities(JsonNodeFactory.instance.arrayNode().add("Cấp cứu"));
        branch.setActive(false);
        when(branches.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(branch)));
        when(specialties.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        int processed = new AiCatalogIndexService(
            aiService, branches, specialties, doctors, services, packages, articles, faqs, null)
            .synchronizeCatalogNow();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(aiService).indexDocument(payload.capture());
        assertThat(payload.getValue()).containsEntry("active", false);
        assertThat(payload.getValue().get("content").toString())
            .contains("Cơ sở cũ", "Địa chỉ cũ", "0900 111 222", "Đã đóng cửa", "115", "Cấp cứu");
        assertThat(processed).isEqualTo(1);
    }

    @Test
    void tombstonesMissingBranchOnlyInOperationalProjection() {
        AiService aiService = mock(AiService.class);
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        when(branches.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(specialties.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());
        String staleId = UUID.randomUUID().toString();
        when(aiService.listIndexedDocuments()).thenReturn(List.of(Map.of(
            "source_type", "branch", "source_id", staleId,
            "metadata", Map.of("projection_kind", "OPERATIONAL"))));

        int processed = new AiCatalogIndexService(
            aiService, branches, specialties, doctors, services, packages, articles, faqs, null)
            .synchronizeCatalogNow();

        verify(aiService).removeIndexedDocument("branch", staleId, 1L, "OPERATIONAL");
        assertThat(processed).isEqualTo(1);
    }
}
