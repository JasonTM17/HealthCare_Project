package com.healthcare.appointment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Closes holds that were abandoned mid-flow.
 *
 * <p>The booking flow also expires holds lazily, but only for the exact slot a
 * new request happens to touch. A hold the patient simply walked away from
 * therefore stayed {@code PENDING_CONFIRMATION} until someone asked for the same
 * doctor, branch and time — occupying the branch-scoped exclusion constraint and
 * skewing any per-doctor availability view. This job is the deterministic sweep
 * for those rows.
 *
 * <p>Bounded and non-blocking, mirroring {@link AppointmentReminderService}: one
 * transaction per tick, at most one batch of 100 rows, and
 * {@code FOR UPDATE SKIP LOCKED} so a concurrent booking never waits on the
 * sweep or vice versa.
 */
@Service
public class AppointmentHoldSweeper {

    private static final Logger log = LoggerFactory.getLogger(AppointmentHoldSweeper.class);
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final AppointmentRepository appointmentRepository;

    public AppointmentHoldSweeper(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Scheduled(fixedDelayString = "${app.booking.hold-sweep-ms:60000}")
    @Transactional
    public int sweepExpiredHolds() {
        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);
        List<Appointment> abandoned = appointmentRepository.lockExpiredPendingHolds(now);
        if (abandoned.isEmpty()) {
            return 0;
        }

        for (Appointment appointment : abandoned) {
            appointment.setStatus(AppointmentStatus.CANCELLED);
            appointment.setCancellationReason(BookingService.HOLD_EXPIRED_CANCELLATION_REASON);
            // A cancelled hold must not leave a usable code or a live expiry
            // behind; both sweeps in BookingService clear them the same way.
            appointment.setHoldExpiresAt(null);
            appointment.setOtpCode(null);
            appointment.setOtpExpiresAt(null);
            appointment.setOtpIssuedAt(null);
        }
        appointmentRepository.saveAll(abandoned);
        log.info("Swept {} expired appointment hold(s) into CANCELLED.", abandoned.size());
        return abandoned.size();
    }
}
