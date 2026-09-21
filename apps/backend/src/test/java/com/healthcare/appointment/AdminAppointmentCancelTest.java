package com.healthcare.appointment;

import com.healthcare.appointment.controller.AdminAppointmentController;
import com.healthcare.appointment.dto.AdminCancelAppointmentRequest;
import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AdminAppointmentService;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.GlobalExceptionHandler;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Admin appointment cancellation: the state machine, the persisted reason, the
 * append-only audit row, and the HTTP contract of the new endpoint.
 *
 * <p>Mockito only — no Spring context and no database, in the style of
 * {@code PublicAiChatControllerTest}. The endpoint-level cases run the real
 * controller through a standalone MockMvc with the real controller advice and
 * the same Jackson configuration the application uses, so the error code and
 * the JSON shape a client sees are the domain values the service raised.
 */
class AdminAppointmentCancelTest {

    private static final UUID APPOINTMENT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PATIENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID PATIENT_USER_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    /** A real principal: equality on username keeps Mockito verification unambiguous. */
    private static final UserDetails ADMIN_PRINCIPAL = new org.springframework.security.core.userdetails.User(
        "admin@example.com", "not-used", java.util.List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final ClinicalAccessAuditService auditService = mock(ClinicalAccessAuditService.class);
    private final com.healthcare.notification.service.NotificationService notifications =
        mock(com.healthcare.notification.service.NotificationService.class);
    private final AdminAppointmentService service =
        new AdminAppointmentService(appointmentRepository, auditService, notifications);
    /** Real bean-validation so {@code @Valid} on the request record is exercised, not assumed. */
    private final LocalValidatorFactoryBean validator = validator();

    @BeforeEach
    void authenticateAsAdmin() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ADMIN_PRINCIPAL, null, ADMIN_PRINCIPAL.getAuthorities()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @EnumSource(value = AppointmentStatus.class, names = {
        "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"})
    void cancelsEveryLiveStatusAndRecordsAuditEvidence(AppointmentStatus live) {
        Appointment appointment = appointment(live);
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(appointmentRepository.saveAndFlush(appointment)).thenReturn(appointment);

        AppointmentResponse response = service.cancel(
            APPOINTMENT_ID,
            new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, "Bệnh nhân gọi điện hủy"),
            ADMIN_PRINCIPAL);

        assertThat(response.status()).isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(appointment.getCancellationReason()).isEqualTo("Bệnh nhân gọi điện hủy");
        assertThat(appointment.getOtpCode()).isNull();
        assertThat(appointment.getHoldExpiresAt()).isNull();
        verify(auditService).record(
            ADMIN_PRINCIPAL,
            PATIENT_ID,
            ClinicalAccessAuditService.TARGET_APPOINTMENT,
            APPOINTMENT_ID.toString(),
            ClinicalAccessAuditService.ACTION_ADMIN_CANCEL_APPOINTMENT,
            ClinicalAccessAuditService.DECISION_ALLOW);
        // The patient must learn the clinic called the booking off, and the
        // stored reason is quoted verbatim in the in-app copy.
        verify(notifications).create(
            org.mockito.ArgumentMatchers.eq(PATIENT_USER_ID),
            org.mockito.ArgumentMatchers.eq(
                com.healthcare.notification.entity.Notification.EventType.APPOINTMENT_CANCELLED),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.contains("Bệnh nhân gọi điện hủy"),
            org.mockito.ArgumentMatchers.eq(APPOINTMENT_ID));
    }

    @ParameterizedTest
    @EnumSource(value = AppointmentStatus.class, names = {"COMPLETED", "CANCELLED", "NO_SHOW"})
    void refusesToCancelTerminalStatuses(AppointmentStatus terminal) {
        Appointment appointment = appointment(terminal);
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));

        assertThatThrownBy(() -> service.cancel(
            APPOINTMENT_ID, new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, null), ADMIN_PRINCIPAL))
            .isInstanceOfSatisfying(BusinessException.class, exception -> {
                assertThat(exception.getStatus()).isEqualTo(409);
                assertThat(exception.getCode()).isEqualTo(ErrorCodes.APPOINTMENT_STATUS_TRANSITION_INVALID);
            });

        assertThat(appointment.getStatus()).isEqualTo(terminal);
        verify(appointmentRepository, never()).saveAndFlush(any());
        verifyNoInteractions(auditService);
    }

    @ParameterizedTest
    @EnumSource(value = AppointmentStatus.class, names = {
        "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"})
    void refusesEveryStatusTargetOtherThanCancelled(AppointmentStatus target) {
        assertThatThrownBy(() -> service.cancel(
            APPOINTMENT_ID, new AdminCancelAppointmentRequest(target, null), ADMIN_PRINCIPAL))
            .isInstanceOfSatisfying(BusinessException.class, exception -> {
                assertThat(exception.getStatus()).isEqualTo(409);
                assertThat(exception.getCode()).isEqualTo(ErrorCodes.APPOINTMENT_STATUS_TRANSITION_INVALID);
            });

        // Nothing may be read or written before the target is proven legal.
        verifyNoInteractions(appointmentRepository, auditService);
    }

    @Test
    void rejectsAnOverlongReasonBeforeLoadingTheAppointment() {
        assertThatThrownBy(() -> service.cancel(
            APPOINTMENT_ID,
            new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, "x".repeat(501)),
            ADMIN_PRINCIPAL))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getStatus()).isEqualTo(400));

        verifyNoInteractions(appointmentRepository, auditService);
    }

    @Test
    void reportsAMissingAppointmentAsNotFound() {
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancel(
            APPOINTMENT_ID, new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, null), ADMIN_PRINCIPAL))
            .isInstanceOfSatisfying(BusinessException.class, exception -> {
                assertThat(exception.getStatus()).isEqualTo(404);
                assertThat(exception.getCode()).isEqualTo(ErrorCodes.APPOINTMENT_NOT_FOUND);
            });

        verifyNoInteractions(auditService);
    }

    @Test
    void anOmittedReasonKeepsTheRowUnchangedInsteadOfInventingOne() {
        Appointment appointment = appointment(AppointmentStatus.CONFIRMED);
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(appointmentRepository.saveAndFlush(appointment)).thenReturn(appointment);

        service.cancel(
            APPOINTMENT_ID, new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, null), ADMIN_PRINCIPAL);

        assertThat(appointment.getCancellationReason()).isNull();
    }

    @Test
    void blankReasonIsNormalizedToNullByTheRequestRecord() {
        assertThat(new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, "   ").reason()).isNull();
        assertThat(new AdminCancelAppointmentRequest(AppointmentStatus.CANCELLED, "  lý do  ").reason())
            .isEqualTo("lý do");
    }

    @Test
    void endpointReturnsTheCancelledSummaryForAPhonedInRequest() throws Exception {
        Appointment appointment = appointment(AppointmentStatus.CONFIRMED);
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));
        when(appointmentRepository.saveAndFlush(appointment)).thenReturn(appointment);

        mockMvc().perform(post("/api/v1/admin/appointments/{id}/status", APPOINTMENT_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CANCELLED\",\"reason\":\"Bệnh nhân bận, xin hủy\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(APPOINTMENT_ID.toString()))
            .andExpect(jsonPath("$.status").value("CANCELLED"))
            .andExpect(jsonPath("$.bookingCode").value("HC-TEST-0001"))
            .andExpect(jsonPath("$.appointmentDate").value("2026-09-21"));
    }

    @Test
    void endpointSurfacesTheTransitionCodeForATerminalAppointment() throws Exception {
        Appointment appointment = appointment(AppointmentStatus.COMPLETED);
        when(appointmentRepository.findByIdWithDetailsForUpdate(APPOINTMENT_ID))
            .thenReturn(Optional.of(appointment));

        mockMvc().perform(post("/api/v1/admin/appointments/{id}/status", APPOINTMENT_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CANCELLED\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("APPOINTMENT_STATUS_TRANSITION_INVALID"));
    }

    @Test
    void endpointRejectsAnUnreachableTargetStatusBeforeCallingTheService() throws Exception {
        mockMvc().perform(post("/api/v1/admin/appointments/{id}/status", APPOINTMENT_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"COMPLETED\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("APPOINTMENT_STATUS_TRANSITION_INVALID"));

        verifyNoInteractions(appointmentRepository);
    }

    @Test
    void endpointRejectsAnOverlongReasonWithFieldLevelValidation() throws Exception {
        mockMvc().perform(post("/api/v1/admin/appointments/{id}/status", APPOINTMENT_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CANCELLED\",\"reason\":\"" + "x".repeat(501) + "\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors[0].field").value("reason"));

        verifyNoInteractions(appointmentRepository);
    }

    @Test
    void endpointRejectsAnUnknownStatusValue() throws Exception {
        mockMvc().perform(post("/api/v1/admin/appointments/{id}/status", APPOINTMENT_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"NOT_A_STATUS\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void endpointRejectsAMissingStatus() throws Exception {
        mockMvc().perform(post("/api/v1/admin/appointments/{id}/status", APPOINTMENT_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Thiếu trạng thái\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors[0].field").value("status"));
    }

    private MockMvc mockMvc() {
        return MockMvcBuilders
            .standaloneSetup(new AdminAppointmentController(service))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
            .setValidator(validator)
            .setMessageConverters(new MappingJackson2HttpMessageConverter(jsonMapper()))
            .build();
    }

    /** Mirrors the application's Jackson setup: ISO-8601 date strings, no numeric timestamps. */
    private static ObjectMapper jsonMapper() {
        return Jackson2ObjectMapperBuilder.json()
            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();
    }

    private static LocalValidatorFactoryBean validator() {
        LocalValidatorFactoryBean factory = new LocalValidatorFactoryBean();
        factory.afterPropertiesSet();
        return factory;
    }

    private Appointment appointment(AppointmentStatus status) {
        PatientProfile patient = new PatientProfile();
        patient.setId(PATIENT_ID);
        patient.setUserId(PATIENT_USER_ID);
        patient.setFullName("Nguyễn Văn A");
        patient.setPhone("0900000000");
        patient.setEmail("patient@example.com");
        Doctor doctor = new Doctor();
        doctor.setId(UUID.fromString("33333333-3333-3333-3333-333333333333"));
        doctor.setFullName("Bác sĩ Trần B");
        Branch branch = new Branch();
        branch.setName("Cơ sở 1");
        branch.setAddress("12 Đường số 1, Quận 1");

        Appointment appointment = new Appointment();
        appointment.setId(APPOINTMENT_ID);
        appointment.setBookingCode("HC-TEST-0001");
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(LocalDate.of(2026, 9, 21));
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.now());
        appointment.setStatus(status);
        appointment.setOtpCode("123456");
        appointment.setHoldExpiresAt(OffsetDateTime.now().plusMinutes(10));
        appointment.setCreatedAt(OffsetDateTime.now());
        return appointment;
    }
}
