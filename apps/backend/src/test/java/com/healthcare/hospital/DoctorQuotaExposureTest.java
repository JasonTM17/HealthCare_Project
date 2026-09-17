package com.healthcare.hospital;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.hospital.dto.DoctorProfileResponse;
import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.entity.Doctor;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The AI credit balance is internal accounting for one clinician, but it lived
 * on {@link DoctorResponse} — the shape shared by the public catalog, the
 * appointment portal and the care-plan surfaces — so every doctor's remaining
 * quota was published to anonymous visitors on the public directory, and the
 * admin controller serialised the entity directly, exposing it again.
 *
 * <p>These tests pin the separation: the public projection carries no
 * accounting, the profile projection does, and the entity carries neither when
 * serialised.
 */
class DoctorQuotaExposureTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private Doctor doctor() {
        Doctor doctor = new Doctor();
        doctor.setId(UUID.fromString("30000000-0000-0000-0000-000000000002"));
        doctor.setFullName("BS.CKII Võ Thị Mai");
        doctor.setSlug("vo-thi-mai");
        doctor.setBio("Chuyên gia sản phụ khoa");
        doctor.setAiCredits(150);
        doctor.setUserId(UUID.fromString("10000000-0000-0000-0000-000000000009"));
        return doctor;
    }

    @Test
    void publicProjectionCarriesNoQuota() throws Exception {
        DoctorResponse response = new DoctorResponse(
            "30000000-0000-0000-0000-000000000002",
            "BS.CKII Võ Thị Mai",
            "vo-thi-mai",
            "Chuyên gia sản phụ khoa",
            "/media/doctors/doctor-2.jpg",
            "Sản phụ khoa",
            null, List.of(), List.of(), List.of(),
            null,
            false);

        String json = mapper.writeValueAsString(response);

        assertThat(json).doesNotContain("aiCredits");
        assertThat(json).doesNotContain("userId");
        assertThat(json).contains("vo-thi-mai");
    }

    @Test
    void profileProjectionCarriesTheOwningDoctorsQuota() throws Exception {
        DoctorResponse publicView = new DoctorResponse(
            "30000000-0000-0000-0000-000000000002",
            "BS.CKII Võ Thị Mai",
            "vo-thi-mai",
            "Chuyên gia sản phụ khoa",
            "/media/doctors/doctor-2.jpg",
            "Sản phụ khoa",
            null, List.of(), List.of(), List.of(),
            null,
            false);

        DoctorProfileResponse profile = DoctorProfileResponse.of(publicView, 150);
        String json = mapper.writeValueAsString(profile);

        assertThat(json).contains("\"aiCredits\":150");
        // The internal user identity is not part of the profile either.
        assertThat(json).doesNotContain("userId");
    }

    @Test
    void serialisedEntityCarriesNeitherQuotaNorIdentity() throws Exception {
        String json = mapper.writeValueAsString(doctor());

        assertThat(json).doesNotContain("aiCredits");
        assertThat(json).doesNotContain("userId");
        assertThat(json).contains("vo-thi-mai");
        assertThat(json).contains("BS.CKII Võ Thị Mai");
    }

    @Test
    void missingQuotaIsNotInvented() {
        Doctor withoutCredits = doctor();
        withoutCredits.setAiCredits(null);

        // The getter keeps its documented fallback for internal callers; what
        // matters is that no HTTP shape publishes a fabricated number.
        assertThat(withoutCredits.getAiCredits()).isEqualTo(150);
        String json = assertDoesNotThrowJson(withoutCredits);
        assertThat(json).doesNotContain("aiCredits");
    }

    private String assertDoesNotThrowJson(Doctor doctor) {
        try {
            return mapper.writeValueAsString(doctor);
        } catch (Exception ex) {
            throw new AssertionError("serialisation failed", ex);
        }
    }

    @Test
    void profileProjectionPreservesEveryPublicField() {
        DoctorResponse publicView = new DoctorResponse(
            "id-1", "Tên", "slug-1", "bio", "/photo.jpg", "Khoa",
            "branch-1", List.of("branch-1"), List.of("Cơ sở 1"), List.of("khoa-1"),
            "thành tựu", true);

        DoctorProfileResponse profile = DoctorProfileResponse.of(publicView, 42);

        assertThat(profile.id()).isEqualTo(publicView.id());
        assertThat(profile.fullName()).isEqualTo(publicView.fullName());
        assertThat(profile.slug()).isEqualTo(publicView.slug());
        assertThat(profile.bio()).isEqualTo(publicView.bio());
        assertThat(profile.photoUrl()).isEqualTo(publicView.photoUrl());
        assertThat(profile.specialtyName()).isEqualTo(publicView.specialtyName());
        assertThat(profile.branchId()).isEqualTo(publicView.branchId());
        assertThat(profile.branchIds()).isEqualTo(publicView.branchIds());
        assertThat(profile.branchNames()).isEqualTo(publicView.branchNames());
        assertThat(profile.specialtySlugs()).isEqualTo(publicView.specialtySlugs());
        assertThat(profile.achievements()).isEqualTo(publicView.achievements());
        assertThat(profile.demo()).isEqualTo(publicView.demo());
        assertThat(profile.aiCredits()).isEqualTo(42);
    }
}
