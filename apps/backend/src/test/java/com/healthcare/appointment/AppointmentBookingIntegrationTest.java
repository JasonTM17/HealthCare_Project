package com.healthcare.appointment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Specialty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AppointmentBookingIntegrationTest extends AbstractIntegrationTest {

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
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bookingCode").value(bookingCode))
            .andExpect(jsonPath("$.doctorName").value("BS. CKII Nguyễn Văn An"))
            .andExpect(jsonPath("$.status").value("CONFIRMED"));

        // 5. Cancel appointment
        mockMvc.perform(post("/api/v1/appointments/" + bookingCode + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Thay đổi kế hoạch công tác\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
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
}
