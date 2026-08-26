package com.healthcare.appointment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.RescheduleAppointmentRequest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
class AppointmentBookingIntegrationTest extends TestcontainersIntegrationTest {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String BOOKING_EMAIL = "booking.test@example.com";

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private com.healthcare.hospital.repository.DoctorSpecialtyRepository doctorSpecialtyRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockitoBean
    private EmailSender emailSender;

    private Doctor doctor;
    private Specialty specialty;

    @BeforeEach
    void setUpTestData() {
        when(emailSender.isDeliveryAvailable()).thenReturn(true);
        specialty = new Specialty();
        specialty.setName("Chuyên khoa Tim Mạch");
        specialty.setSlug("tim-mach-test");
        specialty.setActive(true);
        specialty = specialtyRepository.save(specialty);

        doctor = new Doctor();
        doctor.setFullName("BS. CKII Nguyễn Văn An");
        doctor.setSlug("nguyen-van-an-test");
        doctor.setBio("Chuyên gia Tim Mạch 15 năm kinh nghiệm");
        doctor.setActive(true);
        doctor = doctorRepository.save(doctor);

        DoctorSpecialty doctorSpecialty = new DoctorSpecialty();
        doctorSpecialty.setDoctor(doctor);
        doctorSpecialty.setSpecialty(specialty);
        doctorSpecialtyRepository.save(doctorSpecialty);
    }

    @Test
    void holdRejectsSpecialtyThatIsNotAssignedToDoctor() throws Exception {
        Specialty unrelated = new Specialty();
        unrelated.setName("Chuyên khoa không thuộc bác sĩ");
        unrelated.setSlug("unrelated-" + UUID.randomUUID());
        unrelated.setActive(true);
        unrelated = specialtyRepository.save(unrelated);

        HoldSlotRequest request = new HoldSlotRequest(
            doctor.getId(), LocalDate.now(BUSINESS_ZONE).plusDays(2), LocalTime.of(9, 0),
            "Bệnh nhân kiểm thử", "0907000199", BOOKING_EMAIL, "Kiểm thử invariant",
            unrelated.getId(), null, null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void holdRejectsMissingPrivacyConsent() throws Exception {
        LocalDate appointmentDate = nextDate(DayOfWeek.MONDAY);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "doctorId": "%s",
                      "appointmentDate": "%s",
                      "startTime": "09:00:00",
                      "fullName": "Bệnh nhân chưa đồng ý",
                      "phone": "0907000299",
                      "specialtyId": "%s",
                      "privacyConsent": false
                    }
                    """.formatted(doctor.getId(), appointmentDate, specialty.getId())))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getDoctorSlotsReturnsCalculatedTimeSlots() throws Exception {
        LocalDate targetDate = nextDate(DayOfWeek.MONDAY);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$[0].startTime").exists())
            .andExpect(jsonPath("$[0].branchId").doesNotExist())
            .andExpect(jsonPath("$[0].available").value(true));
    }

    @Test
    void branchScopedSlotsAreTaggedAndFilteredByBranch() throws Exception {
        Branch morningBranch = createBranchForDoctor("slot-morning");
        Branch afternoonBranch = createBranchForDoctor("slot-afternoon");
        LocalDate targetDate = nextDate(DayOfWeek.MONDAY);
        saveSchedule(morningBranch, targetDate, 9, 0, 10, 0, 30);
        saveSchedule(afternoonBranch, targetDate, 14, 0, 15, 0, 30);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(4))
            .andExpect(jsonPath("$[0].branchId").value(morningBranch.getId().toString()))
            .andExpect(jsonPath("$[2].branchId").value(afternoonBranch.getId().toString()));

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", morningBranch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].branchId").value(morningBranch.getId().toString()))
            .andExpect(jsonPath("$[0].startTime").value("09:00:00"));

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", afternoonBranch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].branchId").value(afternoonBranch.getId().toString()))
            .andExpect(jsonPath("$[0].startTime").value("14:00:00"));
    }

    @Test
    void branchScopedBookingAllowsSamePendingSlotAtDifferentBranchesButRejectsSameBranch() throws Exception {
        Branch branchA = createBranchForDoctor("pending-a");
        Branch branchB = createBranchForDoctor("pending-b");
        LocalDate targetDate = nextDate(DayOfWeek.MONDAY);
        saveSchedule(branchA, targetDate, 9, 0, 10, 0, 30);
        saveSchedule(branchB, targetDate, 9, 0, 10, 0, 30);

        HoldSlotRequest branchAHold = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0),
            "Branch A patient", "0907000101", "branch-a@example.com", "Branch A hold",
            specialty.getId(), branchA.getId(), null);
        HoldSlotRequest branchBHold = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0),
            "Branch B patient", "0907000102", "branch-b@example.com", "Branch B hold",
            specialty.getId(), branchB.getId(), null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchAHold)))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchBHold)))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchAHold)))
            .andExpect(status().isConflict());
    }

    @Test
    void branchScopedBookingRejectsOverlappingIntervalOnlyWithinTheSameBranch() throws Exception {
        Branch branchA = createBranchForDoctor("interval-a");
        Branch branchB = createBranchForDoctor("interval-b");
        LocalDate targetDate = nextDate(DayOfWeek.THURSDAY);
        saveSchedule(branchA, targetDate, 9, 0, 11, 0, 60);
        saveSchedule(branchA, targetDate, 9, 30, 10, 30, 30);
        saveSchedule(branchB, targetDate, 9, 30, 10, 30, 30);

        HoldSlotRequest firstBranchAHold = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0),
            "Interval A patient", "0907000111", "interval-a@example.com", "Branch A interval",
            specialty.getId(), branchA.getId(), null);
        HoldSlotRequest branchBOverlap = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30),
            "Interval B patient", "0907000112", "interval-b@example.com", "Branch B overlap",
            specialty.getId(), branchB.getId(), null);
        HoldSlotRequest branchAOverlap = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30),
            "Interval A second patient", "0907000113", "interval-a-2@example.com", "Branch A overlap",
            specialty.getId(), branchA.getId(), null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(firstBranchAHold)))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchBOverlap)))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchAOverlap)))
            .andExpect(status().isConflict());
    }

    @Test
    void explicitBranchDoesNotReceiveTheBranchlessDemoFallback() throws Exception {
        Branch branch = createBranchForDoctor("no-default-leak");
        LocalDate targetDate = nextDate(DayOfWeek.TUESDAY);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", branch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());

        HoldSlotRequest request = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0),
            "Không đặt qua fallback", "0907000099", BOOKING_EMAIL, null,
            specialty.getId(), branch.getId(), null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void bookingRejectsInactiveOrMismatchedSpecialtyBeforeCreatingAppointment() throws Exception {
        Specialty inactive = new Specialty();
        inactive.setName("Inactive specialty");
        inactive.setSlug("inactive-specialty-" + UUID.randomUUID());
        inactive.setActive(false);
        inactive = specialtyRepository.saveAndFlush(inactive);

        HoldSlotRequest inactiveRequest = new HoldSlotRequest(
            doctor.getId(), LocalDate.now(BUSINESS_ZONE).plusDays(3), LocalTime.of(9, 0),
            "Inactive specialty patient", "0907000199", BOOKING_EMAIL, null,
            inactive.getId(), null, null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inactiveRequest)))
            .andExpect(status().isNotFound());

        Specialty otherActive = new Specialty();
        otherActive.setName("Unassigned specialty");
        otherActive.setSlug("unassigned-specialty-" + UUID.randomUUID());
        otherActive.setActive(true);
        otherActive = specialtyRepository.saveAndFlush(otherActive);

        HoldSlotRequest mismatchedRequest = new HoldSlotRequest(
            doctor.getId(), LocalDate.now(BUSINESS_ZONE).plusDays(3), LocalTime.of(9, 0),
            "Mismatched specialty patient", "0907000198", BOOKING_EMAIL, null,
            otherActive.getId(), null, null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mismatchedRequest)))
            .andExpect(status().isBadRequest());

        Branch inactiveBranch = new Branch();
        inactiveBranch.setName("Inactive branch");
        inactiveBranch.setSlug("inactive-branch-" + UUID.randomUUID());
        inactiveBranch.setAddress("No longer open");
        inactiveBranch.setActive(false);
        inactiveBranch = branchRepository.saveAndFlush(inactiveBranch);
        HoldSlotRequest inactiveBranchRequest = new HoldSlotRequest(
            doctor.getId(), LocalDate.now(BUSINESS_ZONE).plusDays(3), LocalTime.of(9, 0),
            "Inactive branch patient", "0907000197", BOOKING_EMAIL, null,
            specialty.getId(), inactiveBranch.getId(), null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inactiveBranchRequest)))
            .andExpect(status().isNotFound());

        com.healthcare.hospital.entity.Package inactivePackage = new com.healthcare.hospital.entity.Package();
        inactivePackage.setName("Inactive package");
        inactivePackage.setSlug("inactive-package-" + UUID.randomUUID());
        inactivePackage.setDescription("No longer bookable");
        inactivePackage.setPrice(BigDecimal.ONE);
        inactivePackage.setActive(false);
        inactivePackage = packageRepository.saveAndFlush(inactivePackage);
        HoldSlotRequest inactivePackageRequest = new HoldSlotRequest(
            doctor.getId(), LocalDate.now(BUSINESS_ZONE).plusDays(3), LocalTime.of(9, 0),
            "Inactive package patient", "0907000196", BOOKING_EMAIL, null,
            specialty.getId(), null, inactivePackage.getId());

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inactivePackageRequest)))
            .andExpect(status().isNotFound());
    }

    @Test
    void holdSlotAndConfirmBookingFlowEndToEnd() throws Exception {
        LocalDate appointmentDate = nextDate(DayOfWeek.MONDAY);
        LocalTime startTime = LocalTime.of(9, 0);

        // 1. Hold Slot
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            appointmentDate,
            startTime,
            "Trần Thị Bệnh Nhân",
            "0901234567",
            "patient.test@example.com",
            "Đau thắt ngực khi vận động",
            specialty.getId(),
            null,
            null,
            true,
            true
        );

        MvcResult holdResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.bookingCode").exists())
            .andExpect(jsonPath("$.otpExpiresAt").exists())
            .andExpect(jsonPath("$.otpRequired").value(true))
            .andReturn();

        assertFalse(holdResult.getResponse().getContentAsString().contains("123456"));
        verify(emailSender).send(
            eq("patient.test@example.com"),
            anyString(),
            contains("123456")
        );

        JsonNode holdNode = objectMapper.readTree(holdResult.getResponse().getContentAsString());
        String bookingCode = holdNode.get("bookingCode").asText();

        // 2. Concurrency Check — Holding the same slot immediately fails with 409 Conflict
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isConflict());

        // 3. Confirm with valid OTP (123456 mock supported in dev/test)
        ConfirmAppointmentRequest confirmRequest = new ConfirmAppointmentRequest(
            bookingCode,
            "123456",
            "Bệnh nhân có tiền sử huyết áp cao"
        );

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(confirmRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bookingCode").value(bookingCode))
            .andExpect(jsonPath("$.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.patientName").value("Trần Thị Bệnh Nhân"))
            .andExpect(jsonPath("$.patientPhone").value("090****567"))
            .andExpect(jsonPath("$.patientEmail").doesNotExist())
            .andExpect(jsonPath("$.hasInsurance").value(true))
            .andExpect(jsonPath("$.privacyConsentAt").exists())
            .andExpect(jsonPath("$.privacyConsentVersion").value("booking-privacy-v1"))
            .andExpect(jsonPath("$.reasonForVisit").doesNotExist());

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConfirmAppointmentRequest(
                    bookingCode,
                    "000000",
                    null
                ))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("Lịch hẹn này đã được xác nhận"));

        // 4. Query appointment details by booking code
        mockMvc.perform(get("/api/v1/appointments/" + bookingCode))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/appointments/" + bookingCode)
                .param("phone", "0901234567"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bookingCode").value(bookingCode))
            .andExpect(jsonPath("$.doctorName").value("BS. CKII Nguyễn Văn An"))
            .andExpect(jsonPath("$.patientPhone").value("090****567"))
            .andExpect(jsonPath("$.reasonForVisit").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.hasInsurance").value(true))
            .andExpect(jsonPath("$.privacyConsentAt").exists())
            .andExpect(jsonPath("$.privacyConsentVersion").value("booking-privacy-v1"))
            .andExpect(jsonPath("$.status").value("CONFIRMED"));

        // 5. Cancel appointment
        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Thay đổi kế hoạch công tác\",\"phone\":\"0901234567\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void slotsRejectInactiveCatalogAndDeduplicateEquivalentScheduleRows() throws Exception {
        Branch branch = createBranchForDoctor("slot-authority");
        LocalDate targetDate = nextDate(DayOfWeek.MONDAY);
        saveSchedule(branch, targetDate, 9, 0, 10, 0, 30);
        saveSchedule(branch, targetDate, 9, 0, 10, 0, 30);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", branch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));

        branch.setActive(false);
        branchRepository.saveAndFlush(branch);
        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", branch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());

        doctor.setActive(false);
        doctorRepository.saveAndFlush(doctor);
        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.plusDays(1).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void holdFailsWhenNoDeliverableEmailIsPresent() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            nextDate(DayOfWeek.MONDAY),
            LocalTime.of(9, 0),
            "Patient Without Email",
            "0907000301",
            null,
            "Missing delivery address",
            specialty.getId(),
            null,
            null
        );

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors[?(@.field == 'email')]").exists());

        assertEquals(0, appointmentRepository.count());
        assertThatPatientWasRolledBack("0907000301");
    }

    @Test
    void holdCommitsBeforeOtpEmailDeliveryFailureIsReported() throws Exception {
        doThrow(new BusinessException(
            503,
            ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE,
            "Email delivery is temporarily unavailable"
        )).when(emailSender).send(anyString(), anyString(), anyString());
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            nextDate(DayOfWeek.MONDAY),
            LocalTime.of(9, 0),
            "Patient With Failed Delivery",
            "0907000302",
            "delivery.failure@example.com",
            "Delivery rollback",
            specialty.getId(),
            null,
            null
        );

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("EMAIL_DELIVERY_UNAVAILABLE"));

        assertEquals(1, appointmentRepository.count());
        assertEquals(
            "delivery.failure@example.com",
            patientProfileRepository.findByPhone("0907000302").orElseThrow().getEmail()
        );
    }

    @Test
    void confirmedAppointmentCanBeRescheduledToAvailableSlot() throws Exception {
        LocalDate originalDate = nextDate(DayOfWeek.MONDAY);
        LocalDate targetDate = nextDate(DayOfWeek.TUESDAY);
        String phone = "0907000201";
        String bookingCode = createConfirmedAppointment(originalDate, LocalTime.of(9, 0), phone);

        RescheduleAppointmentRequest request = new RescheduleAppointmentRequest(
            targetDate,
            LocalTime.of(10, 0),
            null,
            phone
        );

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bookingCode").value(bookingCode))
            .andExpect(jsonPath("$.appointmentDate").value(targetDate.toString()))
            .andExpect(jsonPath("$.startTime").value("10:00:00"))
            .andExpect(jsonPath("$.endTime").value("10:30:00"))
            .andExpect(jsonPath("$.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.patientPhone").value("090****201"))
            .andExpect(jsonPath("$.patientEmail").doesNotExist())
            .andExpect(jsonPath("$.reasonForVisit").doesNotExist());
    }

    @Test
    void rescheduleRejectsDoctorWhoIsNoLongerAcceptingAppointments() throws Exception {
        LocalDate originalDate = nextDate(DayOfWeek.MONDAY);
        LocalDate targetDate = nextDate(DayOfWeek.TUESDAY);
        String phone = "0907000206";
        String bookingCode = createConfirmedAppointment(originalDate, LocalTime.of(9, 0), phone);
        Appointment original = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        LocalTime originalEndTime = original.getEndTime();
        java.time.OffsetDateTime originalAppointmentTime = original.getAppointmentTime();

        doctor.setActive(false);
        doctorRepository.saveAndFlush(doctor);

        RescheduleAppointmentRequest request = new RescheduleAppointmentRequest(
            targetDate,
            LocalTime.of(10, 0),
            null,
            phone
        );

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/appointments/" + bookingCode).param("phone", phone))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.appointmentDate").value(originalDate.toString()))
            .andExpect(jsonPath("$.startTime").value("09:00:00"))
            .andExpect(jsonPath("$.status").value("CONFIRMED"));

        Appointment unchanged = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        assertEquals(originalDate, unchanged.getAppointmentDate());
        assertEquals(LocalTime.of(9, 0), unchanged.getStartTime());
        assertEquals(originalEndTime, unchanged.getEndTime());
        assertEquals(originalAppointmentTime, unchanged.getAppointmentTime());
        assertNull(unchanged.getBranch());
        assertNull(unchanged.getReminderSentAt());
    }

    @Test
    void cannotCancelAppointmentAfterVisitHasStarted() throws Exception {
        String bookingCode = createConfirmedAppointment(
            nextDate(DayOfWeek.MONDAY), LocalTime.of(11, 0), "0907000205");
        Appointment appointment = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        appointment.setStatus(com.healthcare.appointment.entity.AppointmentStatus.CHECKED_IN);
        appointmentRepository.saveAndFlush(appointment);

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Không còn nhu cầu\",\"phone\":\"0907000205\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void failedReschedulePreservesOriginalAppointment() throws Exception {
        LocalDate originalDate = nextDate(DayOfWeek.WEDNESDAY);
        LocalDate occupiedDate = nextDate(DayOfWeek.THURSDAY);
        String originalPhone = "0907000202";
        String originalCode = createConfirmedAppointment(originalDate, LocalTime.of(9, 0), originalPhone);
        createConfirmedAppointment(occupiedDate, LocalTime.of(10, 0), "0907000203");

        RescheduleAppointmentRequest request = new RescheduleAppointmentRequest(
            occupiedDate,
            LocalTime.of(10, 0),
            null,
            originalPhone
        );

        mockMvc.perform(post("/api/v1/appointments/" + originalCode + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/appointments/" + originalCode).param("phone", originalPhone))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.appointmentDate").value(originalDate.toString()))
            .andExpect(jsonPath("$.startTime").value("09:00:00"))
            .andExpect(jsonPath("$.status").value("CONFIRMED"));
    }

    @Test
    void rescheduleRequiresCorrectPhoneProof() throws Exception {
        LocalDate originalDate = nextDate(DayOfWeek.FRIDAY);
        String bookingCode = createConfirmedAppointment(originalDate, LocalTime.of(9, 0), "0907000204");

        RescheduleAppointmentRequest request = new RescheduleAppointmentRequest(
            nextDate(DayOfWeek.SATURDAY),
            LocalTime.of(10, 0),
            null,
            "0900000000"
        );

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void lookupRejectsWrongPhoneProof() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            nextDate(DayOfWeek.MONDAY),
            LocalTime.of(11, 0),
            "Người Dùng Bảo Mật",
            "0912345678",
            BOOKING_EMAIL,
            "Kiểm tra sức khỏe",
            specialty.getId(),
            null,
            null
        );

        MvcResult holdResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isCreated())
            .andReturn();
        String bookingCode = objectMapper.readTree(holdResult.getResponse().getContentAsString())
            .get("bookingCode").asText();

        mockMvc.perform(get("/api/v1/appointments/" + bookingCode)
                .param("phone", "0900000000"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void confirmAppointmentFailsWithInvalidOtp() throws Exception {
        LocalDate appointmentDate = nextDate(DayOfWeek.MONDAY);
        LocalTime startTime = LocalTime.of(10, 0);

        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            appointmentDate,
            startTime,
            "Lê Văn Thử Nghiệm",
            "0987654321",
            BOOKING_EMAIL,
            "Khám tổng quát",
            specialty.getId(),
            null,
            null
        );

        MvcResult holdResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isCreated())
            .andReturn();

        JsonNode holdNode = objectMapper.readTree(holdResult.getResponse().getContentAsString());
        String bookingCode = holdNode.get("bookingCode").asText();

        ConfirmAppointmentRequest invalidConfirm = new ConfirmAppointmentRequest(
            bookingCode,
            "000000",
            null
        );

        for (int attempt = 1; attempt <= 4; attempt++) {
            mockMvc.perform(post("/api/v1/appointments/confirm")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(invalidConfirm)))
                .andExpect(status().isBadRequest());
        }

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidConfirm)))
            .andExpect(status().isTooManyRequests());

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConfirmAppointmentRequest(
                    bookingCode,
                    "123456",
                    null
                ))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void holdRejectsSlotOutsideDoctorSchedule() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            LocalDate.now(BUSINESS_ZONE).plusDays(8),
            LocalTime.of(12, 0),
            "Slot Ngoài Lịch",
            "0905552222",
            null,
            "Không được đặt giờ nghỉ trưa",
            specialty.getId(),
            null,
            null
        );

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void persistedScheduleUsesIsoDayAndEffectiveWindowWithoutDefaultBypass() throws Exception {
        Branch branch = createBranchForDoctor("effective");
        LocalDate firstDate = nextDate(DayOfWeek.MONDAY);
        LocalDate effectiveDate = firstDate.plusWeeks(1);
        DoctorSchedule persisted = saveSchedule(branch, effectiveDate, 9, 0, 11, 0, 30);
        persisted.setEffectiveTo(effectiveDate);
        doctorScheduleRepository.saveAndFlush(persisted);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", firstDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", effectiveDate.plusDays(1).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", effectiveDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(4))
            .andExpect(jsonPath("$[0].startTime").value("09:00:00"))
            .andExpect(jsonPath("$[0].endTime").value("09:30:00"));
    }

    @Test
    void customHoursExceptionReplacesPersistedBranchSchedule() throws Exception {
        Branch branch = createBranchForDoctor("custom-hours");
        LocalDate targetDate = nextDate(DayOfWeek.WEDNESDAY);
        saveSchedule(branch, targetDate, 8, 0, 12, 0, 30);

        DoctorScheduleException exception = new DoctorScheduleException();
        exception.setDoctor(doctor);
        exception.setBranch(branch);
        exception.setExceptionDate(targetDate);
        exception.setType("CUSTOM_HOURS");
        exception.setCustomStartTime(LocalTime.of(14, 0));
        exception.setCustomEndTime(LocalTime.of(15, 0));
        doctorScheduleExceptionRepository.saveAndFlush(exception);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].startTime").value("14:00:00"));
    }

    @Test
    void blockedExceptionRemovesAllSlotsForTheBranchDate() throws Exception {
        Branch branch = createBranchForDoctor("blocked");
        LocalDate targetDate = nextDate(DayOfWeek.SATURDAY);
        saveSchedule(branch, targetDate, 8, 0, 12, 0, 30);

        DoctorScheduleException exception = new DoctorScheduleException();
        exception.setDoctor(doctor);
        exception.setBranch(branch);
        exception.setExceptionDate(targetDate);
        exception.setType("BLOCKED");
        doctorScheduleExceptionRepository.saveAndFlush(exception);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void bookingUsesConfiguredDurationAndRejectsOverlappingDifferentStart() throws Exception {
        Branch branch = createBranchForDoctor("interval");
        LocalDate targetDate = nextDate(DayOfWeek.THURSDAY);
        saveSchedule(branch, targetDate, 9, 0, 11, 0, 60);
        saveSchedule(branch, targetDate, 9, 30, 10, 30, 30);

        HoldSlotRequest first = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0), "Người Đặt Một", "0907000001", BOOKING_EMAIL,
            "Slot 60 phút", specialty.getId(), branch.getId(), null);
        MvcResult firstResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(first)))
            .andExpect(status().isCreated())
            .andReturn();
        String firstCode = objectMapper.readTree(firstResult.getResponse().getContentAsString())
            .get("bookingCode").asText();

        mockMvc.perform(get("/api/v1/appointments/" + firstCode).param("phone", "0907000001"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.startTime").value("09:00:00"))
            .andExpect(jsonPath("$.endTime").value("10:00:00"));

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].available").value(false))
            .andExpect(jsonPath("$[2].startTime").value("09:30:00"))
            .andExpect(jsonPath("$[2].available").value(false));

        HoldSlotRequest overlapping = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30), "Người Đặt Hai", "0907000002", BOOKING_EMAIL,
            "Slot chồng lấn", specialty.getId(), branch.getId(), null);
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overlapping)))
            .andExpect(status().isConflict());
    }

    @Test
    void optionalReferencesRejectMissingResourcesAndUnassignedBranch() throws Exception {
        LocalDate targetDate = nextDate(DayOfWeek.FRIDAY).plusWeeks(1);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HoldSlotRequest(
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Thiếu chuyên khoa", "0907000011", BOOKING_EMAIL,
                    null, UUID.randomUUID(), null, null))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Không tìm thấy chuyên khoa"));

        UUID missingBranchId = UUID.randomUUID();
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HoldSlotRequest(
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Thiếu cơ sở", "0907000012", BOOKING_EMAIL,
                    null, specialty.getId(), missingBranchId, null))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Không tìm thấy cơ sở khám"));

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HoldSlotRequest(
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Thiếu gói", "0907000013", BOOKING_EMAIL,
                    null, specialty.getId(), null, UUID.randomUUID()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Không tìm thấy gói khám"));

        Branch unassigned = new Branch();
        unassigned.setName("Unassigned branch");
        unassigned.setSlug("unassigned-" + UUID.randomUUID());
        unassigned.setAddress("Test address");
        unassigned.setActive(true);
        branchRepository.saveAndFlush(unassigned);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HoldSlotRequest(
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Sai liên kết", "0907000014", BOOKING_EMAIL,
                    null, specialty.getId(), unassigned.getId(), null))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Bác sĩ không làm việc tại cơ sở khám đã chọn"));
    }

    @Test
    void malformedHoldPayloadReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"doctorId\":\"" + doctor.getId() + "\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void authenticatedUserCannotClaimUnlinkedPatientByPhone() throws Exception {
        PatientProfile legacyProfile = new PatientProfile();
        legacyProfile.setFullName("Hồ Sơ Chưa Liên Kết");
        legacyProfile.setPhone("0905550000");
        patientProfileRepository.saveAndFlush(legacyProfile);

        Branch branch = createBranchForDoctor("unlinked-patient");
        LocalDate appointmentDate = LocalDate.now(BUSINESS_ZONE).plusDays(8);
        saveSchedule(branch, appointmentDate, 13, 0, 14, 0, 30);

        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            appointmentDate,
            LocalTime.of(13, 30),
            "Tài Khoản Mới",
            "0905550000",
            BOOKING_EMAIL,
            "Không được tự nhận hồ sơ cũ",
            specialty.getId(),
            branch.getId(),
            null
        );

        mockMvc.perform(post("/api/v1/appointments/hold")
                .header("Authorization", patientToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isForbidden());
    }

    @Test
    void publicHoldCannotReusePhoneOwnedProfileWithAnAttackerEmail() throws Exception {
        User victimOwner = createVerifiedUser("victim.booking@example.com", "Victim Account");
        PatientProfile victimProfile = new PatientProfile();
        victimProfile.setFullName("Victim Private Name");
        victimProfile.setPhone("0905550200");
        victimProfile.setEmail(victimOwner.getEmail());
        victimProfile.setUserId(victimOwner.getId());
        patientProfileRepository.saveAndFlush(victimProfile);

        Branch branch = createBranchForDoctor("booking-owner-abuse");
        LocalDate appointmentDate = nextDate(DayOfWeek.WEDNESDAY);
        saveSchedule(branch, appointmentDate, 15, 0, 16, 0, 30);

        HoldSlotRequest attack = new HoldSlotRequest(
            doctor.getId(),
            appointmentDate,
            LocalTime.of(15, 0),
            "Attacker Supplied Name",
            victimProfile.getPhone(),
            "attacker.booking@example.com",
            "Attempt to attach to another patient's profile",
            specialty.getId(),
            branch.getId(),
            null
        );

        MvcResult result = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(attack)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Không thể xác minh thông tin bệnh nhân"))
            .andReturn();

        assertFalse(result.getResponse().getContentAsString().contains(victimProfile.getFullName()));
        assertEquals(0, appointmentRepository.count());
        assertEquals(
            "Victim Private Name",
            patientProfileRepository.findById(victimProfile.getId()).orElseThrow().getFullName()
        );
        verify(emailSender, never()).send(eq("attacker.booking@example.com"), anyString(), anyString());
    }

    @Test
    void publicHoldWithMatchingEmailSendsOtpToStoredVerifiedDestination() throws Exception {
        User owner = createVerifiedUser("stored.booking@example.com", "Stored Destination Owner");
        PatientProfile profile = new PatientProfile();
        profile.setFullName("Stored Profile Name");
        profile.setPhone("0905550201");
        profile.setEmail(owner.getEmail());
        profile.setUserId(owner.getId());
        patientProfileRepository.saveAndFlush(profile);

        Branch branch = createBranchForDoctor("booking-owner-match");
        LocalDate appointmentDate = nextDate(DayOfWeek.THURSDAY);
        saveSchedule(branch, appointmentDate, 15, 0, 16, 0, 30);

        HoldSlotRequest request = new HoldSlotRequest(
            doctor.getId(),
            appointmentDate,
            LocalTime.of(15, 30),
            "Request Name Is Not Trusted",
            profile.getPhone(),
            "STORED.BOOKING@EXAMPLE.COM",
            "Verify stored destination binding",
            specialty.getId(),
            branch.getId(),
            null
        );

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated());

        verify(emailSender).send(eq(owner.getEmail()), anyString(), anyString());
        assertEquals(
            "Stored Profile Name",
            patientProfileRepository.findById(profile.getId()).orElseThrow().getFullName()
        );
    }

    @Test
    void concurrentHoldsForOneSlotAllowOnlyOneReservation() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            nextDate(DayOfWeek.MONDAY),
            LocalTime.of(14, 0),
            "Người Đặt Đồng Thời",
            "0905551111",
            BOOKING_EMAIL,
            "Kiểm tra tranh chấp slot",
            specialty.getId(),
            null,
            null
        );
        String body = objectMapper.writeValueAsString(holdRequest);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<MvcResult> first = executor.submit(() -> performHoldAfter(release, body));
            Future<MvcResult> second = executor.submit(() -> performHoldAfter(release, body));
            release.countDown();

            MvcResult firstResult = first.get(15, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(15, TimeUnit.SECONDS);
            int firstStatus = firstResult.getResponse().getStatus();
            int secondStatus = secondResult.getResponse().getStatus();
            String diagnostics = "first=" + describeHoldAttempt(firstResult)
                + ", second=" + describeHoldAttempt(secondResult);
            assertEquals(1, (firstStatus == 201 ? 1 : 0) + (secondStatus == 201 ? 1 : 0), diagnostics);
            assertEquals(1, (firstStatus == 409 ? 1 : 0) + (secondStatus == 409 ? 1 : 0), diagnostics);
        } finally {
            executor.shutdownNow();
        }
    }

    private MvcResult performHoldAfter(CountDownLatch release, String body) throws Exception {
        release.await(5, TimeUnit.SECONDS);
        return mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andReturn();
    }

    private String describeHoldAttempt(MvcResult result) throws Exception {
        Exception resolvedException = result.getResolvedException();
        return "status=" + result.getResponse().getStatus()
            + ", body=" + result.getResponse().getContentAsString()
            + ", exception=" + (resolvedException == null
                ? "none"
                : resolvedException.getClass().getSimpleName() + ": " + resolvedException.getMessage());
    }

    private void assertThatPatientWasRolledBack(String phone) {
        assertFalse(patientProfileRepository.findByPhone(phone).isPresent());
    }

    private String createConfirmedAppointment(LocalDate date, LocalTime startTime, String phone) throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            date,
            startTime,
            "Bệnh Nhân Đổi Lịch",
            phone,
            BOOKING_EMAIL,
            "Kiểm tra tính năng đổi lịch",
            specialty.getId(),
            null,
            null
        );
        MvcResult holdResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isCreated())
            .andReturn();
        String bookingCode = objectMapper.readTree(holdResult.getResponse().getContentAsString())
            .get("bookingCode").asText();

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConfirmAppointmentRequest(
                    bookingCode,
                    "123456",
                    null
                ))))
            .andExpect(status().isOk());
        return bookingCode;
    }

    private String patientToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "appointment.patient.%s@healthcare.local",
                      "password": "NotUsed!123",
                      "displayName": "Appointment Patient"
                    }
                    """.formatted(java.util.UUID.randomUUID())))
            .andExpect(status().isAccepted())
            .andReturn();
        String email = objectMapper.readTree(result.getResponse().getContentAsString()).get("email").asText();
        var user = userRepository.findByEmail(email).orElseThrow();
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(java.time.OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private User createVerifiedUser(String email, String displayName) {
        OffsetDateTime now = OffsetDateTime.now();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("not-used-by-booking-test");
        user.setDisplayName(displayName);
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.saveAndFlush(user);
    }

    private Branch createBranchForDoctor(String label) {
        Branch branch = new Branch();
        branch.setName("Test branch " + label);
        branch.setSlug("test-branch-" + label + "-" + UUID.randomUUID());
        branch.setAddress("Test address");
        branch.setActive(true);
        branch = branchRepository.saveAndFlush(branch);

        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
        return branch;
    }

    private DoctorSchedule saveSchedule(
            Branch branch,
            LocalDate date,
            int startHour,
            int startMinute,
            int endHour,
            int endMinute,
            int duration) {
        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setDoctor(doctor);
        schedule.setBranch(branch);
        schedule.setDayOfWeek(date.getDayOfWeek().getValue());
        schedule.setStartTime(LocalTime.of(startHour, startMinute));
        schedule.setEndTime(LocalTime.of(endHour, endMinute));
        schedule.setSlotDurationMinutes(duration);
        schedule.setEffectiveFrom(date);
        schedule.setActive(true);
        return doctorScheduleRepository.saveAndFlush(schedule);
    }

    private LocalDate nextDate(DayOfWeek dayOfWeek) {
        LocalDate date = LocalDate.now(BUSINESS_ZONE).plusDays(1);
        while (date.getDayOfWeek() != dayOfWeek) {
            date = date.plusDays(1);
        }
        return date;
    }
}
