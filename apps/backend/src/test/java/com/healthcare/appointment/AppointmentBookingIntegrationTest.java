package com.healthcare.appointment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Specialty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalTime;
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
    }

    @Test
    void getDoctorSlotsReturnsCalculatedTimeSlots() throws Exception {
        LocalDate targetDate = LocalDate.now().plusDays(2);

        mockMvc.perform(get("/api/v1/appointments/doctors/" + doctor.getId() + "/slots")
                .param("date", targetDate.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$[0].startTime").exists())
            .andExpect(jsonPath("$[0].available").value(true));
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
    void lookupRejectsWrongPhoneProof() throws Exception {
        HoldSlotRequest holdRequest = new HoldSlotRequest(
            doctor.getId(),
            LocalDate.now().plusDays(5),
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

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidConfirm)))
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
}
