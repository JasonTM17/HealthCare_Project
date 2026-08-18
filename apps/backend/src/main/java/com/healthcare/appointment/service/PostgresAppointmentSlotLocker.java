package com.healthcare.appointment.service;

import com.healthcare.appointment.repository.AppointmentRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Keeps the production PostgreSQL transaction-scoped advisory lock unchanged. */
@Component
@Profile("!standalone")
public class PostgresAppointmentSlotLocker implements AppointmentSlotLocker {

    private final AppointmentRepository appointmentRepository;

    public PostgresAppointmentSlotLocker(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Override
    public void acquire(String lockKey) {
        appointmentRepository.acquireSlotLock(lockKey);
    }
}
