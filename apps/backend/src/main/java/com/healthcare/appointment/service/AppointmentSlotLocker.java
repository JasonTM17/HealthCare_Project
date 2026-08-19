package com.healthcare.appointment.service;

/** Serializes writers for one logical doctor/branch/date slot group. */
@FunctionalInterface
public interface AppointmentSlotLocker {
    void acquire(String lockKey);
}
