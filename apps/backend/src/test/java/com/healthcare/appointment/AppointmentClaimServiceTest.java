package com.healthcare.appointment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentAccountClaim;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Regression net for the automatic booking-to-account linkage (bind + claim).
 *
 * <p>Before this class existed the two claim entry points
 * ({@code claimAfterBookingOtp}, wired at BookingService after a successful
 * OTP confirm, and {@code claimAfterEmailVerification}, wired at
 * AuthService.confirmEmailLocked) had no direct test coverage: a refactor that
 * silently broke the claim — the feature that makes a guest booking history
 * visible after the same person registers — would pass every other suite.
 *
 * <p>The four cases:
 * <ol>
 *   <li>register with a phone+email matching an unlinked guest booking
 *       profile reuses that exact profile row instead of creating a
 *       duplicate (the bind half, extending the scenario proven by
 *       AuthControllerTest.registrationReusesMatchingUnlinkedBookingProfile);</li>
 *   <li>an OTP-confirmed booking is claimed with source BOOKING_OTP for a
 *       verified+ACTIVE user holding the same email, and never for a
 *       non-CONFIRMED appointment;</li>
 *   <li>email verification claims every CONFIRMED, still-unclaimed
 *       appointment whose guest profile email matches
 *       (findConfirmedUnclaimedByPatientEmail) — and only those;</li>
 *   <li>negative: a profile already owned by another user is never claimed
 *       for a second account — no row, no history leak.</li>
 * </ol>
 */
@Transactional
class AppointmentClaimServiceTest extends TestcontainersIntegrationTest {

    private static final LocalDate APPOINTMENT_DATE = LocalDate.of(2030, 3, 10);

    @Autowired private AppointmentClaimService appointmentClaimService;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    /**
     * Registration sends a verification OTP; the mocked sender keeps the test
     * hermetic exactly as in AuthControllerTest. The AfterCommitEmailSender
     * deferral means nothing is delivered inside the rolled-back test
     * transaction anyway.
     */
    @MockitoBean
    private EmailSender emailSender;

    @Test
    void registerWithMatchingPhoneAndEmailBindsExistingGuestBookingProfile() throws Exception {
        // Guest booking profile: created by the public booking flow, no owner.
        PatientProfile guestProfile = new PatientProfile();
        guestProfile.setFullName("Guest Booking Name");
        guestProfile.setPhone("0905550001");
        guestProfile.setEmail("bind.register@example.com");
        guestProfile = patientProfileRepository.saveAndFlush(guestProfile);
        UUID guestProfileId = guestProfile.getId();

        // Same person registers with the same phone (separator noise must
        // canonicalize to the stored number) and the same email.
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "bind.register@example.com",
                      "password": "%s",
                      "displayName": "Registered Name",
                      "phone": "090 555-0001"
                    }
                    """.formatted(fixturePassword())))
            .andExpect(status().isAccepted());

        User user = userRepository.findByEmail("bind.register@example.com").orElseThrow();
        var linked = patientProfileRepository.findByUserId(user.getId()).orElseThrow();
        // The binding decision in AuthService.register: the existing guest
        // profile row is reused, never duplicated, and now carries the user id.
        assertThat(linked.getId()).isEqualTo(guestProfileId);
        assertThat(linked.getUserId()).isEqualTo(user.getId());
        // No second profile was created for the same contact phone.
        assertThat(patientProfileRepository.findByPhone("0905550001")).hasValueSatisfying(profile ->
            assertThat(profile.getId()).isEqualTo(guestProfileId));
    }

    /**
     * Hermetic throwaway password for disposable Testcontainers accounts.
     * Generated per call so no credential literal is added to source —
     * same pattern as AuthControllerTest.fixturePassword().
     */
    private static String fixturePassword() {
        return "Fixture!" + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + "A1";
    }

    @Test
    void bookingOtpConfirmClaimsAppointmentForVerifiedActiveUserWithMatchingEmail() {
        User patientUser = createPatientUser("otp.claim@example.com");
        PatientProfile guestProfile = createGuestProfile(patientUser.getEmail(), "0906660001");

        Doctor doctor = createDoctor();
        Branch branch = createBranch();
        assignDoctorToBranch(doctor, branch);
        Appointment confirmed = createAppointment(guestProfile, doctor, branch,
            LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        // The status guard: only CONFIRMED bookings are claim candidates.
        Appointment cancelled = createAppointment(guestProfile, doctor, branch,
            LocalTime.of(10, 0), AppointmentStatus.CANCELLED);

        appointmentClaimService.claimAfterBookingOtp(confirmed);

        var claims = appointmentAccountClaimRepository.findAll();
        assertThat(claims).hasSize(1);
        AppointmentAccountClaim claim = claims.getFirst();
        assertThat(claim.getClaimSource()).isEqualTo("BOOKING_OTP");
        assertThat(claim.getAppointment().getId()).isEqualTo(confirmed.getId());
        assertThat(claim.getUser().getId()).isEqualTo(patientUser.getId());
        assertThat(appointmentClaimService.isOwned(confirmed.getId(), patientUser.getId())).isTrue();
        // Cancelled history stays invisible to the account.
        assertThat(appointmentClaimService.isOwned(cancelled.getId(), patientUser.getId())).isFalse();
    }

    @Test
    void emailVerificationClaimsEveryConfirmedUnclaimedAppointmentForPatientEmail() {
        User patientUser = createPatientUser("verify.claim@example.com");
        PatientProfile guestProfile = createGuestProfile(patientUser.getEmail(), "0907770001");

        Doctor doctor = createDoctor();
        Branch branch = createBranch();
        assignDoctorToBranch(doctor, branch);
        Appointment alreadyClaimed = createAppointment(guestProfile, doctor, branch,
            LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        Appointment freshConfirmed = createAppointment(guestProfile, doctor, branch,
            LocalTime.of(9, 30), AppointmentStatus.CONFIRMED);
        Appointment cancelled = createAppointment(guestProfile, doctor, branch,
            LocalTime.of(10, 0), AppointmentStatus.CANCELLED);

        User otherUser = createPatientUser("verify.other@example.com");
        PatientProfile otherProfile = createGuestProfile(otherUser.getEmail(), "0907770002");
        Appointment otherPatients = createAppointment(otherProfile, doctor, branch,
            LocalTime.of(10, 30), AppointmentStatus.CONFIRMED);

        AppointmentAccountClaim preSeed = new AppointmentAccountClaim();
        preSeed.setAppointment(alreadyClaimed);
        preSeed.setUser(patientUser);
        preSeed.setClaimSource("BOOKING_OTP");
        appointmentAccountClaimRepository.saveAndFlush(preSeed);

        // Only the still-unclaimed, CONFIRMED appointment of this patient's
        // email enters the claim list: alreadyClaimed is excluded, cancelled
        // fails the status filter, otherPatients fails the email filter.
        int claimed = appointmentClaimService.claimAfterEmailVerification(patientUser);
        assertThat(claimed).isEqualTo(1);

        var freshClaim = appointmentAccountClaimRepository.findByAppointmentId(freshConfirmed.getId());
        assertThat(freshClaim).hasValueSatisfying(claim -> {
            assertThat(claim.getClaimSource()).isEqualTo("EMAIL_VERIFICATION");
            assertThat(claim.getUser().getId()).isEqualTo(patientUser.getId());
        });
        // The pre-existing claim is not duplicated by the verification sweep.
        assertThat(appointmentAccountClaimRepository.findByAppointmentId(alreadyClaimed.getId()))
            .hasValueSatisfying(claim -> assertThat(claim.getClaimSource()).isEqualTo("BOOKING_OTP"));
        assertThat(appointmentAccountClaimRepository.findByAppointmentId(cancelled.getId())).isEmpty();
        assertThat(appointmentAccountClaimRepository.findByAppointmentId(otherPatients.getId())).isEmpty();
        // The other account receives nothing from this verification.
        assertThat(appointmentClaimService.isOwned(freshConfirmed.getId(), otherUser.getId())).isFalse();
    }

    @Test
    void claimSkipsWhenProfileAlreadyOwnedByAnotherUser() {
        User owner = createPatientUser("owner.claim@example.com");
        User stranger = createPatientUser("stranger.claim@example.com");

        // The profile email matches the stranger (so the email lookups find
        // that account) but the row is already bound to the owner.
        PatientProfile ownedProfile = new PatientProfile();
        ownedProfile.setFullName("Owned Profile");
        ownedProfile.setPhone("0908880001");
        ownedProfile.setEmail(stranger.getEmail());
        ownedProfile.setUserId(owner.getId());
        ownedProfile = patientProfileRepository.saveAndFlush(ownedProfile);

        Doctor doctor = createDoctor();
        Branch branch = createBranch();
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(ownedProfile, doctor, branch,
            LocalTime.of(11, 0), AppointmentStatus.CONFIRMED);

        // Both claim entry points reach createClaim for the stranger; the
        // ownership guard must reject both. Asserting the non-zero reach
        // first proves the guard was exercised rather than the query being
        // empty for another reason.
        appointmentClaimService.claimAfterBookingOtp(appointment);
        int reached = appointmentClaimService.claimAfterEmailVerification(stranger);
        assertThat(reached).isEqualTo(1);

        // No claim row, no leak: neither account sees the appointment.
        assertThat(appointmentAccountClaimRepository.findAll()).isEmpty();
        assertThat(appointmentClaimService.isOwned(appointment.getId(), stranger.getId())).isFalse();
        assertThat(appointmentClaimService.isOwned(appointment.getId(), owner.getId())).isFalse();
    }

    // ── Fixture helpers (mirroring AppointmentPortalIntegrationTest) ─────────

    private User createPatientUser(String email) {
        Role role = roleRepository.findByCode("PATIENT").orElseThrow();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Claim Test Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(role);
        return userRepository.saveAndFlush(user);
    }

    private PatientProfile createGuestProfile(String email, String phone) {
        PatientProfile profile = new PatientProfile();
        profile.setFullName("Guest Booking Patient");
        profile.setPhone(phone);
        profile.setEmail(email);
        return patientProfileRepository.saveAndFlush(profile);
    }

    private Doctor createDoctor() {
        User doctorUser = new User();
        doctorUser.setEmail("claim.doctor." + UUID.randomUUID() + "@example.com");
        doctorUser.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        doctorUser.setDisplayName("Claim Test Doctor");
        doctorUser.setStatus("ACTIVE");
        doctorUser.setCreatedAt(OffsetDateTime.now());
        doctorUser.setUpdatedAt(OffsetDateTime.now());
        doctorUser.addRole(roleRepository.findByCode("DOCTOR").orElseThrow());
        doctorUser = userRepository.saveAndFlush(doctorUser);

        Doctor doctor = new Doctor();
        doctor.setUserId(doctorUser.getId());
        doctor.setFullName(doctorUser.getDisplayName());
        doctor.setSlug("claim-doctor-" + UUID.randomUUID());
        doctor.setActive(true);
        return doctorRepository.saveAndFlush(doctor);
    }

    private Branch createBranch() {
        Branch branch = new Branch();
        branch.setName("Claim test branch");
        branch.setSlug("claim-branch-" + UUID.randomUUID());
        branch.setAddress("Claim test address");
        branch.setActive(true);
        return branchRepository.saveAndFlush(branch);
    }

    private void assignDoctorToBranch(Doctor doctor, Branch branch) {
        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
    }

    private Appointment createAppointment(PatientProfile patient, Doctor doctor, Branch branch,
            LocalTime start, AppointmentStatus status) {
        Appointment appointment = new Appointment();
        appointment.setBookingCode("CLAIM-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(APPOINTMENT_DATE);
        appointment.setStartTime(start);
        appointment.setEndTime(start.plusMinutes(30));
        appointment.setAppointmentTime(OffsetDateTime.of(APPOINTMENT_DATE, start, ZoneOffset.UTC));
        appointment.setStatus(status);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Claim regression test");
        return appointmentRepository.saveAndFlush(appointment);
    }
}
