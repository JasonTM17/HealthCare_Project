package com.healthcare.hospital;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.hospital.dto.AdminDoctorResponse;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.service.AdminDoctorService;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Read-side guard for {@code GET /api/v1/admin/doctors}.
 *
 * <p>Round-10 matrix: the endpoint returned the raw {@link Doctor} entity, whose
 * JSON carried no {@code branchIds}, so the admin schedules page collapsed its
 * branch dropdown to zero options and schedule creation via the UI was
 * impossible. These tests pin that the admin list now returns {@code branchIds}
 * sourced from the {@code doctor_branches} link table (the same repository the
 * public catalog uses) while paging/sort and the pre-existing keys survive.
 *
 * <p>Service-level with repository doubles, following the sibling article
 * guard suites: no Docker/PostgreSQL needed; the HTTP path is a separate gate.
 */
class AdminDoctorListBranchIdsTest {

    private final DoctorRepository doctorRepository = mock(DoctorRepository.class);
    private final DoctorBranchRepository doctorBranchRepository = mock(DoctorBranchRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AdminDoctorService service =
        new AdminDoctorService(doctorRepository, userRepository, doctorBranchRepository);

    private static Doctor doctor(String fullName, String slug, UUID id) {
        Doctor doctor = new Doctor();
        doctor.setId(id);
        doctor.setFullName(fullName);
        doctor.setSlug(slug);
        doctor.setBio("bio-" + slug);
        doctor.setPhotoUrl("/media/" + slug + ".jpg");
        doctor.setAchievements("ach-" + slug);
        doctor.setActive(true);
        doctor.setUserId(UUID.fromString("10000000-0000-0000-0000-000000000009"));
        doctor.setAiCredits(77);
        return doctor;
    }

    private static DoctorBranch link(Doctor doctor, UUID branchId) {
        DoctorBranch link = new DoctorBranch();
        link.setId(UUID.randomUUID());
        link.setDoctor(doctor);
        Branch branch = new Branch();
        branch.setId(branchId);
        link.setBranch(branch);
        return link;
    }

    // ── T1: branchIds populated per doctor from the link table ───────────────

    @Test
    void listReturnsBranchIdsForEachDoctorFromTheLinkTable() {
        UUID doctor1Id = UUID.fromString("30000000-0000-0000-0000-000000000001");
        UUID doctor2Id = UUID.fromString("30000000-0000-0000-0000-000000000002");
        UUID doctor3Id = UUID.fromString("30000000-0000-0000-0000-000000000003");
        Doctor d1 = doctor("BS Một", "bs-mot", doctor1Id);
        Doctor d2 = doctor("BS Hai", "bs-hai", doctor2Id);
        Doctor d3 = doctor("BS Ba", "bs-ba", doctor3Id);

        UUID branchA = UUID.fromString("40000000-0000-0000-0000-00000000000a");
        UUID branchB = UUID.fromString("40000000-0000-0000-0000-00000000000b");
        UUID branchC = UUID.fromString("40000000-0000-0000-0000-00000000000c");

        Pageable pageable = PageRequest.of(0, 20, Sort.by("fullName"));
        when(doctorRepository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(d1, d2, d3), pageable, 3));
        // One doctor with two branches, one with a single branch, one unassigned.
        when(doctorBranchRepository.findByDoctorIdIn(anyCollection())).thenReturn(List.of(
            link(d1, branchA),
            link(d1, branchB),
            link(d2, branchC)));

        Page<AdminDoctorResponse> result = service.list(pageable);

        assertThat(result.getContent()).extracting(AdminDoctorResponse::id)
            .containsExactly(doctor1Id.toString(), doctor2Id.toString(), doctor3Id.toString());
        assertThat(result.getContent().get(0).branchIds())
            .containsExactlyInAnyOrder(branchA.toString(), branchB.toString());
        assertThat(result.getContent().get(1).branchIds()).containsExactly(branchC.toString());
        assertThat(result.getContent().get(2).branchIds())
            .as("unassigned doctor yields an empty array, not null, so FE `.length` guards hold")
            .isEmpty();

        verify(doctorBranchRepository).findByDoctorIdIn(argContainsAll(doctor1Id, doctor2Id, doctor3Id));
    }

    @Test
    void branchIdsAreStringsOfTheBranchUuidNotNumbers() {
        UUID doctorId = UUID.fromString("30000000-0000-0000-0000-000000000005");
        Doctor d = doctor("BS Nam", "bs-nam", doctorId);
        UUID branch = UUID.fromString("40000000-0000-0000-0000-00000000000d");
        Pageable pageable = PageRequest.of(0, 20, Sort.by("fullName"));
        when(doctorRepository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(d), pageable, 1));
        when(doctorBranchRepository.findByDoctorIdIn(anyCollection())).thenReturn(List.of(link(d, branch)));

        AdminDoctorResponse dto = service.list(pageable).getContent().get(0);

        assertThat(dto.branchIds()).containsExactly(branch.toString());
    }

    // ── T2: other admin-UI keys preserved, quota/identity still hidden ───────

    @Test
    void preservesTheKeysTheAdminUiReadsAndHidesInternalAccounting() throws Exception {
        UUID doctorId = UUID.fromString("30000000-0000-0000-0000-000000000006");
        Doctor d = doctor("BS Tứ", "bs-tu", doctorId);
        Pageable pageable = PageRequest.of(0, 20, Sort.by("fullName"));
        when(doctorRepository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(d), pageable, 1));
        when(doctorBranchRepository.findByDoctorIdIn(anyCollection())).thenReturn(List.of());

        AdminDoctorResponse dto = service.list(pageable).getContent().get(0);

        assertThat(dto.fullName()).isEqualTo("BS Tứ");
        assertThat(dto.slug()).isEqualTo("bs-tu");
        assertThat(dto.bio()).isEqualTo("bio-bs-tu");
        assertThat(dto.photoUrl()).isEqualTo("/media/bs-tu.jpg");
        assertThat(dto.achievements()).isEqualTo("ach-bs-tu");
        assertThat(dto.active()).isTrue();

        // Same invariant the entity held: the admin JSON publishes neither the
        // internal user link nor the AI quota, and now only adds branchIds.
        String json = new ObjectMapper().writeValueAsString(dto);
        assertThat(json).contains("\"branchIds\":[]");
        assertThat(json).doesNotContain("userId");
        assertThat(json).doesNotContain("aiCredits");
    }

    // ── T3: pagination + sort forwarded unchanged ────────────────────────────

    @Test
    void paginationAndSortArePreserved() {
        UUID doctorId1 = UUID.fromString("30000000-0000-0000-0000-000000000007");
        UUID doctorId2 = UUID.fromString("30000000-0000-0000-0000-000000000008");
        Doctor d1 = doctor("BS Năm", "bs-nam", doctorId1);
        Doctor d2 = doctor("BS Sáu", "bs-sau", doctorId2);
        Pageable pageable = PageRequest.of(2, 5, Sort.by("fullName").ascending());
        // A deep page of a larger set: offset 10 + 2 elements = 12 total.
        Page<Doctor> raw = new PageImpl<>(List.of(d1, d2), pageable, 12);
        when(doctorRepository.findAll(pageable)).thenReturn(raw);
        when(doctorBranchRepository.findByDoctorIdIn(anyCollection())).thenReturn(List.of());

        Page<AdminDoctorResponse> result = service.list(pageable);

        // The exact pageable (offset, size, sort) is forwarded to the repository.
        verify(doctorRepository).findAll(eq(pageable));
        // Page.map copies the source metadata, so paging/sort survive unchanged.
        assertThat(result.getNumber()).isEqualTo(2);
        assertThat(result.getSize()).isEqualTo(5);
        assertThat(result.getNumber()).isEqualTo(raw.getNumber());
        assertThat(result.getSize()).isEqualTo(raw.getSize());
        assertThat(result.getTotalElements()).isEqualTo(raw.getTotalElements());
        assertThat(result.getTotalPages()).isEqualTo(raw.getTotalPages());
        assertThat(result.getSort()).isEqualTo(pageable.getSort());
        assertThat(result.getSort().getOrderFor("fullName"))
            .isNotNull()
            .extracting(Sort.Order::getDirection)
            .isEqualTo(Sort.Direction.ASC);
    }

    // ── T4: empty page short-circuits the link lookup ────────────────────────

    @Test
    void emptyPageSkipsTheBranchLinkQuery() {
        Pageable pageable = PageRequest.of(0, 20, Sort.by("fullName"));
        when(doctorRepository.findAll(pageable))
            .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        Page<AdminDoctorResponse> result = service.list(pageable);

        assertThat(result.getContent()).isEmpty();
        verify(doctorBranchRepository, never()).findByDoctorIdIn(anyCollection());
    }

    @SuppressWarnings("unchecked")
    private static Collection<UUID> argContainsAll(UUID... ids) {
        return org.mockito.ArgumentMatchers.argThat(actual ->
            actual != null && java.util.Arrays.asList(ids).containsAll(actual));
    }
}
