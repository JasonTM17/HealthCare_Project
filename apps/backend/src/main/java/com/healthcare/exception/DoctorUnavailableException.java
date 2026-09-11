package com.healthcare.exception;

public class DoctorUnavailableException extends ConflictException {

    public DoctorUnavailableException(String message) {
        super(ErrorCodes.DOCTOR_UNAVAILABLE, message);
    }
}
