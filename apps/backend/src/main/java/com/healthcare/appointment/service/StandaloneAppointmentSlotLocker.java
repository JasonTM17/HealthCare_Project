package com.healthcare.appointment.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Process-local equivalent of the PostgreSQL advisory lock for standalone H2.
 * The lock is held until the surrounding booking transaction completes.
 */
@Component
@Profile("standalone")
public class StandaloneAppointmentSlotLocker implements AppointmentSlotLocker {

    private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    @Override
    public void acquire(String lockKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException("A booking slot lock requires an active transaction");
        }

        ReentrantLock lock = locks.computeIfAbsent(lockKey, ignored -> new ReentrantLock(true));
        lock.lock();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                lock.unlock();
                if (!lock.isLocked() && !lock.hasQueuedThreads()) {
                    locks.remove(lockKey, lock);
                }
            }
        });
    }
}
