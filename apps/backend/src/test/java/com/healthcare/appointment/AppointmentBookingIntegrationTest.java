package com.healthcare.appointment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.RescheduleAppointmentRequest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
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
import com.healthcare.payment.entity.PaymentStatus;
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
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
    /** Standard hospital windows persisted for the test doctor (see {@link #setUpTestData()}). */
    private static final LocalTime MORNING_WINDOW_START = LocalTime.of(8, 0);
    private static final LocalTime MORNING_WINDOW_END = LocalTime.of(12, 0);
    private static final LocalTime AFTERNOON_WINDOW_START = LocalTime.of(13, 30);
    private static final LocalTime AFTERNOON_WINDOW_END = LocalTime.of(17, 30);
    private static final int SLOT_DURATION_MINUTES = 30;

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
    /**
     * Branch the test doctor is scheduled at. The hold contract requires an
     * explicit branch, and schedules are the availability authority, so every
     * hold/reschedule below books this branch unless the test builds its own.
     */
    private Branch defaultBranch;
    /** True once a test persisted its own windows and dropped the default ones. */
    private boolean defaultSchedulesReplaced;

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

        // A doctor is bookable only where an active doctor_schedules row covers
        // the requested weekday and date; the test profile never enables the
        // local demo fallback, so the suite must persist the standard hospital
        // hours it asserts on. The weekly rows cover every ISO weekday because
        // the suite books dates derived from "today".
        defaultBranch = createBranchForDoctor("default");
        saveWeeklySchedule(defaultBranch, MORNING_WINDOW_START, MORNING_WINDOW_END, SLOT_DURATION_MINUTES);
        saveWeeklySchedule(defaultBranch, AFTERNOON_WINDOW_START, AFTERNOON_WINDOW_END, SLOT_DURATION_MINUTES);
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
            unrelated.getId(), defaultBranch.getId(), null);

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
                      "branchId": "%s",
                      "privacyConsent": false
                    }
                    """.formatted(doctor.getId(), appointmentDate, specialty.getId(), defaultBranch.getId())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors[?(@.field == 'privacyConsent')]").exists());
    }

    @Test
    void getDoctorSlotsReturnsCalculatedTimeSlots() throws Exception {
        LocalDate targetDate = nextDate(DayOfWeek.MONDAY);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
            .andExpect(jsonPath("$").isArray())
            // 08:00-12:00 and 13:30-17:30 in 30-minute steps.
            .andExpect(jsonPath("$.length()").value(16))
            .andExpect(jsonPath("$[0].startTime").value("08:00:00"))
            .andExpect(jsonPath("$[0].endTime").value("08:30:00"))
            .andExpect(jsonPath("$[0].branchId").value(defaultBranch.getId().toString()))
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
    void sameDoctorCannotHoldTheSameSlotAtTwoBranches() throws Exception {
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
        // The V11 exclusion constraint is branch-scoped, so it alone would allow
        // this second hold. The doctor-level overlap guard is the authority that
        // keeps one physician from holding the same clock time at two branches.
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchBHold)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("cơ sở khác")));
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchAHold)))
            .andExpect(status().isConflict());
        assertEquals(1, appointmentRepository.count());
    }

    @Test
    void branchScopedOverlapGuardRejectsSameBranchAndCrossBranchOverlapsOnly() throws Exception {
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
        HoldSlotRequest secondBranchAHold = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30),
            "Interval A second patient", "0907000113", "interval-a-2@example.com", "Branch A overlap",
            specialty.getId(), branchA.getId(), null);
        HoldSlotRequest branchBOverlap = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30),
            "Interval B patient", "0907000112", "interval-b@example.com", "Branch B overlap",
            specialty.getId(), branchB.getId(), null);
        HoldSlotRequest branchBFree = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(10, 0),
            "Interval B second patient", "0907000114", "interval-b-2@example.com", "Branch B free",
            specialty.getId(), branchB.getId(), null);

        // Occupies 09:00-10:00 at branch A.
        holdSlot(firstBranchAHold);
        // Same branch, overlapping interval → branch-scoped conflict.
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(secondBranchAHold)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Khung giờ khám này")));
        // Other branch, overlapping the same physician's live hold → doctor-level conflict.
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branchBOverlap)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("cơ sở khác")));
        // Other branch, interval starts exactly when the live hold ends → allowed.
        String branchBFreeCode = holdSlot(branchBFree);
        assertEquals(
            branchB.getId(),
            appointmentRepository.findByBookingCode(branchBFreeCode).orElseThrow().getBranch().getId()
        );
    }

    @Test
    void branchWithoutPersistedScheduleIsClosedAndNeverBorrowsAnotherBranchesSlots() throws Exception {
        Branch branch = createBranchForDoctor("own-profile");
        LocalDate targetDate = nextDate(DayOfWeek.TUESDAY);

        // Schedules are the availability authority. The doctor's weekly hours at
        // the default branch are NOT a fallback for another branch, and the local
        // demo windows are disabled in the test profile, so this branch is closed.
        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", branch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());

        saveSchedule(branch, targetDate, 9, 0, 10, 0, SLOT_DURATION_MINUTES);

        org.springframework.test.web.servlet.MvcResult slotsResult = mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString())
                .param("branchId", branch.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andReturn();
        com.fasterxml.jackson.databind.JsonNode slots = objectMapper.readTree(
            slotsResult.getResponse().getContentAsString());
        for (com.fasterxml.jackson.databind.JsonNode slot : slots) {
            assertEquals(branch.getId().toString(), slot.get("branchId").asText());
        }

        HoldSlotRequest request = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0),
            "Đặt lịch qua khung giờ chuẩn", "0907000099", BOOKING_EMAIL, null,
            specialty.getId(), branch.getId(), null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated());
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
            inactive.getId(), defaultBranch.getId(), null);

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
            otherActive.getId(), defaultBranch.getId(), null);

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
            specialty.getId(), defaultBranch.getId(), inactivePackage.getId());

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
            defaultBranch.getId(),
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
            defaultBranch.getId(),
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
            defaultBranch.getId(),
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
            defaultBranch.getId(),
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
            defaultBranch.getId(),
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
        // A rejected reschedule must not move the booking, so the branch stays
        // the one the hold was created at (branchless rows are no longer valid).
        assertEquals(defaultBranch.getId(), unchanged.getBranch().getId());
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
            defaultBranch.getId(),
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
            defaultBranch.getId(),
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
            defaultBranch.getId(),
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
    void otpExhaustionLocksTheChallengeUntilOtpIsResent() throws Exception {
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
            defaultBranch.getId(),
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

        // The fifth wrong code locks the challenge: 400, not 429, and the
        // booking must survive — no self-cancellation on a typo storm.
        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidConfirm)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("quá 5 lần")));

        Appointment locked = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        assertEquals(AppointmentStatus.PENDING_CONFIRMATION, locked.getStatus());
        assertEquals(5, locked.getOtpAttempts());
        assertNull(locked.getCancellationReason());

        // A locked challenge rejects even the correct code until a resend.
        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConfirmAppointmentRequest(
                    bookingCode,
                    "123456",
                    null
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("quá 5 lần")));

        // The resend cooldown keys on the issued timestamp; rewind it so the
        // recovery path is exercised without sleeping.
        jdbcTemplate.update(
            "update appointments set otp_issued_at = otp_issued_at - interval '5 minutes' where booking_code = ?",
            bookingCode);
        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/otp/resend")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"0987654321\"}"))
            .andExpect(status().isAccepted());

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConfirmAppointmentRequest(
                    bookingCode,
                    "123456",
                    null
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CONFIRMED"));
    }

    @Test
    void adminCancelOfPaidAppointmentArmsRefund() throws Exception {
        User admin = createUserWithRole("ADMIN", "admin.cancel." + UUID.randomUUID() + "@example.com");
        String bookingCode = createConfirmedAppointment(
            nextDate(DayOfWeek.MONDAY), LocalTime.of(9, 0), "0907000221");
        Appointment appointment = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        markPaymentPaid(appointment.getId());

        mockMvc.perform(post("/api/v1/admin/appointments/{id}/status", appointment.getId())
                .header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CANCELLED\",\"reason\":\"Bệnh nhân gọi điện hủy\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertEquals(PaymentStatus.REFUND_PENDING,
            bankTransferPaymentRepository.findByAppointmentId(appointment.getId()).orElseThrow().getStatus());
        assertEquals("REFUND_PENDING",
            appointmentRepository.findById(appointment.getId()).orElseThrow().getPaymentStatus());
    }

    @Test
    void adminCancelOfUnpaidAppointmentIsUnaffectedByThePaymentHook() throws Exception {
        User admin = createUserWithRole("ADMIN", "admin.cancel.unpaid." + UUID.randomUUID() + "@example.com");
        String bookingCode = createConfirmedAppointment(
            nextDate(DayOfWeek.WEDNESDAY), LocalTime.of(9, 30), "0907000225");
        Appointment appointment = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();

        mockMvc.perform(post("/api/v1/admin/appointments/{id}/status", appointment.getId())
                .header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CANCELLED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"))
            .andExpect(jsonPath("$.paymentStatus").value("UNPAID"));
    }

    @Test
    void patientCancelIsRefusedOnceTheSlotHasPassed() throws Exception {
        String phone = "0907000222";
        String bookingCode = createConfirmedAppointment(
            nextDate(DayOfWeek.MONDAY), LocalTime.of(9, 0), phone);
        Appointment appointment = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        markPaymentPaid(appointment.getId());
        // The visit window closed yesterday: a past slot cannot be self-cancelled,
        // only the clinic (admin cancel path) may call it off.
        jdbcTemplate.update(
            "update appointments set appointment_date = CURRENT_DATE - 1 where booking_code = ?", bookingCode);

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Quên lịch\",\"phone\":\"" + phone + "\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("đã qua giờ hẹn")));

        Appointment unchanged = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        assertEquals(AppointmentStatus.CONFIRMED, unchanged.getStatus());
        assertEquals(PaymentStatus.PAID,
            bankTransferPaymentRepository.findByAppointmentId(unchanged.getId()).orElseThrow().getStatus());
    }

    @Test
    void patientCancelOfFuturePaidAppointmentArmsRefund() throws Exception {
        String phone = "0907000223";
        String bookingCode = createConfirmedAppointment(
            nextDate(DayOfWeek.TUESDAY), LocalTime.of(9, 30), phone);
        Appointment appointment = appointmentRepository.findByBookingCode(bookingCode).orElseThrow();
        markPaymentPaid(appointment.getId());

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Thay đổi kế hoạch\",\"phone\":\"" + phone + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"))
            .andExpect(jsonPath("$.paymentStatus").value("REFUND_PENDING"));

        assertEquals(PaymentStatus.REFUND_PENDING,
            bankTransferPaymentRepository.findByAppointmentId(appointment.getId()).orElseThrow().getStatus());
    }

    @Test
    void rescheduleNotifiesTheAssignedDoctor() throws Exception {
        User doctorUser = createUserWithRole("DOCTOR", "reschedule.doctor." + UUID.randomUUID() + "@example.com");
        doctor.setUserId(doctorUser.getId());
        doctorRepository.saveAndFlush(doctor);
        String phone = "0907000224";
        String bookingCode = createConfirmedAppointment(
            nextDate(DayOfWeek.MONDAY), LocalTime.of(9, 0), phone);

        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RescheduleAppointmentRequest(
                    nextDate(DayOfWeek.TUESDAY),
                    LocalTime.of(10, 0),
                    defaultBranch.getId(),
                    phone))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CONFIRMED"));

        List<String> doctorMessages = jdbcTemplate.queryForList(
            "select message from notifications where user_id = ? and event_type = 'APPOINTMENT_RESCHEDULED'",
            String.class, doctorUser.getId());
        assertEquals(1, doctorMessages.size());
        assertTrue(doctorMessages.get(0).contains(bookingCode));
    }

    @Test
    void holdRejectsSlotOutsideDoctorSchedule() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            LocalDate.now(BUSINESS_ZONE).plusDays(8),
            LocalTime.of(12, 0),
            "Slot Ngoài Lịch",
            "0905552222",
            BOOKING_EMAIL,
            "Không được đặt giờ nghỉ trưa",
            specialty.getId(),
            defaultBranch.getId(),
            null
        );

        // 12:00 falls in the lunch break of the persisted weekly clinic
        // (08:00-12:00 / 13:30-17:30), so it is not a bookable slot start.
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("Khung giờ không nằm trong lịch làm việc")));
    }

    @Test
    void persistedScheduleUsesIsoDayAndEffectiveWindowWithoutDefaultBypass() throws Exception {
        Branch branch = createBranchForDoctor("effective");
        LocalDate firstDate = nextDate(DayOfWeek.MONDAY);
        LocalDate effectiveDate = firstDate.plusWeeks(1);
        DoctorSchedule persisted = saveSchedule(branch, effectiveDate, 9, 0, 11, 0, 30);
        persisted.setEffectiveTo(effectiveDate);
        doctorScheduleRepository.saveAndFlush(persisted);

        // Before effectiveFrom, the recurring row does not apply and there is no
        // default/demo window to fall back on: the day is closed.
        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", firstDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$").isEmpty());

        // Past effectiveTo (and on a different ISO weekday) the day is closed again.
        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", effectiveDate.plusDays(1).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());

        // Inside the effective range the persisted window is the only authority.
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
                    null, UUID.randomUUID(), defaultBranch.getId(), null))))
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
                    null, specialty.getId(), defaultBranch.getId(), UUID.randomUUID()))))
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
            .andExpect(status().isBadRequest())
            // The branch is a required hold field, not an optional refinement:
            // without it the composite (doctor, branch) invariant cannot hold.
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors[?(@.field == 'branchId')]").exists());
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
            defaultBranch.getId(),
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
        return confirmHold(holdSlot(new HoldSlotRequest(
            doctor.getId(),
            date,
            startTime,
            "Bệnh Nhân Đổi Lịch",
            phone,
            BOOKING_EMAIL,
            "Kiểm tra tính năng đổi lịch",
            specialty.getId(),
            defaultBranch.getId(),
            null
        )));
    }

    /**
     * Holds the slot described by {@code request} and returns its booking code.
     */
    private String holdSlot(HoldSlotRequest request) throws Exception {
        MvcResult holdResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andReturn();
        return objectMapper.readTree(holdResult.getResponse().getContentAsString())
            .get("bookingCode").asText();
    }

    private String confirmHold(String bookingCode) throws Exception {
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

    /**
     * Persists the payment row the hold initialized and stamps the appointment's
     * coarse payment state, so cancellation refund assertions start from PAID.
     */
    private void markPaymentPaid(java.util.UUID appointmentId) {
        assertEquals(1, jdbcTemplate.update(
            "update bank_transfer_payments set status = 'PAID', transaction_reference = 'REF-PAID-TEST', "
                + "submitted_at = now(), verified_at = now() where appointment_id = ?", appointmentId));
        assertEquals(1, jdbcTemplate.update(
            "update appointments set payment_status = 'PAID' where id = ?", appointmentId));
    }

    private User createUserWithRole(String roleCode, String email) {
        // Flyway seeds the role rows and the per-test cleanup leaves them intact.
        // The class is not @Transactional, so a loaded Role is detached before
        // the user is persisted; the membership is written through the join
        // table instead of the PERSIST cascade on User.roles.
        UUID roleId = jdbcTemplate.queryForObject(
            "select id from roles where code = ?", UUID.class, roleCode);
        OffsetDateTime now = OffsetDateTime.now();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("not-used-by-booking-test");
        user.setDisplayName(roleCode + " Booking Test");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.saveAndFlush(user);
        jdbcTemplate.update("insert into user_roles (user_id, role_id) values (?, ?)", user.getId(), roleId);
        return user;
    }

    private String bearer(User user) {
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
        // The first explicitly persisted window of a test replaces the default
        // weekly clinic hours, so slot counts never mix two schedule
        // authorities. Later calls in the same test only add rows.
        if (!defaultSchedulesReplaced) {
            deactivateDefaultSchedules();
            defaultSchedulesReplaced = true;
        }
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

    /**
     * Persists the given window for every ISO weekday so any date the suite
     * derives from "today" is covered. The range starts in the past and never
     * ends, matching the recurring weekly clinic a real doctor would have.
     */
    private void saveWeeklySchedule(
            Branch branch,
            LocalTime windowStart,
            LocalTime windowEnd,
            int duration) {
        LocalDate effectiveFrom = LocalDate.now(BUSINESS_ZONE).minusDays(14);
        for (int isoDayOfWeek = 1; isoDayOfWeek <= 7; isoDayOfWeek++) {
            DoctorSchedule schedule = new DoctorSchedule();
            schedule.setDoctor(doctor);
            schedule.setBranch(branch);
            schedule.setDayOfWeek(isoDayOfWeek);
            schedule.setStartTime(windowStart);
            schedule.setEndTime(windowEnd);
            schedule.setSlotDurationMinutes(duration);
            schedule.setEffectiveFrom(effectiveFrom);
            schedule.setActive(true);
            doctorScheduleRepository.saveAndFlush(schedule);
        }
    }

    private void deactivateDefaultSchedules() {
        // The integration test base runs without a surrounding transaction, so
        // the loaded rows are detached: the change has to be saved explicitly.
        var defaultSchedules = doctorScheduleRepository.findByDoctorIdAndActiveTrue(doctor.getId());
        defaultSchedules.forEach(schedule -> schedule.setActive(false));
        doctorScheduleRepository.saveAllAndFlush(defaultSchedules);
    }

    private LocalDate nextDate(DayOfWeek dayOfWeek) {
        LocalDate date = LocalDate.now(BUSINESS_ZONE).plusDays(1);
        while (date.getDayOfWeek() != dayOfWeek) {
            date = date.plusDays(1);
        }
        return date;
    }
}
