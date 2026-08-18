package com.healthcare.appointment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.RescheduleAppointmentRequest;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AppointmentBookingIntegrationTest extends TestcontainersIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    private Doctor doctor;
    private Specialty specialty;

    @BeforeEach
    void setUpTestData() {
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
            doctor.getId(), LocalDate.now().plusDays(2), LocalTime.of(9, 0),
            "Bệnh nhân kiểm thử", "0907000199", null, "Kiểm thử invariant",
            unrelated.getId(), null, null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getDoctorSlotsReturnsCalculatedTimeSlots() throws Exception {
        LocalDate targetDate = LocalDate.now().plusDays(2);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
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
            "Branch A patient", "0907000101", null, "Branch A hold",
            specialty.getId(), branchA.getId(), null);
        HoldSlotRequest branchBHold = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 0),
            "Branch B patient", "0907000102", null, "Branch B hold",
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
            "Interval A patient", "0907000111", null, "Branch A interval",
            specialty.getId(), branchA.getId(), null);
        HoldSlotRequest branchBOverlap = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30),
            "Interval B patient", "0907000112", null, "Branch B overlap",
            specialty.getId(), branchB.getId(), null);
        HoldSlotRequest branchAOverlap = new HoldSlotRequest(
            doctor.getId(), targetDate, LocalTime.of(9, 30),
            "Interval A second patient", "0907000113", null, "Branch A overlap",
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
            "Không đặt qua fallback", "0907000099", null, null,
            specialty.getId(), branch.getId(), null);

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void holdSlotAndConfirmBookingFlowEndToEnd() throws Exception {
        LocalDate appointmentDate = LocalDate.now().plusDays(3);
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
            null
        );

        MvcResult holdResult = mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.bookingCode").exists())
            .andExpect(jsonPath("$.otpRequired").value(true))
            .andReturn();

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
            .andExpect(jsonPath("$.patientName").value("Trần Thị Bệnh Nhân"));

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
            .andExpect(jsonPath("$.status").value("CONFIRMED"));

        // 5. Cancel appointment
        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Thay đổi kế hoạch công tác\",\"phone\":\"0901234567\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
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
            .andExpect(jsonPath("$.status").value("CONFIRMED"));
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
            null,
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
        LocalDate appointmentDate = LocalDate.now().plusDays(4);
        LocalTime startTime = LocalTime.of(10, 0);

        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            appointmentDate,
            startTime,
            "Lê Văn Thử Nghiệm",
            "0987654321",
            null,
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
            LocalDate.now().plusDays(8),
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
            doctor.getId(), targetDate, LocalTime.of(9, 0), "Người Đặt Một", "0907000001", null,
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
            doctor.getId(), targetDate, LocalTime.of(9, 30), "Người Đặt Hai", "0907000002", null,
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
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Thiếu chuyên khoa", "0907000011", null,
                    null, UUID.randomUUID(), null, null))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Không tìm thấy chuyên khoa"));

        UUID missingBranchId = UUID.randomUUID();
        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HoldSlotRequest(
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Thiếu cơ sở", "0907000012", null,
                    null, specialty.getId(), missingBranchId, null))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Không tìm thấy cơ sở khám"));

        mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HoldSlotRequest(
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Thiếu gói", "0907000013", null,
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
                    doctor.getId(), targetDate, LocalTime.of(9, 0), "Sai liên kết", "0907000014", null,
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

        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            LocalDate.now().plusDays(8),
            LocalTime.of(13, 30),
            "Tài Khoản Mới",
            "0905550000",
            null,
            "Không được tự nhận hồ sơ cũ",
            specialty.getId(),
            null,
            null
        );

        mockMvc.perform(post("/api/v1/appointments/hold")
                .header("Authorization", patientToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdRequest)))
            .andExpect(status().isForbidden());
    }

    @Test
    void concurrentHoldsForOneSlotAllowOnlyOneReservation() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            LocalDate.now().plusDays(7),
            LocalTime.of(14, 0),
            "Người Đặt Đồng Thời",
            "0905551111",
            null,
            "Kiểm tra tranh chấp slot",
            specialty.getId(),
            null,
            null
        );
        String body = objectMapper.writeValueAsString(holdRequest);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<Integer> first = executor.submit(() -> performHoldAfter(release, body));
            Future<Integer> second = executor.submit(() -> performHoldAfter(release, body));
            release.countDown();

            int firstStatus = first.get(15, TimeUnit.SECONDS);
            int secondStatus = second.get(15, TimeUnit.SECONDS);
            assertEquals(1, (firstStatus == 201 ? 1 : 0) + (secondStatus == 201 ? 1 : 0));
            assertEquals(1, (firstStatus == 409 ? 1 : 0) + (secondStatus == 409 ? 1 : 0));
        } finally {
            executor.shutdownNow();
        }
    }

    private int performHoldAfter(CountDownLatch release, String body) throws Exception {
        release.await(5, TimeUnit.SECONDS);
        return mockMvc.perform(post("/api/v1/appointments/hold")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andReturn()
            .getResponse()
            .getStatus();
    }

    private String createConfirmedAppointment(LocalDate date, LocalTime startTime, String phone) throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            date,
            startTime,
            "Bệnh Nhân Đổi Lịch",
            phone,
            null,
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
            .andExpect(status().isOk())
            .andReturn();
        return "Bearer " + objectMapper.readTree(result.getResponse().getContentAsString())
            .get("accessToken").asText();
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
        LocalDate date = LocalDate.now().plusDays(1);
        while (date.getDayOfWeek() != dayOfWeek) {
            date = date.plusDays(1);
        }
        return date;
    }
}
