package com.healthcare.consultation;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Executes the directory and handoff service against disposable PostgreSQL. */
class ConsultationHandoffDirectoryIntegrationTest extends AbstractIntegrationTest {
    @Autowired private PatientConsultationService consultations;
    @Autowired private RoleRepository roles;

    private HealthcareUserPrincipal actor;
    private Doctor currentDoctor;
    private Doctor recipient;
    private Specialty specialty;
    private Branch branch;
    private UUID appointmentId;
    private UUID threadId;

    @BeforeEach
    void fixture() {
        User owner = user("PATIENT");
        User doctorUser = user("DOCTOR");
        actor = HealthcareUserPrincipal.from(doctorUser);
        currentDoctor = doctor(doctorUser);
        recipient = doctor(user("DOCTOR"));
        specialty = new Specialty();
        specialty.setName("Synthetic specialty");
        specialty.setSlug("synthetic-" + UUID.randomUUID());
        specialty.setActive(true);
        specialty = specialtyRepository.saveAndFlush(specialty);
        branch = new Branch();
        branch.setName("Synthetic branch");
        branch.setSlug("synthetic-" + UUID.randomUUID());
        branch.setAddress("Synthetic fixture only");
        branch.setActive(true);
        branch = branchRepository.saveAndFlush(branch);
        DoctorSpecialty specialtyMapping = new DoctorSpecialty();
        specialtyMapping.setDoctor(recipient);
        specialtyMapping.setSpecialty(specialty);
        doctorSpecialtyRepository.saveAndFlush(specialtyMapping);
        DoctorBranch branchMapping = new DoctorBranch();
        branchMapping.setDoctor(recipient);
        branchMapping.setBranch(branch);
        doctorBranchRepository.saveAndFlush(branchMapping);
        DoctorBranch currentBranchMapping = new DoctorBranch();
        currentBranchMapping.setDoctor(currentDoctor);
        currentBranchMapping.setBranch(branch);
        doctorBranchRepository.saveAndFlush(currentBranchMapping);

        PatientProfile patient = new PatientProfile();
        patient.setUserId(owner.getId());
        patient.setFullName("Synthetic patient");
        patient.setPhone("0900000000");
        patient.setEmail(owner.getEmail());
        patient = patientProfileRepository.saveAndFlush(patient);
        Appointment appointment = new Appointment();
        appointment.setBookingCode("HANDOFF-" + UUID.randomUUID().toString().substring(0, 16));
        appointment.setPatient(patient);
        appointment.setDoctor(currentDoctor);
        appointment.setSpecialty(specialty);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(LocalDate.now().plusDays(1));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.of(
            appointment.getAppointmentDate(), appointment.getStartTime(), ZoneOffset.UTC));
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Synthetic directory parity regression");
        appointment = appointmentRepository.saveAndFlush(appointment);
        appointmentId = appointment.getId();
        threadId = consultations.create(new ConsultationContracts.CreateRequest(
            appointmentId, "Synthetic consultation", true, "consultation-v1"),
            HealthcareUserPrincipal.from(owner)).id();
    }

    @Test
    void matchingInactiveSpecialtyIsNotOffered() {
        jdbcTemplate.update("UPDATE specialties SET active=false WHERE id=?", specialty.getId());
        assertRecipientRejected();
    }

    @Test
    void matchingInactiveBranchIsNotOffered() {
        jdbcTemplate.update("UPDATE branches SET active=false WHERE id=?", branch.getId());
        assertRecipientRejected();
    }

    @Test
    void nullScopeWithoutAnyAssociationsIsNotOffered() {
        clearScope("both");
        jdbcTemplate.update("DELETE FROM doctor_specialties WHERE doctor_id=?", recipient.getId());
        jdbcTemplate.update("DELETE FROM doctor_branches WHERE doctor_id=?", recipient.getId());
        assertRecipientRejected();
    }

    @ParameterizedTest
    @ValueSource(strings = {"specialty", "branch"})
    void nullScopeStillRequiresBothActiveAssociations(String missingAssociation) {
        clearScope("both");
        if (missingAssociation.equals("specialty")) {
            jdbcTemplate.update("DELETE FROM doctor_specialties WHERE doctor_id=?", recipient.getId());
        } else {
            jdbcTemplate.update("DELETE FROM doctor_branches WHERE doctor_id=?", recipient.getId());
        }
        assertRecipientRejected();
    }

    @ParameterizedTest
    @ValueSource(strings = {"none", "specialty", "branch", "both"})
    void activeMatchingAndNullWildcardRecipientsCanActuallyJoin(String nullScope) {
        clearScope(nullScope);
        var offered = consultations.handoffDirectory(threadId, actor);
        assertThat(offered).hasSize(1);
        assertThat(offered.getFirst().doctorId()).isEqualTo(recipient.getId());
        assertThat(offered.getFirst().specialtySlug()).isEqualTo(specialty.getSlug());
        assertThat(offered.getFirst().branchSlug()).isEqualTo(branch.getSlug());

        consultations.handoff(threadId, new ConsultationContracts.HandoffRequest(recipient.getId()), actor);
        assertThat(jdbcTemplate.queryForObject("""
            SELECT count(*) FROM patient_consultation_participants
             WHERE thread_id=? AND user_id=? AND participant_role='HANDOFF_DOCTOR' AND left_at IS NULL
            """, Integer.class, threadId, recipient.getUserId())).isEqualTo(1);
        assertThat(consultations.listForDoctor(HealthcareUserPrincipal.from(
            userRepository.findWithRolesById(recipient.getUserId()).orElseThrow())))
            .extracting(ConsultationContracts.ConsultationSummary::id).containsExactly(threadId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"specialty", "branch"})
    void nonnullScopeRejectsUnassociatedRecipients(String unrelatedScope) {
        if (unrelatedScope.equals("specialty")) {
            jdbcTemplate.update("DELETE FROM doctor_specialties WHERE doctor_id=?", recipient.getId());
        } else {
            jdbcTemplate.update("DELETE FROM doctor_branches WHERE doctor_id=?", recipient.getId());
        }
        assertRecipientRejected();
    }

    @ParameterizedTest
    @ValueSource(strings = {"doctor", "user", "role"})
    void inactiveOrNonDoctorRecipientsRemainUnavailable(String invalidIdentity) {
        switch (invalidIdentity) {
            case "doctor" -> jdbcTemplate.update("UPDATE doctors SET active=false WHERE id=?", recipient.getId());
            case "user" -> jdbcTemplate.update("UPDATE users SET status='DISABLED' WHERE id=?", recipient.getUserId());
            case "role" -> jdbcTemplate.update("DELETE FROM user_roles WHERE user_id=?", recipient.getUserId());
            default -> throw new IllegalArgumentException(invalidIdentity);
        }
        assertRecipientRejected();
    }

    @Test
    void actingDoctorCannotBeOfferedOrSelectedEvenWithValidMappings() {
        jdbcTemplate.update("INSERT INTO doctor_specialties (id,doctor_id,specialty_id) VALUES (?,?,?)",
            UUID.randomUUID(), currentDoctor.getId(), specialty.getId());
        assertThat(consultations.handoffDirectory(threadId, actor))
            .extracting(ConsultationContracts.HandoffDoctor::doctorId).containsExactly(recipient.getId());
        assertThatThrownBy(() -> consultations.handoff(threadId,
            new ConsultationContracts.HandoffRequest(currentDoctor.getId()), actor))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("code", "CONSULTATION_DOCTOR_UNAVAILABLE");
    }

    private void assertRecipientRejected() {
        // Independently exercise the unchanged mutation resolver before checking
        // directory parity. A loose mocked JDBC response cannot prove this rule.
        assertThatThrownBy(() -> consultations.handoff(threadId,
            new ConsultationContracts.HandoffRequest(recipient.getId()), actor))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("code", "CONSULTATION_DOCTOR_UNAVAILABLE")
            .hasFieldOrPropertyWithValue("status", 409);
        assertThat(consultations.handoffDirectory(threadId, actor)).isEmpty();
    }

    private void clearScope(String dimension) {
        switch (dimension) {
            case "specialty" -> jdbcTemplate.update("UPDATE appointments SET specialty_id=NULL WHERE id=?", appointmentId);
            case "branch" -> jdbcTemplate.update("UPDATE appointments SET branch_id=NULL WHERE id=?", appointmentId);
            case "both" -> jdbcTemplate.update("UPDATE appointments SET specialty_id=NULL,branch_id=NULL WHERE id=?", appointmentId);
            case "none" -> { }
            default -> throw new IllegalArgumentException(dimension);
        }
    }

    private Doctor doctor(User user) {
        Doctor doctor = new Doctor();
        doctor.setFullName("Synthetic " + user.getId());
        doctor.setSlug("synthetic-" + UUID.randomUUID());
        doctor.setUserId(user.getId());
        doctor.setActive(true);
        return doctorRepository.saveAndFlush(doctor);
    }

    private User user(String roleCode) {
        var role = roles.findByCode(roleCode).orElseThrow();
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setPasswordHash("unused-synthetic-test-hash");
        user.setDisplayName("Synthetic " + roleCode);
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.saveAndFlush(user);
        jdbcTemplate.update("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", user.getId(), role.getId());
        user.addRole(role);
        return user;
    }
}
