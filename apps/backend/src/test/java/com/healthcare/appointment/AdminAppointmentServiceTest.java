package com.healthcare.appointment;

import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AdminAppointmentService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class AdminAppointmentServiceTest {

    private final AdminAppointmentService service = new AdminAppointmentService(mock(AppointmentRepository.class));

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
}
