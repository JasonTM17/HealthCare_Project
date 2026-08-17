package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;

    public DoctorService(DoctorRepository doctorRepository) {
        this.doctorRepository = doctorRepository;
    }

    public Page<DoctorResponse> listActive(Pageable pageable) {
        return doctorRepository.findByActiveTrue(pageable).map(this::toResponse);
    }

    public DoctorResponse getBySlug(String slug) {
        return doctorRepository.findBySlug(slug)
            .map(this::toResponse)
            .orElse(null);
    }

    private DoctorResponse toResponse(Doctor doctor) {
        return new DoctorResponse(
            doctor.getId().toString(),
            doctor.getFullName(),
            doctor.getSlug(),
            doctor.getBio(),
            doctor.getPhotoUrl()
        );
    }
}
