package com.healthcare.appointment.service;

import com.healthcare.appointment.repository.AppointmentRepository;
import jakarta.persistence.EntityManager;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Keeps the production PostgreSQL transaction-scoped advisory lock unchanged,
 * but bounds the wait: a waiter holds a main-pool connection for the holder's
 * entire booking transaction, so an unbounded wait can exhaust the pool under
 * cross-IP slot races. 5s then a 409 (mapped in GlobalExceptionHandler from
 * PessimisticLockingFailureException) beats a pool stall — the same posture
 * DocumentService uses for generation locks.
 */
@Component
@Profile("!standalone")
public class PostgresAppointmentSlotLocker implements AppointmentSlotLocker {

    private final AppointmentRepository appointmentRepository;
    private final EntityManager entityManager;

    public PostgresAppointmentSlotLocker(AppointmentRepository appointmentRepository,
            EntityManager entityManager) {
        this.appointmentRepository = appointmentRepository;
        this.entityManager = entityManager;
    }

    @Override
    public void acquire(String lockKey) {
        // SET LOCAL stays armed for the rest of the caller's transaction, so a
        // later contended row lock surfaces the same way as the advisory lock.
        entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
        appointmentRepository.acquireSlotLock(lockKey);
    }
}
