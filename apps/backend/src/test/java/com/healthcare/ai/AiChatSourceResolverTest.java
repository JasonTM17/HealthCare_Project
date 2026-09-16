package com.healthcare.ai;

import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

/** Focused allowlist/CTA regression coverage for the Spring source authority. */
class AiChatSourceResolverTest {

    @Test
    void catalogOverviewUsesOnlyActiveSpringRowsAndBuildsCurrentCitations() {
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        UUID specialtyId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();

        com.healthcare.hospital.entity.Specialty specialty =
            new com.healthcare.hospital.entity.Specialty();
        specialty.setId(specialtyId);
        specialty.setName("Tim mạch");
        specialty.setSlug("tim-mach");

        Branch branch = new Branch();
        branch.setId(branchId);
        branch.setName("Cơ sở 1");
        branch.setSlug("co-so-1");
        branch.setAddress("Quận 3");
        branch.setActive(true);

        when(specialties.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(specialty), org.springframework.data.domain.PageRequest.of(0, 3), 1));
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(branch), org.springframework.data.domain.PageRequest.of(0, 3), 1));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            specialties,
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        AiChatSourceResolver.CatalogOverview overview = resolver.catalogOverview();

        assertThat(overview.specialtyCount()).isEqualTo(1);
        assertThat(overview.branchCount()).isEqualTo(1);
        assertThat(overview.summary())
            .contains("1 chuyên khoa")
            .contains("1 cơ sở đang hoạt động")
            .contains("Tim mạch")
            .contains("Cơ sở 1");
        assertThat(resolver.citations(overview.sources()))
            .extracting(citation -> citation.get("projection_kind"))
            .containsOnly("OPERATIONAL");
    }

    @Test
    void branchDetailsRequireAUniqueNumberAndLocalityAndPreserveMissingHours() {
        BranchRepository branches = mock(BranchRepository.class);
        Branch branchDistrict3 = new Branch();
        branchDistrict3.setId(UUID.randomUUID());
        branchDistrict3.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 2");
        branchDistrict3.setSlug("co-so-2-quan-3");
        branchDistrict3.setAddress("2 Đường số 3, Quận 3, TP. Hồ Chí Minh");
        branchDistrict3.setWorkingHours("06:30–20:00, tất cả các ngày");
        branchDistrict3.setActive(true);

        Branch branchDistrict7 = new Branch();
        branchDistrict7.setId(UUID.randomUUID());
        branchDistrict7.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 7");
        branchDistrict7.setSlug("co-so-2-quan-7");
        branchDistrict7.setAddress("105 Nguyễn Văn Linh, Phú Mỹ Hưng, Quận 7, TP. Hồ Chí Minh");
        branchDistrict7.setActive(true);

        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(branchDistrict3, branchDistrict7), org.springframework.data.domain.PageRequest.of(0, 100), 2));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        assertThat(resolver.branchDetails("Cơ sở số 2 làm việc đến mấy giờ?"))
            .hasSize(2);
        assertThat(resolver.branchDetails("Cơ sở số 2 ở Quận 7 làm việc đến mấy giờ?"))
            .singleElement()
            .satisfies(value -> assertThat(value.source().title())
                .isEqualTo("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 7"))
            .satisfies(value -> assertThat(value.workingHours()).isNull());
        assertThat(resolver.branchDetails("Cơ sở số 2 ở Quận 3 làm việc đến mấy giờ?"))
            .singleElement()
            .satisfies(value -> assertThat(value.source().title())
                .isEqualTo("Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3"))
            .satisfies(value -> assertThat(value.workingHours())
                .isEqualTo("06:30–20:00, tất cả các ngày"));

        assertThat(resolver.branchDetails("Chi nhánh thứ 2 ở TP. Hồ Chí Minh làm việc đến mấy giờ?"))
            .hasSize(2);
    }

    @Test
    void hospitalSupportRehydratesBranchIdentityAndBookingCta() {
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches, specialties, doctors, services, packages, articles, faqs, jdbc);

        UUID id = UUID.randomUUID();
        Branch branch = new Branch();
        branch.setId(id);
        branch.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 2");
        branch.setSlug("co-so-quan-1");
        branch.setAddress("2 Đường số 3, Quận 3, TP. Hồ Chí Minh");
        branch.setActive(true);
        when(branches.findByIdAndActiveTrue(id)).thenReturn(Optional.of(branch));

        List<AiChatSourceResolver.ResolvedSource> sources = resolver.authorize(
            ChatMode.HOSPITAL_SUPPORT,
            List.of(Map.of("source_type", "branch", "source_id", id.toString(), "title", "AI title")));

        assertThat(sources).hasSize(1);
        assertThat(sources.get(0).title())
            .isEqualTo("Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3");
        assertThat(resolver.citations(sources).get(0))
            .containsEntry("projection_kind", "OPERATIONAL")
            .containsEntry("source_type", "branch")
            .doesNotContainKey("content_hash");
        assertThat(resolver.actions(sources)).containsExactly(
            Map.of("kind", "VIEW_SOURCE", "label", "Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3", "href", "/branches/co-so-quan-1"),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", "/dat-lich?branchId=" + id));
    }

    @Test
    void branchIsNotAClinicalSourceAndCannotBypassModePolicy() {
        BranchRepository branches = mock(BranchRepository.class);
        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        UUID id = UUID.randomUUID();
        assertThat(resolver.authorize(
            ChatMode.HEALTH_EDUCATION,
            List.of(Map.of("source_type", "branch", "source_id", id.toString())))).isEmpty();
        verify(branches, never()).findByIdAndActiveTrue(id);
    }

    @Test
    void hospitalSupportDoctorIdentityIncludesAssignedBranchForDisambiguation() {
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        UUID id = UUID.randomUUID();

        Doctor doctor = new Doctor();
        doctor.setId(id);
        doctor.setFullName("Bác sĩ mẫu 3 - Nội tổng hợp");
        doctor.setSlug("bac-si-mau-3-noi-tong-hop");
        doctor.setActive(true);
        Branch branch = new Branch();
        branch.setName("Phòng khám ngoại trú HealthCare — Thủ Đức");
        branch.setActive(true);
        DoctorBranch assignment = new DoctorBranch();
        assignment.setDoctor(doctor);
        assignment.setBranch(branch);
        when(doctors.findById(id)).thenReturn(Optional.of(doctor));
        when(doctorBranches.findByDoctorId(id)).thenReturn(List.of(assignment));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches, specialties, doctors, doctorBranches,
            mock(com.healthcare.hospital.repository.ServiceRepository.class),
            mock(PackageRepository.class), mock(ArticleRepository.class),
            mock(FaqRepository.class), mock(JdbcTemplate.class));

        List<AiChatSourceResolver.ResolvedSource> sources = resolver.authorize(
            ChatMode.HOSPITAL_SUPPORT,
            List.of(Map.of("source_type", "doctor", "source_id", id.toString())));

        assertThat(sources).extracting(AiChatSourceResolver.ResolvedSource::title)
            .containsExactly("Bác sĩ mẫu 3 - Nội tổng hợp — Phòng khám ngoại trú HealthCare — Thủ Đức");
    }
}
