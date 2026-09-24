package com.healthcare.appointment;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AppointmentHoldSweeper;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.payment.service.BankTransferPaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentHoldSweeperTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private BankTransferPaymentService paymentService;

    private AppointmentHoldSweeper sweeper;

    @BeforeEach
    void setUp() {
        sweeper = new AppointmentHoldSweeper(appointmentRepository, paymentService);
    }

    @Test
    void cancelsExpiredPendingHoldsWithTheSharedReasonAndClearsTheOtp() {
        Appointment expired = new Appointment();
        expired.setId(UUID.randomUUID());
        expired.setBookingCode("BK-EXPIRED");
        expired.setStatus(AppointmentStatus.PENDING_CONFIRMATION);
        expired.setHoldExpiresAt(OffsetDateTime.now().minusMinutes(1));
        expired.setOtpCode("$2a$10$stale");
        expired.setOtpExpiresAt(OffsetDateTime.now().minusMinutes(5));
        expired.setOtpIssuedAt(OffsetDateTime.now().minusMinutes(6));

        when(appointmentRepository.lockExpiredPendingHolds(any(OffsetDateTime.class)))
            .thenReturn(List.of(expired));

        int swept = sweeper.sweepExpiredHolds();

        assertThat(swept).isEqualTo(1);
        assertThat(expired.getStatus()).isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(expired.getCancellationReason())
            .isEqualTo(BookingService.HOLD_EXPIRED_CANCELLATION_REASON);
        assertThat(expired.getHoldExpiresAt()).isNull();
        assertThat(expired.getOtpCode()).isNull();
        assertThat(expired.getOtpExpiresAt()).isNull();
        verify(appointmentRepository).saveAll(List.of(expired));
    }

    @Test
    void doesNothingWhenNoHoldIsAbandoned() {
        when(appointmentRepository.lockExpiredPendingHolds(any(OffsetDateTime.class))).thenReturn(List.of());

        assertThat(sweeper.sweepExpiredHolds()).isZero();
    }
}
