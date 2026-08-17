package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctorRepository;

    public AdminDoctorService(DoctorRepository doctorRepository) {
        this.doctorRepository = doctorRepository;
    }

    @Transactional
    public Doctor create(DoctorRequest request) {
        if (doctorRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Doctor slug already exists: " + request.slug());
        }
        Doctor doctor = new Doctor();
        doctor.setFullName(request.fullName());
        doctor.setSlug(request.slug());
        doctor.setBio(request.bio());
        doctor.setPhotoUrl(request.photoUrl());
        doctor.setActive(request.active());
        return doctorRepository.save(doctor);
    }

    @Transactional
    public Doctor update(String slug, DoctorRequest request) {
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        if (!slug.equals(request.slug()) && doctorRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Doctor slug already exists: " + request.slug());
        }
        doctor.setFullName(request.fullName());
        doctor.setSlug(request.slug());
        doctor.setBio(request.bio());
        doctor.setPhotoUrl(request.photoUrl());
        doctor.setActive(request.active());
        return doctorRepository.save(doctor);
    }

    @Transactional
    public void delete(String slug) {
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        doctorRepository.delete(doctor);
    }
}
