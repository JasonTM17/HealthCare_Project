package com.healthcare.clinical;

import com.healthcare.appointment.dto.DoctorAppointmentResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorAppointmentRangeRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentPortalService;
import com.healthcare.clinical.controller.DoctorPortalController;
import com.healthcare.clinical.service.ClinicalService;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.service.DoctorService;
import com.healthcare.scheduling.dto.DoctorRosterEntryResponse;
import com.healthcare.scheduling.dto.DoctorRosterExceptionResponse;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionPortalRepository;
import com.healthcare.scheduling.repository.DoctorSchedulePortalRepository;
import com.healthcare.scheduling.service.DoctorScheduleReadService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.data.web.config.SpringDataJacksonConfiguration;
import org.springframework.data.web.config.SpringDataWebSettings;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Doctor portal roster and appointment-range reads.
 *
 * <p>Mockito plus standalone MockMvc only — no Spring context, no database — in
 * the style of {@code PublicAiChatControllerTest}. The HTTP cases matter because
 * the wire shape is the contract the portal consumes: flat objects with
 * {@code HH:mm:ss} times, and a bounded range. The real
 * {@link AuthenticationPrincipalArgumentResolver} is registered so
 * {@code @AuthenticationPrincipal} behaves as it does in the application.
 */
class DoctorPortalRosterAndRangeTest {

    private static final UUID DOCTOR_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID BRANCH_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final LocalDate DAY = LocalDate.of(2026, 9, 21);

    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final DoctorAppointmentRangeRepository rangeRepository =
        mock(DoctorAppointmentRangeRepository.class);
    private final PatientProfileRepository patientProfileRepository = mock(PatientProfileRepository.class);
    private final DoctorRepository doctorRepository = mock(DoctorRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DoctorSchedulePortalRepository rosterRepository =
        mock(DoctorSchedulePortalRepository.class);
    private final DoctorScheduleExceptionPortalRepository rosterExceptionRepository =
        mock(DoctorScheduleExceptionPortalRepository.class);
    private final DoctorScheduleReadService readService =
        new DoctorScheduleReadService(rosterRepository, rosterExceptionRepository);
    private final AppointmentPortalService service = new AppointmentPortalService(
        appointmentRepository,
        rangeRepository,
        patientProfileRepository,
        doctorRepository,
        userRepository,
        readService);

    @BeforeEach
    void authenticateAsDoctor() {
        HealthcareUserPrincipal principal = doctorPrincipal();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ---------------------------------------------------------------- roster

    @Test
    void rosterIsFlatDoctorScopedAndReportsInactiveRows() {
        Branch branch = branch();
        when(rosterRepository.findRosterForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of(
            schedule(branch, 1, LocalTime.of(8, 0), LocalTime.of(11, 30), 30, true),
            schedule(branch, 3, LocalTime.of(13, 0), LocalTime.of(17, 0), 20, false)
        ));

        List<DoctorRosterEntryResponse> roster = readService.listRoster(DOCTOR_ID);

        assertThat(roster).hasSize(2);
        assertThat(roster.get(0).dayOfWeek()).isEqualTo(1);
        assertThat(roster.get(0).startTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(roster.get(0).endTime()).isEqualTo(LocalTime.of(11, 30));
        assertThat(roster.get(0).slotDurationMinutes()).isEqualTo(30);
        assertThat(roster.get(0).branchId()).isEqualTo(BRANCH_ID);
        assertThat(roster.get(0).branchName()).isEqualTo("Cơ sở 1");
        assertThat(roster.get(0).effectiveFrom()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(roster.get(0).effectiveTo()).isNull();
        assertThat(roster.get(0).active()).isTrue();
        assertThat(roster.get(1).active()).isFalse();
    }

    @Test
    void rosterReadsAreAlwaysCapped() {
        when(rosterRepository.findRosterForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of());
        when(rosterExceptionRepository.findExceptionsForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of());

        readService.listRoster(DOCTOR_ID);
        readService.listExceptions(DOCTOR_ID);

        verify(rosterRepository).findRosterForDoctor(eq(DOCTOR_ID),
            argThat(pageable -> pageable != null
                && pageable.getPageSize() == DoctorScheduleReadService.MAX_ROSTER_ROWS));
        verify(rosterExceptionRepository).findExceptionsForDoctor(eq(DOCTOR_ID),
            argThat(pageable -> pageable != null
                && pageable.getPageSize() == DoctorScheduleReadService.MAX_EXCEPTION_ROWS));
    }

    @Test
    void exceptionsExposeCustomHoursAsStartAndEndPlusTheNote() {
        when(rosterExceptionRepository.findExceptionsForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of(
            exception("LEAVE", null, null, "Nghỉ phép"),
            exception("CUSTOM_HOURS", LocalTime.of(9, 15), LocalTime.of(11, 0), "Đổi ca")
        ));

        List<DoctorRosterExceptionResponse> exceptions = readService.listExceptions(DOCTOR_ID);

        assertThat(exceptions.get(0).type()).isEqualTo("LEAVE");
        assertThat(exceptions.get(0).startTime()).isNull();
        assertThat(exceptions.get(0).note()).isEqualTo("Nghỉ phép");
        assertThat(exceptions.get(1).startTime()).isEqualTo(LocalTime.of(9, 15));
        assertThat(exceptions.get(1).endTime()).isEqualTo(LocalTime.of(11, 0));
        assertThat(exceptions.get(1).branchName()).isEqualTo("Cơ sở 1");
    }

    @Test
    void rosterReadsResolveTheDoctorFromThePrincipalOnly() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rosterRepository.findRosterForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of());
        when(rosterExceptionRepository.findExceptionsForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of());

        service.getDoctorRoster(doctorPrincipal());
        service.getDoctorScheduleExceptions(doctorPrincipal());

        verify(rosterRepository).findRosterForDoctor(eq(DOCTOR_ID), any());
        verify(rosterExceptionRepository).findExceptionsForDoctor(eq(DOCTOR_ID), any());
    }

    @Test
    void rosterReadsRefuseAPatientPrincipal() {
        assertThatThrownBy(() -> service.getDoctorRoster(patientPrincipal()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.getDoctorScheduleExceptions(patientPrincipal()))
            .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(rosterRepository, rosterExceptionRepository);
    }

    @Test
    void rosterReadsRefuseADoctorAccountWithNoDoctorProfile() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDoctorRoster(doctorPrincipal()))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.getDoctorScheduleExceptions(doctorPrincipal()))
            .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(rosterRepository, rosterExceptionRepository);
    }

    @Test
    void schedulesEndpointKeepsTheFlatShapeAndHhMmSsTimes() throws Exception {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rosterRepository.findRosterForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of(
            schedule(branch(), 1, LocalTime.of(8, 0), LocalTime.of(11, 30), 30, true)
        ));

        mockMvc().perform(get("/api/v1/doctor/schedules"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].dayOfWeek").value(1))
            .andExpect(jsonPath("$[0].startTime").value("08:00:00"))
            .andExpect(jsonPath("$[0].endTime").value("11:30:00"))
            .andExpect(jsonPath("$[0].slotDurationMinutes").value(30))
            .andExpect(jsonPath("$[0].branchId").value(BRANCH_ID.toString()))
            .andExpect(jsonPath("$[0].branchName").value("Cơ sở 1"))
            .andExpect(jsonPath("$[0].effectiveFrom").value("2026-01-01"))
            .andExpect(jsonPath("$[0].effectiveTo").doesNotExist())
            .andExpect(jsonPath("$[0].active").value(true));
    }

    @Test
    void scheduleExceptionsEndpointKeepsTheFlatShape() throws Exception {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rosterExceptionRepository.findExceptionsForDoctor(eq(DOCTOR_ID), any())).thenReturn(List.of(
            exception("CUSTOM_HOURS", LocalTime.of(9, 15), LocalTime.of(11, 0), "Đổi ca")
        ));

        mockMvc().perform(get("/api/v1/doctor/schedule-exceptions"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].exceptionDate").value("2026-09-21"))
            .andExpect(jsonPath("$[0].type").value("CUSTOM_HOURS"))
            .andExpect(jsonPath("$[0].startTime").value("09:15:00"))
            .andExpect(jsonPath("$[0].endTime").value("11:00:00"))
            .andExpect(jsonPath("$[0].note").value("Đổi ca"))
            .andExpect(jsonPath("$[0].branchName").value("Cơ sở 1"));
    }

    // ----------------------------------------------------------------- range

    @Test
    void rangeReadUsesTheRangeQueryAndChronologicalOrdering() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rangeRepository.findRangeForDoctor(eq(DOCTOR_ID), eq(DAY), eq(DAY.plusDays(6)), any()))
            .thenReturn(new PageImpl<>(List.of(appointment(DAY))));

        Page<DoctorAppointmentResponse> result = service.getDoctorAppointments(
            null, DAY.toString(), DAY.plusDays(6).toString(), null, doctorPrincipal(), PageRequest.of(0, 20));

        assertThat(result.getContent()).hasSize(1);
        verify(rangeRepository).findRangeForDoctor(
            eq(DOCTOR_ID), eq(DAY), eq(DAY.plusDays(6)),
            argThat(pageable -> pageable != null
                && pageable.getSort().getOrderFor("appointmentDate") != null
                && pageable.getSort().getOrderFor("appointmentDate").isAscending()
                && pageable.getSort().getOrderFor("startTime") != null
                && pageable.getSort().getOrderFor("startTime").isAscending()));
        verifyNoInteractions(appointmentRepository);
    }

    @Test
    void rangeReadHonoursTheStatusFilter() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rangeRepository.findRangeForDoctorByStatus(
            eq(DOCTOR_ID), eq(DAY), eq(DAY), eq(AppointmentStatus.CONFIRMED), any()))
            .thenReturn(Page.empty());

        service.getDoctorAppointments(
            null, DAY.toString(), DAY.toString(), "CONFIRMED", doctorPrincipal(), PageRequest.of(0, 20));

        verify(rangeRepository).findRangeForDoctorByStatus(
            eq(DOCTOR_ID), eq(DAY), eq(DAY), eq(AppointmentStatus.CONFIRMED), any());
    }

    @Test
    void singleDateReadStillUsesTheDayQueryOnly() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(appointmentRepository.findPortalAppointmentsForDoctor(eq(DOCTOR_ID), eq(DAY), any()))
            .thenReturn(Page.empty());

        service.getDoctorAppointments(
            DAY.toString(), null, null, null, doctorPrincipal(), PageRequest.of(0, 20));

        verify(appointmentRepository).findPortalAppointmentsForDoctor(eq(DOCTOR_ID), eq(DAY), any());
        verifyNoInteractions(rangeRepository);
    }

    @Test
    void singleDateWinsOverARangeWhenBothAreSupplied() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(appointmentRepository.findPortalAppointmentsForDoctor(eq(DOCTOR_ID), eq(DAY), any()))
            .thenReturn(Page.empty());

        service.getDoctorAppointments(
            DAY.toString(), DAY.toString(), DAY.plusDays(3).toString(), null,
            doctorPrincipal(), PageRequest.of(0, 20));

        verifyNoInteractions(rangeRepository);
    }

    @Test
    void rangeLongerThanThirtyOneDaysIsRefused() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));

        assertThatThrownBy(() -> service.getDoctorAppointments(
            null, DAY.toString(), DAY.plusDays(31).toString(), null,
            doctorPrincipal(), PageRequest.of(0, 20)))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode().value()).isEqualTo(400));

        verifyNoInteractions(rangeRepository);
    }

    @Test
    void thirtyOneDayRangeIsAccepted() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rangeRepository.findRangeForDoctor(eq(DOCTOR_ID), eq(DAY), eq(DAY.plusDays(30)), any()))
            .thenReturn(Page.empty());

        service.getDoctorAppointments(
            null, DAY.toString(), DAY.plusDays(30).toString(), null,
            doctorPrincipal(), PageRequest.of(0, 20));

        verify(rangeRepository).findRangeForDoctor(eq(DOCTOR_ID), eq(DAY), eq(DAY.plusDays(30)), any());
    }

    @Test
    void invertedRangeIsRefused() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));

        assertThatThrownBy(() -> service.getDoctorAppointments(
            null, DAY.plusDays(2).toString(), DAY.toString(), null,
            doctorPrincipal(), PageRequest.of(0, 20)))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode().value()).isEqualTo(400));

        verifyNoInteractions(rangeRepository);
    }

    @Test
    void aRequestWithNeitherDateNorRangeFailsExactlyAsBefore() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));

        assertThatThrownBy(() -> service.getDoctorAppointments(
            null, null, null, null, doctorPrincipal(), PageRequest.of(0, 20)))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getReason())
                    .isEqualTo("date is required and must use ISO-8601 format yyyy-MM-dd"));
    }

    @Test
    void aMalformedRangeBoundNamesTheOffendingParameter() {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));

        assertThatThrownBy(() -> service.getDoctorAppointments(
            null, "21-09-2026", DAY.toString(), null, doctorPrincipal(), PageRequest.of(0, 20)))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getReason())
                    .isEqualTo("'from' must use ISO-8601 format yyyy-MM-dd"));
    }

    @Test
    void appointmentsEndpointAcceptsARangeWithoutADate() throws Exception {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));
        when(rangeRepository.findRangeForDoctor(eq(DOCTOR_ID), eq(DAY), eq(DAY.plusDays(2)), any()))
            .thenReturn(new PageImpl<>(List.of(appointment(DAY), appointment(DAY.plusDays(1)))));

        mockMvc().perform(get("/api/v1/doctor/appointments")
                .param("from", DAY.toString())
                .param("to", DAY.plusDays(2).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.content[0].appointmentDate").value(DAY.toString()))
            .andExpect(jsonPath("$.content[0].status").value("CONFIRMED"))
            .andExpect(jsonPath("$.content[0].patientPhone").doesNotExist())
            .andExpect(jsonPath("$.content[0].paymentStatus").value("UNPAID"));
    }

    @Test
    void appointmentsEndpointStillRejectsAMissingDateAndRange() throws Exception {
        when(doctorRepository.findByUserId(DOCTOR_ID)).thenReturn(Optional.of(doctor()));

        mockMvc().perform(get("/api/v1/doctor/appointments"))
            .andExpect(status().isBadRequest());
    }

    // --------------------------------------------------------------- helpers

    private MockMvc mockMvc() {
        return MockMvcBuilders
            .standaloneSetup(new DoctorPortalController(
                mock(ClinicalService.class), service, mock(DoctorService.class)))
            .setCustomArgumentResolvers(
                new AuthenticationPrincipalArgumentResolver(),
                new PageableHandlerMethodArgumentResolver())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(jsonMapper()))
            .build();
    }

    /**
     * Mirrors the application's Jackson setup: ISO-8601 date strings, no numeric
     * timestamps, and Spring Data's own page serializer. The last one is what a
     * running Spring Boot application gets from context configuration and a
     * standalone MockMvc does not — without it the page envelope cannot be
     * written at all, and the test would fail on the harness rather than on the
     * contract it is meant to check.
     */
    private static ObjectMapper jsonMapper() {
        ObjectMapper mapper = Jackson2ObjectMapperBuilder.json()
            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();
        // Registered after build(): passing explicit modules to the builder would
        // suppress the well-known modules (JavaTimeModule among them).
        mapper.registerModule(new SpringDataJacksonConfiguration.PageModule(new SpringDataWebSettings(
            EnableSpringDataWebSupport.PageSerializationMode.DIRECT)));
        return mapper;
    }

    private Doctor doctor() {
        Doctor doctor = new Doctor();
        doctor.setId(DOCTOR_ID);
        doctor.setFullName("Bác sĩ Trần B");
        doctor.setUserId(DOCTOR_ID);
        return doctor;
    }

    private HealthcareUserPrincipal doctorPrincipal() {
        return principal("DOCTOR", "doctor@example.com");
    }

    private HealthcareUserPrincipal patientPrincipal() {
        return principal("PATIENT", "patient@example.com");
    }

    private HealthcareUserPrincipal principal(String roleCode, String email) {
        User user = new User();
        user.setId(DOCTOR_ID);
        user.setEmail(email);
        user.setStatus("ACTIVE");
        Role role = new Role();
        role.setCode(roleCode);
        user.addRole(role);
        return HealthcareUserPrincipal.from(user);
    }

    private Branch branch() {
        Branch branch = new Branch();
        branch.setId(BRANCH_ID);
        branch.setName("Cơ sở 1");
        branch.setAddress("12 Đường số 1, Quận 1");
        return branch;
    }

    private DoctorSchedule schedule(
            Branch branch, int dayOfWeek, LocalTime start, LocalTime end, int duration, boolean active) {
        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setId(UUID.randomUUID());
        schedule.setDoctor(doctor());
        schedule.setBranch(branch);
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartTime(start);
        schedule.setEndTime(end);
        schedule.setSlotDurationMinutes(duration);
        schedule.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        schedule.setEffectiveTo(null);
        schedule.setActive(active);
        return schedule;
    }

    private DoctorScheduleException exception(String type, LocalTime start, LocalTime end, String reason) {
        DoctorScheduleException exception = new DoctorScheduleException();
        exception.setId(UUID.randomUUID());
        exception.setDoctor(doctor());
        exception.setBranch(branch());
        exception.setExceptionDate(DAY);
        exception.setType(type);
        exception.setCustomStartTime(start);
        exception.setCustomEndTime(end);
        exception.setReason(reason);
        return exception;
    }

    private Appointment appointment(LocalDate date) {
        PatientProfile patient = new PatientProfile();
        patient.setId(UUID.randomUUID());
        patient.setFullName("Nguyễn Văn A");
        patient.setPhone("0900000000");
        patient.setEmail("patient@example.com");

        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setBookingCode("HC-RANGE-0001");
        appointment.setPatient(patient);
        appointment.setDoctor(doctor());
        appointment.setBranch(branch());
        appointment.setAppointmentDate(date);
        appointment.setStartTime(LocalTime.of(9, 0));
        appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.now());
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setCreatedAt(OffsetDateTime.now());
        return appointment;
    }
}
