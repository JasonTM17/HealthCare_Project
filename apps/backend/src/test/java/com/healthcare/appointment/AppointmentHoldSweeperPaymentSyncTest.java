package com.healthcare.appointment;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.service.AppointmentHoldSweeper;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.payment.service.BankTransferPaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The scheduled hold sweep must leave the payment subsystem in the same state
 * the lazy BookingService sweeps do: an in-review transfer for a booking that
 * just expired leaves the admin queue, while UNPAID holds (no money moved)
 * skip the payment lookup entirely — the sweep runs every minute, so the
 * common case must stay cheap.
 */
class AppointmentHoldSweeperPaymentSyncTest {

    private final AppointmentRepository appointmentRepository = mock(AppointmentRepository.class);
    private final BankTransferPaymentService paymentService = mock(BankTransferPaymentService.class);
    private final AppointmentHoldSweeper sweeper =
        new AppointmentHoldSweeper(appointmentRepository, paymentService);

    @BeforeEach
    void stubEmptyByDefault() {
        when(appointmentRepository.saveAll(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    @DisplayName("An in-review transfer on an expired hold leaves the admin queue")
    void sweepingSyncsInReviewTransfers() {
        Appointment inReview = expiredHold();
        inReview.setPaymentStatus("PENDING_VERIFICATION");
        when(appointmentRepository.lockExpiredPendingHolds(any())).thenReturn(List.of(inReview));

        int swept = sweeper.sweepExpiredHolds();

        assertThat(swept).isEqualTo(1);
        verify(paymentService).markAppointmentCancelled(inReview);
        assertThat(inReview.getStatus()).isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(inReview.getCancellationReason())
            .isEqualTo(BookingService.HOLD_EXPIRED_CANCELLATION_REASON);
        assertThat(inReview.getHoldExpiresAt()).isNull();
        assertThat(inReview.getOtpCode()).isNull();
    }

    @Test
    @DisplayName("UNPAID and untouched holds skip the payment lookup entirely")
    void unpaidHoldsSkipThePaymentLookup() {
        Appointment untouched = expiredHold();
        Appointment unpaid = expiredHold();
        unpaid.setPaymentStatus("UNPAID");
        when(appointmentRepository.lockExpiredPendingHolds(any()))
            .thenReturn(List.of(untouched, unpaid));

        int swept = sweeper.sweepExpiredHolds();

        assertThat(swept).isEqualTo(2);
        verify(paymentService, never()).markAppointmentCancelled(any());
    }

    @Test
    @DisplayName("An empty sweep touches nothing")
    void emptySweepTouchesNothing() {
        when(appointmentRepository.lockExpiredPendingHolds(any())).thenReturn(List.of());

        assertThat(sweeper.sweepExpiredHolds()).isZero();
        verify(paymentService, never()).markAppointmentCancelled(any());
        verify(appointmentRepository, never()).saveAll(any());
    }

    private Appointment expiredHold() {
        Appointment appointment = new Appointment();
        appointment.setId(UUID.randomUUID());
        appointment.setBookingCode("HC-SWEEP-" + UUID.randomUUID().toString().substring(0, 8));
        appointment.setStatus(AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setHoldExpiresAt(OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(1));
        return appointment;
    }
}
