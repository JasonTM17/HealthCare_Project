package com.healthcare.careplan;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.careplan.service.CarePlanService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CarePlanServiceTest {
    private JdbcTemplate jdbc;
    private CarePlanService service;
    private UserDetails principal;
    private UUID userId;

    @BeforeEach
    void setup() {
        jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        principal = mock(UserDetails.class);
        userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        service = new CarePlanService(jdbc, users);
    }

    @Test
    void patientCannotCompleteAnotherPatientsItem() {
        UUID profileId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("SELECT id FROM patient_profiles"), eq(UUID.class), any(Object[].class)))
            .thenReturn(profileId);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);

        assertThatThrownBy(() -> service.complete(UUID.randomUUID(), principal))
            .isInstanceOf(ResourceNotFoundException.class)
            .extracting("code").isEqualTo("CARE_PLAN_NOT_FOUND");
    }

    @Test
    void doctorCannotCreatePlanForCancelledAppointment() {
        UUID doctorId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("SELECT d.id FROM doctors"), eq(UUID.class), any(Object[].class)))
            .thenReturn(doctorId);
        when(jdbc.queryForMap(anyString(), any(Object[].class)))
            .thenReturn(Map.of("patient_id", UUID.randomUUID(), "doctor_id", doctorId, "status", "CANCELLED"));

        var request = new CarePlanContracts.CreateRequest(UUID.randomUUID(), "Theo dõi", java.util.List.of(
            new CarePlanContracts.ItemRequest("Theo dõi triệu chứng", null, null)));
        assertThatThrownBy(() -> service.create(request, principal))
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("CARE_PLAN_APPOINTMENT_NOT_ELIGIBLE");
    }
}
