package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public AdminDoctorService(DoctorRepository doctorRepository, UserRepository userRepository) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Page<Doctor> list(Pageable pageable) {
        return doctorRepository.findAll(pageable);
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
        applyUserLink(doctor, request.userId());
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
        applyUserLink(doctor, request.userId());
        return doctorRepository.save(doctor);
    }

    @Transactional
    public void delete(String slug) {
        Doctor doctor = doctorRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Doctor not found: " + slug));
        doctorRepository.delete(doctor);
    }

    private void applyUserLink(Doctor doctor, java.util.UUID userId) {
        if (userId == null) {
            doctor.setUserId(null);
            return;
        }

        User user = userRepository.findWithRolesById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor user not found: " + userId));
        boolean doctorRole = user.getRoles().stream().anyMatch(role -> "DOCTOR".equals(role.getCode()));
        if (!doctorRole) {
            throw new BusinessException(400, "Linked user must have the DOCTOR role");
        }

        doctorRepository.findByUserId(userId)
            .filter(existing -> !existing.getId().equals(doctor.getId()))
            .ifPresent(existing -> {
                throw new DuplicateResourceException("User is already linked to another doctor");
            });
        doctor.setUserId(userId);
    }
}
