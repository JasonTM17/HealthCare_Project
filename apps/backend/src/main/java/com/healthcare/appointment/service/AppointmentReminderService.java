package com.healthcare.appointment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
public class AppointmentReminderService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final AppointmentRepository appointmentRepository;
    private final NotificationService notificationService;

    @Value("${app.booking.reminder-lead-hours:24}")
    private long reminderLeadHours;

    public AppointmentReminderService(
            AppointmentRepository appointmentRepository,
            NotificationService notificationService) {
        this.appointmentRepository = appointmentRepository;
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "${app.booking.reminder-scan-ms:60000}")
    @Transactional
    public int sendDueReminders() {
        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);
        OffsetDateTime windowEnd = now.plusHours(Math.max(1, reminderLeadHours));
        List<Appointment> dueAppointments = appointmentRepository.lockDueReminders(now, windowEnd);

        for (Appointment appointment : dueAppointments) {
            if (appointment.getPatient().getUserId() != null) {
                notificationService.create(
                    appointment.getPatient().getUserId(),
                    EventType.APPOINTMENT_REMINDER,
                    "Nhắc lịch khám sắp tới",
                    "Bạn có lịch khám " + appointment.getBookingCode() + " vào "
                        + appointment.getAppointmentDate() + " lúc " + appointment.getStartTime() + ".",
                    appointment.getId()
                );
            }
            appointment.setReminderSentAt(now);
        }
        appointmentRepository.saveAll(dueAppointments);
        return dueAppointments.size();
    }
}
