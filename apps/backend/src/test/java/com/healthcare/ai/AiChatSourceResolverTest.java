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
        assertThat(resolver.branchDetails("Cơ sở số 2 có giờ hoạt động thế nào?"))
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
        assertThat(resolver.branchDetails("Chi nhánh thứ 2 ở TP. Hồ Chí Minh có địa chỉ gì?"))
            .hasSize(2);
        assertThat(resolver.isSpecificBranchQuery("Cơ sở số 2 có giờ hoạt động thế nào?"))
            .isTrue();
        assertThat(resolver.isSpecificBranchQuery("Giờ làm việc của bệnh viện thế nào?"))
            .isFalse();
        assertThat(resolver.isSpecificBranchQuery("Bệnh viện có khám tim mạch vào chủ nhật không?"))
            .isFalse();
        assertThat(resolver.isSpecificBranchQuery("Khám tổng quát vào cuối tuần"))
            .isFalse();
        assertThat(resolver.isSpecificBranchQuery("Cơ sở Cầu Giấy có làm việc không?"))
            .isTrue();
    }

    @Test
    void branchLookupIgnoresAttributeWordsWhenNumberOrAnchorIdentifiesBranch() {
        BranchRepository branches = mock(BranchRepository.class);
        Branch branch = new Branch();
        branch.setId(UUID.randomUUID());
        branch.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 4");
        branch.setSlug("co-so-4");
        branch.setAddress("4 Đường số 5, Quận 5, TP. Hồ Chí Minh");
        branch.setPhone("028 38000004");
        branch.setActive(true);
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(branch), org.springframework.data.domain.PageRequest.of(0, 100), 1));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // Attribute/copula words ("điện thoại", "là", "ở đâu") must not be
        // required inside the branch name/address once an explicit number
        // or locality anchor already identifies the row.
        assertThat(resolver.branchDetails("Địa chỉ của Cơ sở 4 là gì?")).hasSize(1);
        assertThat(resolver.branchDetails("Số điện thoại của Cơ sở 4?"))
            .singleElement()
            .satisfies(value -> assertThat(value.phone()).isEqualTo("028 38000004"));
        assertThat(resolver.branchDetails("Cơ sở 4 có số điện thoại nào không?")).hasSize(1);
        assertThat(resolver.branchDetails("Cơ sở ở Quận 5 giờ làm việc thế nào?")).hasSize(1);
    }

    @Test
    void branchLookupDoesNotCollapseToponymQueriesIntoSingleResidualTerms() {
        BranchRepository branches = mock(BranchRepository.class);
        Branch branch = new Branch();
        branch.setId(UUID.randomUUID());
        branch.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 5");
        branch.setSlug("co-so-5");
        branch.setAddress("22 Đường Mai Chí Thọ, Thủ Đức, TP. Hồ Chí Minh");
        branch.setActive(true);
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(branch), org.springframework.data.domain.PageRequest.of(0, 100), 1));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // A toponym like "Sao Mai" or "La Khê" must not resolve to an
        // unrelated branch whose address merely contains "mai"/"khe".
        assertThat(resolver.branchDetails("Cơ sở Sao Mai ở đâu?")).isEmpty();
        assertThat(resolver.branchDetails("Cơ sở ở La Khê có không?")).isEmpty();
        // A generic question with a single residual token also defers.
        assertThat(resolver.branchDetails("Cơ sở ở đâu?")).isEmpty();
        assertThat(resolver.isSpecificBranchQuery("Cơ sở ở đâu?")).isFalse();
        // While explicit identities still resolve.
        assertThat(resolver.branchDetails("Cơ sở 5 giờ làm việc?")).hasSize(1);
        assertThat(resolver.branchDetails("Cơ sở ở Thủ Đức mấy giờ mở?")).hasSize(1);
    }

    @Test
    void multiNumberAndGenericAttributeQueriesBehaveCorrectly() {
        BranchRepository branches = mock(BranchRepository.class);
        Branch branch4 = new Branch();
        branch4.setId(UUID.randomUUID());
        branch4.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 4, Quận 5");
        branch4.setSlug("co-so-4-quan-5");
        branch4.setAddress("4 Đường số 5, Quận 5, TP. Hồ Chí Minh");
        branch4.setActive(true);
        Branch branch17 = new Branch();
        branch17.setId(UUID.randomUUID());
        branch17.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 17, Quận 12");
        branch17.setSlug("co-so-17-quan-12");
        branch17.setAddress("17 Quốc lộ 1A, Quận 12, TP. Hồ Chí Minh");
        branch17.setActive(true);
        Branch branch12 = new Branch();
        branch12.setId(UUID.randomUUID());
        branch12.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 12, Quận 1");
        branch12.setSlug("co-so-12-quan-1");
        branch12.setAddress("12 Lê Lợi, Quận 1, TP. Hồ Chí Minh");
        branch12.setActive(true);
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(branch4, branch17, branch12),
                org.springframework.data.domain.PageRequest.of(0, 100), 3));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // A question naming two different numbers is ambiguous by
        // construction — both candidates surface, never silently the first.
        assertThat(resolver.branchDetails("không phải cơ sở 4 mà cơ sở 17"))
            .extracting(value -> value.source().title())
            .containsExactlyInAnyOrder(
                "Bệnh viện Đa khoa HealthCare — Cơ sở 4, Quận 5",
                "Bệnh viện Đa khoa HealthCare — Cơ sở 17, Quận 12");
        assertThat(resolver.branchDetails("cơ sở 4 hay cơ sở 17")).hasSize(2);

        // Questions whose residual terms are only attribute words are
        // generic — they must defer, not hard-fail as a specific lookup.
        assertThat(resolver.isSpecificBranchQuery("Số điện thoại cơ sở là gì?")).isFalse();
        assertThat(resolver.isSpecificBranchQuery("cơ sở có mở chủ nhật không?")).isFalse();
        assertThat(resolver.branchDetails("Số điện thoại cơ sở là gì?")).isEmpty();

        // District anchors match on word boundaries: "quận 1" must not
        // substring-match "quận 11" / "quận 12" addresses.
        assertThat(resolver.branchDetails("cơ sở ở quận 1"))
            .extracting(value -> value.source().title())
            .containsExactly("Bệnh viện Đa khoa HealthCare — Cơ sở 12, Quận 1");

        // Multiple district anchors are disjunctive — an OR question
        // lists both districts' branches instead of failing closed.
        assertThat(resolver.branchDetails("cơ sở quận 1 hay quận 5?"))
            .extracting(value -> value.source().title())
            .containsExactlyInAnyOrder(
                "Bệnh viện Đa khoa HealthCare — Cơ sở 4, Quận 5",
                "Bệnh viện Đa khoa HealthCare — Cơ sở 12, Quận 1");

        // Amenity questions name no branch identity — they must defer,
        // not hard-fail as an "unverifiable branch".
        assertThat(resolver.isSpecificBranchQuery("Cơ sở có bãi xe không?")).isFalse();
        assertThat(resolver.isSpecificBranchQuery("cơ sở có nhà thuốc không")).isFalse();
        assertThat(resolver.branchDetails("Cơ sở có bãi xe không?")).isEmpty();
    }

    @Test
    void rewrittenCitySynonymDoesNotHijackBrandName() {
        BranchRepository branches = mock(BranchRepository.class);
        Branch saigon = new Branch();
        saigon.setId(UUID.randomUUID());
        saigon.setName("Bệnh viện Đa khoa Sài Gòn Xanh");
        saigon.setSlug("sai-gon-xanh");
        saigon.setAddress("9 Hai Bà Trưng, Quận 1, TP. Hồ Chí Minh");
        saigon.setActive(true);
        Branch other = new Branch();
        other.setId(UUID.randomUUID());
        other.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 4, Quận 5");
        other.setSlug("co-so-4-quan-5");
        other.setAddress("4 Đường số 5, Quận 5, TP. Hồ Chí Minh");
        other.setActive(true);
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(saigon, other),
                org.springframework.data.domain.PageRequest.of(0, 100), 2));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // "sài gòn" rewrites to the "ho chi minh" locality anchor; the
        // residual brand token "xanh" must still be required, otherwise
        // every HCMC branch would match the named lookup.
        assertThat(resolver.branchDetails("địa chỉ bệnh viện Sài Gòn Xanh"))
            .extracting(value -> value.source().title())
            .containsExactly("Bệnh viện Đa khoa Sài Gòn Xanh");
    }

    @Test
    void anchorBearingQuestionIsAValidReferent() {
        AiChatSourceResolver resolver = new AiChatSourceResolver(
            mock(BranchRepository.class),
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // A district-hours question is a branch question even without a
        // branch noun; a bare locality statement is not.
        assertThat(resolver.latestSpecificBranchUserTurn(List.of(
            Map.of("role", "user", "content", "Cơ sở 4 mở chủ nhật không?"),
            Map.of("role", "assistant", "content", "Cơ sở 4 mở cả tuần."),
            Map.of("role", "user", "content", "Quận 7 mở cửa mấy giờ?"))))
            .isEqualTo("Quận 7 mở cửa mấy giờ?");
        assertThat(resolver.latestSpecificBranchUserTurn(List.of(
            Map.of("role", "user", "content", "Tôi ở quận 1"))))
            .isNull();
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
    void clinicalSourceActionsUseCompactLabelsWithoutHidingTheCitationTitle() {
        AiChatSourceResolver resolver = new AiChatSourceResolver(
            mock(BranchRepository.class),
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        AiChatSourceResolver.ResolvedSource article = new AiChatSourceResolver.ResolvedSource(
            "article", UUID.randomUUID().toString(), "Hướng dẫn chăm sóc mắt", "huong-dan-cham-soc-mat",
            true, true, "CLINICAL", 1L, 1L, "hash", "approval",
            "/articles/huong-dan-cham-soc-mat", null);
        AiChatSourceResolver.ResolvedSource faq = new AiChatSourceResolver.ResolvedSource(
            "faq", UUID.randomUUID().toString(), "Cần chuẩn bị gì trước khi khám?", null,
            true, true, "CLINICAL", 1L, 1L, "hash-2", "approval-2",
            "/faq#faq-00000000-0000-0000-0000-000000000001", null);

        assertThat(resolver.actions(List.of(article, faq))).containsExactly(
            Map.of("kind", "VIEW_SOURCE", "label", "Đọc bài viết", "href", "/articles/huong-dan-cham-soc-mat"),
            Map.of("kind", "VIEW_SOURCE", "label", "Xem câu trả lời", "href", "/faq#faq-00000000-0000-0000-0000-000000000001"));
        assertThat(article.title()).isEqualTo("Hướng dẫn chăm sóc mắt");
        assertThat(faq.title()).isEqualTo("Cần chuẩn bị gì trước khi khám?");
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

    @Test
    void activeDoctorOverviewFiltersDoctorsBySpecialtyKeywordAndStaysBounded() {
        DoctorRepository doctors = mock(DoctorRepository.class);
        UUID dermatologistId = UUID.randomUUID();
        UUID cardiologistId = UUID.randomUUID();

        Doctor dermatologist = new Doctor();
        dermatologist.setId(dermatologistId);
        dermatologist.setFullName("Bác sĩ Nguyễn Văn A");
        dermatologist.setSlug("bac-si-a");
        dermatologist.setBio("Chuyên khoa Da liễu, điều trị viêm da cơ địa.");
        dermatologist.setActive(true);

        Doctor cardiologist = new Doctor();
        cardiologist.setId(cardiologistId);
        cardiologist.setFullName("Bác sĩ Trần Văn B");
        cardiologist.setSlug("bac-si-b");
        cardiologist.setBio("Chuyên khoa Tim mạch.");
        cardiologist.setActive(true);

        when(doctors.findByActiveTrue(any(Pageable.class))).thenReturn(new PageImpl<>(
            List.of(dermatologist, cardiologist),
            org.springframework.data.domain.PageRequest.of(0, 100), 2));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            mock(BranchRepository.class),
            mock(SpecialtyRepository.class),
            doctors,
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // "Bác sĩ nào giỏi về da liễu?" reduces to the keyword "da lieu";
        // only the doctor whose own catalog text mentions it is returned.
        List<AiChatSourceResolver.ResolvedSource> matched =
            resolver.activeDoctorOverview(4, "Bác sĩ nào giỏi về da liễu?");
        assertThat(matched).hasSize(1);
        assertThat(matched.get(0).type()).isEqualTo("doctor");
        assertThat(matched.get(0).id()).isEqualTo(dermatologistId.toString());
        assertThat(matched.get(0).title()).isEqualTo("Bác sĩ Nguyễn Văn A");
        assertThat(matched.get(0).viewHref()).isEqualTo("/doctors/bac-si-a");
        assertThat(matched.get(0).bookingHref()).isEqualTo("/dat-lich?doctorId=" + dermatologistId);

        // A doctor question that names no specialty stays a bounded, unfiltered list.
        assertThat(resolver.activeDoctorOverview(1, "danh sách bác sĩ")).hasSize(1);
        assertThat(resolver.activeDoctorOverview(4, "   ")).hasSize(2);
    }

    @Test
    void activeDoctorOverviewReturnsEmptyWhenTheCatalogIsUnavailable() {
        DoctorRepository doctors = mock(DoctorRepository.class);
        when(doctors.findByActiveTrue(any(Pageable.class)))
            .thenThrow(new RuntimeException("catalog temporarily unavailable"));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            mock(BranchRepository.class),
            mock(SpecialtyRepository.class),
            doctors,
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        assertThat(resolver.activeDoctorOverview(4, "da liễu")).isEmpty();
    }

    @Test
    void amenityResolutionMatchesOnlyBranchesAdvertisingTheFacility() {
        BranchRepository branches = mock(BranchRepository.class);
        Branch withParking = new Branch();
        withParking.setId(UUID.randomUUID());
        withParking.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 3");
        withParking.setSlug("co-so-2-quan-3");
        withParking.setAddress("2 Đường số 3, Quận 3");
        withParking.setActive(true);
        withParking.setAmenities(com.fasterxml.jackson.databind.node.JsonNodeFactory.instance
            .arrayNode().add("Bãi đỗ xe").add("Nhà thuốc"));
        Branch withoutParking = new Branch();
        withoutParking.setId(UUID.randomUUID());
        withoutParking.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 4, Quận 5");
        withoutParking.setSlug("co-so-4-quan-5");
        withoutParking.setAddress("4 Đường số 5, Quận 5");
        withoutParking.setActive(true);
        withoutParking.setAmenities(com.fasterxml.jackson.databind.node.JsonNodeFactory.instance
            .arrayNode().add("Khám theo hẹn").add("Wi-Fi miễn phí"));
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(withParking, withoutParking),
                org.springframework.data.domain.PageRequest.of(0, 100), 2));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        // "đậu" and "đỗ" are different spellings of the same facility —
        // both must match the catalog's "Bãi đỗ xe" label.
        AiChatSourceResolver.AmenityResolution parking =
            resolver.resolveAmenity("Bãi đậu xe ở đâu?");
        assertThat(parking).isNotNull();
        assertThat(parking.amenityType()).isEqualTo("parking");
        assertThat(parking.specific()).isFalse();
        assertThat(parking.matches())
            .extracting(value -> value.source().title())
            .containsExactly("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 3");
        assertThat(resolver.matchedAmenityLabels(parking.matches().get(0), "parking"))
            .containsExactly("Bãi đỗ xe");

        // Pharmacy wording matches the "Nhà thuốc" label on the same branch.
        AiChatSourceResolver.AmenityResolution pharmacy =
            resolver.resolveAmenity("Cơ sở có nhà thuốc không?");
        assertThat(pharmacy).isNotNull();
        assertThat(pharmacy.amenityType()).isEqualTo("pharmacy");
        assertThat(pharmacy.matches())
            .extracting(value -> value.source().title())
            .containsExactly("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 3");

        // Wi-Fi is only advertised by the second branch.
        AiChatSourceResolver.AmenityResolution wifi =
            resolver.resolveAmenity("Có wifi miễn phí không?");
        assertThat(wifi).isNotNull();
        assertThat(wifi.matches())
            .extracting(value -> value.source().title())
            .containsExactly("Bệnh viện Đa khoa HealthCare — Cơ sở 4, Quận 5");

        // An amenity no branch advertises resolves empty — the caller must
        // answer "not published" honestly instead of implying a facility.
        AiChatSourceResolver.AmenityResolution canteen =
            resolver.resolveAmenity("Bệnh viện có căn tin không?");
        assertThat(canteen).isNotNull();
        assertThat(canteen.matches()).isEmpty();

        // A question with no amenity wording never enters this lane.
        assertThat(resolver.resolveAmenity("địa chỉ cơ sở 2 là gì")).isNull();
    }

    @Test
    void amenityResolutionReturnsNullOnCatalogOutage() {
        // A repository failure must not masquerade as an empty catalog —
        // callers degrade honestly instead of asserting "no branch
        // advertises X" on no evidence at all.
        BranchRepository branches = mock(BranchRepository.class);
        when(branches.findByActiveTrue(any(Pageable.class)))
            .thenThrow(new RuntimeException("catalog down"));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        assertThat(resolver.resolveAmenity("Bãi đậu xe ở đâu?")).isNull();
    }

    @Test
    void amenityResolutionScopesAllBranchQuantifiersToGenericScan() {
        // "các/tất cả/mọi cơ sở" carries no concrete identity — an empty
        // named resolution must not fail closed but scan the catalog.
        BranchRepository branches = mock(BranchRepository.class);
        Branch withParking = new Branch();
        withParking.setId(UUID.randomUUID());
        withParking.setName("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 3");
        withParking.setSlug("co-so-2-quan-3");
        withParking.setAddress("2 Đường số 3, Quận 3");
        withParking.setActive(true);
        withParking.setAmenities(com.fasterxml.jackson.databind.node.JsonNodeFactory.instance
            .arrayNode().add("Bãi đỗ xe"));
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(withParking),
                org.springframework.data.domain.PageRequest.of(0, 100), 1));

        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        for (String question : List.of(
            "Các cơ sở có bãi đậu xe không?",
            "Tất cả cơ sở có bãi đậu xe không?",
            "Mọi chi nhánh có bãi đậu xe không?")) {
            AiChatSourceResolver.AmenityResolution resolution =
                resolver.resolveAmenity(question);
            assertThat(resolution).as(question).isNotNull();
            assertThat(resolution.specific()).as(question).isFalse();
            assertThat(resolution.matches()).as(question).hasSize(1);
        }

        // A concrete-but-missing identity still fails closed — the scope
        // escape must never rescue a named-but-unresolvable branch.
        AiChatSourceResolver.AmenityResolution named =
            resolver.resolveAmenity("Cơ sở 99 có bãi đậu xe không?");
        assertThat(named).isNotNull();
        assertThat(named.specific()).isTrue();
        assertThat(named.matches()).isEmpty();
        assertThat(named.resolved()).isEmpty();
    }

    private AiChatSourceResolver resolverWith(Branch... rows) {
        BranchRepository branches = mock(BranchRepository.class);
        when(branches.findByActiveTrue(any(Pageable.class))).thenReturn(
            new PageImpl<>(List.of(rows),
                org.springframework.data.domain.PageRequest.of(0, 100), rows.length));
        return new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));
    }

    private Branch branch(String name, String slug, String... amenities) {
        Branch branch = new Branch();
        branch.setId(UUID.randomUUID());
        branch.setName(name);
        branch.setSlug(slug);
        branch.setAddress(name);
        branch.setActive(true);
        var array = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        for (String amenity : amenities) array.add(amenity);
        branch.setAmenities(array);
        return branch;
    }

    @Test
    void amenityResolutionKeepsToponymIdentityThroughAttributeTokens() {
        // "cơ sở Sân Bay có bãi đậu xe" — amenity vocabulary ("bãi", "sân")
        // must not be required inside the branch name, and must not leave
        // residual tokens that make a real branch unresolvable.
        Branch sanBay = branch(
            "Phòng khám HealthCare Sân Bay", "san-bay", "Bãi đỗ xe", "Wi-Fi");
        AiChatSourceResolver resolver = resolverWith(sanBay);

        AiChatSourceResolver.AmenityResolution resolution =
            resolver.resolveAmenity("Cơ sở Sân Bay có bãi đậu xe không?");
        assertThat(resolution).isNotNull();
        assertThat(resolution.specific()).isTrue();
        assertThat(resolution.resolved()).hasSize(1);
        assertThat(resolution.matches()).hasSize(1);
    }

    @Test
    void amenityResolutionTreatsFacilitiesOverviewAsGenericScan() {
        // "có tiện ích gì" names no amenity type and no branch identity —
        // the generic marker must not poison the residual identity into a
        // fail-closed named lookup.
        Branch withAmenities = branch(
            "Bệnh viện HealthCare Quận 1", "quan-1", "Bãi đỗ xe", "Wi-Fi");
        Branch bare = branch("Phòng khám HealthCare Quận 7", "quan-7");
        AiChatSourceResolver resolver = resolverWith(withAmenities, bare);

        AiChatSourceResolver.AmenityResolution resolution =
            resolver.resolveAmenity("Cơ sở có tiện ích gì?");
        assertThat(resolution).isNotNull();
        assertThat(resolution.amenityType()).isEqualTo("generic");
        assertThat(resolution.specific()).isFalse();
        assertThat(resolution.matches()).hasSize(1);
    }

    @Test
    void amenityTypeDoesNotConfuseDeicticChoDoWithParking() {
        // "chỗ đó" (that place) is not a parking phrase — an explicit
        // amenity word later in the question must win, not the first
        // group hit on a deictic "chỗ đó".
        assertThat(resolverWith().amenityType("Cơ sở 2 chỗ đó có wifi không?"))
            .isEqualTo("wifi");
        assertThat(resolverWith().amenityType("chỗ đậu xe ở đâu"))
            .isEqualTo("parking");
    }

    @Test
    void amenityResolutionSubtractsMatchedPhraseFromIdentity() {
        // The matched amenity phrase's tokens never count as a branch
        // name: a singular "cơ sở có bãi đỗ xe" must scan generically
        // (the "đỗ" spelling used to fail closed as a residual name term).
        AiChatSourceResolver resolver = resolverWith(
            branch("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 3",
                "co-so-2-quan-3", "Bãi đỗ xe"));
        AiChatSourceResolver.AmenityResolution resolution =
            resolver.resolveAmenity("Cơ sở có bãi đỗ xe không?");
        assertThat(resolution).isNotNull();
        assertThat(resolution.specific()).isFalse();
        assertThat(resolution.matches()).hasSize(1);
    }

    @Test
    void amenityResolutionKeepsToponymBranchIdentity() {
        // A branch whose name is built only from facility-like tokens
        // ("Sân Bay") still counts as a specific identity: generic-scan
        // answers would otherwise silently answer about OTHER branches.
        AiChatSourceResolver resolver = resolverWith(
            branch("Phòng khám Sân Bay", "phong-kham-san-bay", "Wi-Fi"),
            branch("Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 3",
                "co-so-2-quan-3", "Bãi đỗ xe"));
        AiChatSourceResolver.AmenityResolution resolution =
            resolver.resolveAmenity("Cơ sở Sân Bay có wifi không?");
        assertThat(resolution).isNotNull();
        assertThat(resolution.specific()).isTrue();
        assertThat(resolution.resolved())
            .extracting(value -> value.source().title())
            .containsExactly("Phòng khám Sân Bay");
        assertThat(resolution.matches())
            .extracting(value -> value.source().title())
            .containsExactly("Phòng khám Sân Bay");
    }

    @Test
    void amenityResolutionFlagsTruncatedMatchLists() {
        // The answer text quotes an enumeration — callers must know when
        // the list was capped so wording cannot claim completeness.
        AiChatSourceResolver resolver = resolverWith(
            branch("Cơ sở A", "co-so-a", "Bãi đỗ xe"),
            branch("Cơ sở B", "co-so-b", "Bãi đỗ xe"),
            branch("Cơ sở C", "co-so-c", "Bãi đỗ xe"),
            branch("Cơ sở D", "co-so-d", "Bãi đỗ xe"));
        AiChatSourceResolver.AmenityResolution resolution =
            resolver.resolveAmenity("Các cơ sở có bãi đậu xe không?");
        assertThat(resolution).isNotNull();
        assertThat(resolution.matches()).hasSize(3);
        assertThat(resolution.truncated()).isTrue();
    }
}
