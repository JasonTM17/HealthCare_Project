package com.healthcare.scheduling.service;

import com.healthcare.scheduling.dto.DoctorRosterEntryResponse;
import com.healthcare.scheduling.dto.DoctorRosterExceptionResponse;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionPortalRepository;
import com.healthcare.scheduling.repository.DoctorSchedulePortalRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Read-only roster views for the doctor portal.
 *
 * <p>Takes an already-resolved doctor id and performs no authorization of its
 * own: resolving the authenticated principal to a doctor (and rejecting an
 * account with no doctor profile) belongs to the caller, which owns the
 * {@code requireLinkedDoctor} check. Keeping that boundary means a future
 * caller cannot accidentally turn these reads into "fetch any doctor's
 * roster by id" by passing a request parameter.
 *
 * <p>Both reads are capped. A doctor's weekly roster is small by construction
 * (at most seven weekdays per branch), but exceptions accumulate over a career,
 * so the cap is applied inside the query rather than left to the caller.
 */
@Service
public class DoctorScheduleReadService {

    /** Weekly roster rows are bounded by (7 weekdays x branches); 100 is a generous ceiling. */
    public static final int MAX_ROSTER_ROWS = 100;
    /** Exceptions are returned newest first and capped so the response stays bounded. */
    public static final int MAX_EXCEPTION_ROWS = 200;

    private final DoctorSchedulePortalRepository scheduleRepository;
    private final DoctorScheduleExceptionPortalRepository exceptionRepository;

    public DoctorScheduleReadService(
            DoctorSchedulePortalRepository scheduleRepository,
            DoctorScheduleExceptionPortalRepository exceptionRepository) {
        this.scheduleRepository = scheduleRepository;
        this.exceptionRepository = exceptionRepository;
    }

    /** The doctor's own weekly templates, active and inactive, ordered day-of-week then start time. */
    @Transactional(readOnly = true)
    public List<DoctorRosterEntryResponse> listRoster(UUID doctorId) {
        Pageable limit = PageRequest.of(0, MAX_ROSTER_ROWS);
        return scheduleRepository.findRosterForDoctor(doctorId, limit).stream()
            .map(DoctorRosterEntryResponse::from)
            .toList();
    }

    /** The doctor's own schedule exceptions, most recent date first. */
    @Transactional(readOnly = true)
    public List<DoctorRosterExceptionResponse> listExceptions(UUID doctorId) {
        Pageable limit = PageRequest.of(0, MAX_EXCEPTION_ROWS);
        return exceptionRepository.findExceptionsForDoctor(doctorId, limit).stream()
            .map(DoctorRosterExceptionResponse::from)
            .toList();
    }
}
