package com.healthcare.appointment;

import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AdminAppointmentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminAppointmentServiceTest {

    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final AdminAppointmentService service = new AdminAppointmentService(appointmentRepository);

    @Test
    void rejectsUnknownStatusBeforeQueryingRepository() {
        assertThatThrownBy(() -> service.list(null, "NOT_A_STATUS", PageRequest.of(0, 20)))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Trạng thái lịch hẹn không hợp lệ");
    }

    @Test
    void rejectsUnboundedPageSize() {
        assertThatThrownBy(() -> service.list(null, null, PageRequest.of(0, 101)))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("size phải từ 1 đến 100");
    }

    @ParameterizedTest
    @MethodSource("adminListFilters")
    void selectsATypedRepositoryQueryForEachAdminFilter(LocalDate date, String status, QueryPath queryPath) {
        when(appointmentRepository.findAllForAdmin(any())).thenReturn(Page.empty());
        when(appointmentRepository.findByAppointmentDate(any(), any())).thenReturn(Page.empty());
        when(appointmentRepository.findByStatus(any(), any())).thenReturn(Page.empty());
        when(appointmentRepository.findByAppointmentDateAndStatus(any(), any(), any())).thenReturn(Page.empty());

        service.list(date, status, PageRequest.of(0, 20));

        switch (queryPath) {
            case ALL -> verify(appointmentRepository).findAllForAdmin(any());
            case DATE -> verify(appointmentRepository).findByAppointmentDate(eq(date), any());
            case STATUS -> verify(appointmentRepository).findByStatus(eq(AppointmentStatus.valueOf(status)), any());
            case DATE_AND_STATUS -> verify(appointmentRepository).findByAppointmentDateAndStatus(
                eq(date), eq(AppointmentStatus.valueOf(status)), any());
        }
    }

    private static Stream<org.junit.jupiter.params.provider.Arguments> adminListFilters() {
        LocalDate date = LocalDate.of(2026, 8, 20);
        return Stream.of(
            org.junit.jupiter.params.provider.Arguments.of(null, null, QueryPath.ALL),
            org.junit.jupiter.params.provider.Arguments.of(date, null, QueryPath.DATE),
            org.junit.jupiter.params.provider.Arguments.of(null, "CONFIRMED", QueryPath.STATUS),
            org.junit.jupiter.params.provider.Arguments.of(date, "CONFIRMED", QueryPath.DATE_AND_STATUS)
        );
    }

    private enum QueryPath { ALL, DATE, STATUS, DATE_AND_STATUS }
}
