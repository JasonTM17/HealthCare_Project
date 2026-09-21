package com.healthcare.ai;

import com.healthcare.ai.service.AiCatalogIndexService;
import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
        specialty.setCommonSymptoms(JsonNodeFactory.instance.arrayNode()
            .add("Đau đầu kéo dài")
            .add("Chóng mặt"));
        specialty.setPreparationSteps(JsonNodeFactory.instance.arrayNode()
            .add("Ghi lại thời điểm và mức độ triệu chứng"));
        specialty.setCarePathway("Khai thác triệu chứng → khám chuyên khoa → theo dõi.");
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
        assertThat(payload.getValue().get("content").toString())
            .contains("đau đầu", "Triệu chứng thường gặp", "Đau đầu kéo dài",
                "Chuẩn bị", "Ghi lại thời điểm", "Lộ trình", "theo dõi");
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
    void labelsServiceProjectionSoBroadServiceQuestionsCanBeGrounded() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);

        MedicalService service = new MedicalService();
        service.setId(UUID.randomUUID());
        service.setName("Siêu âm thai 4D");
        service.setSlug("sieu-am-thai-4d");
        service.setDescription("Theo dõi hình thái thai nhi theo chỉ định.");
        when(specialties.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(service)));
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        int processed = new AiCatalogIndexService(aiService, specialties, doctors, services, packages, articles, faqs)
            .synchronizeCatalogNow();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(aiService).indexDocument(payload.capture());
        assertThat(payload.getValue())
            .containsEntry("source_type", "service")
            .containsEntry("source_id", service.getId().toString());
        assertThat(payload.getValue().get("content").toString())
            .contains("Dịch vụ: Siêu âm thai 4D", "Theo dõi hình thái");
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
        branch.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 2");
        branch.setSlug("co-so-trung-tam");
        branch.setAddress("1 Đường Sức Khỏe, Quận 3, TP. Hồ Chí Minh");
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
        assertThat(payload.getValue().get("title"))
            .isEqualTo("Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3");
        assertThat(payload.getValue().get("content").toString())
            .contains("Địa chỉ: 1 Đường Sức Khỏe", "Điện thoại: 028 1234 5678",
                "Giờ hoạt động: 07:00-17:00");
        assertThat(payload.getValue().get("metadata"))
            .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
            .containsEntry("slug", "co-so-trung-tam")
            .containsEntry("projection_kind", "OPERATIONAL")
            .containsEntry("public_operational", "true");
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
            .contains("Địa chỉ: Địa chỉ cũ", "Điện thoại: 0900 111 222",
                "Giờ hoạt động: Đã đóng cửa", "Hotline cấp cứu: 115", "Cấp cứu");
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

    @Test
    void indexesDoctorWithAssignedBranchInTitleAndContent() {
        AiService aiService = mock(AiService.class);
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);

        Doctor doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setFullName("Bác sĩ mẫu 3 - Nội tổng hợp");
        doctor.setBio("Khám nội tổng hợp và rối loạn giấc ngủ.");
        doctor.setSlug("bac-si-mau-3-noi-tong-hop-thu-duc");
        doctor.setActive(true);
        Branch branch = new Branch();
        branch.setName("Phòng khám ngoại trú HealthCare — Thủ Đức");
        branch.setActive(true);
        DoctorBranch assignment = new DoctorBranch();
        assignment.setDoctor(doctor);
        assignment.setBranch(branch);
        when(doctorBranches.findByDoctorId(doctor.getId())).thenReturn(List.of(assignment));
        when(branches.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(specialties.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(doctor)));
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        int processed = new AiCatalogIndexService(
            aiService, branches, specialties, doctors, doctorBranches, services,
            packages, articles, faqs, null).synchronizeCatalogNow();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(aiService).indexDocument(payload.capture());
        assertThat(payload.getValue().get("title"))
            .isEqualTo("Bác sĩ mẫu 3 - Nội tổng hợp — Phòng khám ngoại trú HealthCare — Thủ Đức");
        assertThat(payload.getValue().get("content").toString())
            .contains("Phòng khám ngoại trú HealthCare — Thủ Đức", "rối loạn giấc ngủ");
        assertThat(processed).isEqualTo(1);
    }

    // ---- The scheduled entry point and its kill switch -----------------------
    //
    // Everything above drives {@code synchronizeCatalogNow()} (the admin
    // on-demand path). {@code synchronizeCatalog()} is the {@code @Scheduled}
    // entry point, and it owns two promises the plain sync does not: the
    // {@code app.ai.catalog-sync-enabled} kill switch, and the fail-soft
    // contract that a transient catalog/ai-service outage defers the sync
    // instead of escaping the tick.

    /**
     * {@code catalogSyncEnabled} and {@code maxCatalogItems} are field-injected
     * with {@code @Value}, so a service built with {@code new} leaves them at
     * the Java defaults ({@code false} and {@code 0}) rather than the
     * production defaults ({@code true} and {@code 5000}). Setting both keeps
     * these tests honest about which switch they are actually flipping.
     */
    private static void applyInjectedConfiguration(
            AiCatalogIndexService service, boolean catalogSyncEnabled, int maxCatalogItems) {
        ReflectionTestUtils.setField(service, "catalogSyncEnabled", catalogSyncEnabled);
        ReflectionTestUtils.setField(service, "maxCatalogItems", maxCatalogItems);
    }

    @Test
    void killSwitchStopsTheScheduledSyncBeforeItReadsAnyCatalogSource() {
        AiService aiService = mock(AiService.class);
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        // RAG ingest stays configured: the only thing allowed to stop this tick
        // is the operator switch, never a capability probe.
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        Specialty specialty = new Specialty();
        specialty.setId(UUID.randomUUID());
        specialty.setName("Thần kinh");
        specialty.setActive(true);
        when(specialties.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(specialty)));
        when(branches.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        AiCatalogIndexService service = new AiCatalogIndexService(
            aiService, branches, specialties, doctors, services, packages, articles, faqs, null);
        applyInjectedConfiguration(service, false, 5000);

        service.synchronizeCatalog();

        // Nothing is read, indexed, reconciled, or deleted. Because the ingest
        // capability probe lives on {@code aiService}, proving that mock totally
        // untouched also proves the switch short-circuits ahead of it.
        verifyNoInteractions(aiService, branches, specialties, doctors,
            services, packages, articles, faqs);
        verify(aiService, never()).indexDocument(any());
        verify(aiService, never()).removeIndexedDocument(any(), any(), anyLong(), any());

        // Control: the same instance with the switch on does write, so the
        // suppression above cannot be a test artifact of a broken fixture.
        applyInjectedConfiguration(service, true, 5000);
        service.synchronizeCatalog();
        verify(aiService).indexDocument(any());
    }

    @Test
    void scheduledSyncStaysSilentWhenIngestIsNotConfigured() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(false);

        AiCatalogIndexService service = new AiCatalogIndexService(
            aiService, specialties, mock(DoctorRepository.class), mock(ServiceRepository.class),
            mock(PackageRepository.class), articles, faqs);
        applyInjectedConfiguration(service, true, 5000);

        service.synchronizeCatalog();

        // An unconfigured deployment is a silent skip, not a failure that would
        // make every tick log an error against a never-arriving ai-service.
        verifyNoInteractions(specialties, articles, faqs);
        verify(aiService, never()).indexDocument(any());
    }

    @Test
    void scheduledSyncDefersInsteadOfEscapingWhenACatalogSourceFails() {
        AiService aiService = mock(AiService.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        when(specialties.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(doctors.findAll(any(Pageable.class)))
            .thenThrow(new IllegalStateException("ai-service unreachable"));
        when(services.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(packages.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(articles.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(faqs.findAll(any(Pageable.class))).thenReturn(Page.empty());

        AiCatalogIndexService service = new AiCatalogIndexService(
            aiService, specialties, doctors, services, packages, articles, faqs);
        applyInjectedConfiguration(service, true, 5000);

        // The documented promise: a failed pass is logged as a deferral and the
        // next fixed-delay tick retries. An exception escaping here would
        // surface as an ERROR on every scheduler invocation.
        assertThatCode(service::synchronizeCatalog).doesNotThrowAnyException();
        // The pass aborted before reconciliation, so nothing was tombstoned.
        verify(aiService, never()).removeIndexedDocument(any(), any(),
            anyLong(), any());
    }

    @Test
    void onDemandSyncPropagatesASingleSourceFailureWithoutTombstoning() {
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
        branch.setName("Cơ sở 1");
        branch.setActive(true);
        Specialty specialty = new Specialty();
        specialty.setId(UUID.randomUUID());
        specialty.setName("Tim mạch");
        specialty.setActive(true);
        when(branches.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(branch)));
        when(specialties.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(specialty)));
        when(doctors.findAll(any(Pageable.class))).thenReturn(Page.empty());
        when(services.findAll(any(Pageable.class)))
            .thenThrow(new IllegalStateException("catalog read failed"));

        AiCatalogIndexService service = new AiCatalogIndexService(
            aiService, branches, specialties, doctors, services, packages, articles, faqs, null);
        applyInjectedConfiguration(service, true, 5000);

        // Documented promise for this entry point ("propagates failures to an
        // authorized operator"): the admin endpoint must see the failure rather
        // than a 200 with a silently partial index.
        assertThatThrownBy(service::synchronizeCatalogNow)
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("catalog read failed");

        // The partial-application shape of a failed pass is NOT specified in the
        // service contract; these assertions pin what the code actually
        // guarantees today so a refactor cannot quietly change it:
        //   1. sources visited before the failure were already pushed to the
        //      index (the writer is not transactional), and
        verify(aiService, times(2)).indexDocument(any());
        //   2. sources after the failure are never touched,
        verifyNoInteractions(packages, articles, faqs);
        //   3. and the only destructive step — stale-document reconciliation —
        //      runs last, so a failed pass can never tombstone live documents.
        verify(aiService, never()).listIndexedDocuments();
        verify(aiService, never()).removeIndexedDocument(any(), any(),
            anyLong(), any());
    }
}
