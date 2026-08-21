package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;

@Service
public class AdminAppointmentService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORTS = Set.of(
        "appointmentDate", "startTime", "createdAt", "status", "bookingCode", "id"
    );
    private static final Sort DEFAULT_SORT = Sort.by(
        Sort.Order.desc("appointmentDate"),
        Sort.Order.desc("startTime"),
        Sort.Order.desc("createdAt")
    );

    private final AppointmentRepository appointmentRepository;

    public AdminAppointmentService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional(readOnly = true)
    public Page<AppointmentResponse> list(LocalDate date, String rawStatus, Pageable pageable) {
        AppointmentStatus status = parseStatus(rawStatus);
        Pageable safePageable = normalize(pageable);
        Page<Appointment> appointments;
        if (date == null && status == null) {
            appointments = appointmentRepository.findAllForAdmin(safePageable);
        } else if (date == null) {
            appointments = appointmentRepository.findByStatus(status, safePageable);
        } else if (status == null) {
            appointments = appointmentRepository.findByAppointmentDate(date, safePageable);
        } else {
            appointments = appointmentRepository.findByAppointmentDateAndStatus(date, status, safePageable);
        }
        return appointments.map(this::toResponse);
    }

    private AppointmentStatus parseStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) return null;
        try {
            return AppointmentStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái lịch hẹn không hợp lệ");
        }
    }

    private Pageable normalize(Pageable pageable) {
        int page = pageable == null ? 0 : pageable.getPageNumber();
        int size = pageable == null ? 20 : pageable.getPageSize();
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page phải >= 0 và size phải từ 1 đến 100");
        }
        Sort sort = pageable == null || pageable.getSort().isUnsorted() ? DEFAULT_SORT : pageable.getSort();
        sort.forEach(order -> {
            if (!ALLOWED_SORTS.contains(order.getProperty())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thuộc tính sắp xếp lịch hẹn không được hỗ trợ");
            }
        });
        return PageRequest.of(page, size, sort);
    }

    private AppointmentResponse toResponse(Appointment appointment) {
        return new AppointmentResponse(
            appointment.getId(), appointment.getBookingCode(), appointment.getPatient().getFullName(),
            appointment.getPatient().getPhone(), appointment.getPatient().getEmail(), appointment.getDoctor().getId(),
            appointment.getDoctor().getFullName(), "Bác sĩ chuyên khoa",
            appointment.getSpecialty() == null ? null : appointment.getSpecialty().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getAddress(),
            appointment.getMedicalPackage() == null ? null : appointment.getMedicalPackage().getName(),
            appointment.getAppointmentDate(), appointment.getStartTime(), appointment.getEndTime(),
            appointment.getStatus(), appointment.getPaymentStatus(), appointment.getReasonForVisit(), appointment.getCreatedAt()
        );
    }
}
