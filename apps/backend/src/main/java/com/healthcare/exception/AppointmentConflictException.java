package com.healthcare.exception;

public class AppointmentConflictException extends ConflictException {

    public AppointmentConflictException(String message) {
        super(ErrorCodes.APPOINTMENT_CONFLICT, message);
    }
}
