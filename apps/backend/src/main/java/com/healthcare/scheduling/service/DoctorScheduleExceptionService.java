package com.healthcare.scheduling.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.dto.DoctorScheduleExceptionRequest;
import com.healthcare.scheduling.dto.DoctorScheduleExceptionResponse;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DoctorScheduleExceptionService {
    private final DoctorScheduleExceptionRepository repository;
    private final DoctorRepository doctorRepository;
    private final BranchRepository branchRepository;
    private final DoctorBranchRepository doctorBranchRepository;

    public DoctorScheduleExceptionService(DoctorScheduleExceptionRepository repository,
            DoctorRepository doctorRepository, BranchRepository branchRepository,
            DoctorBranchRepository doctorBranchRepository) {
        this.repository = repository;
        this.doctorRepository = doctorRepository;
        this.branchRepository = branchRepository;
        this.doctorBranchRepository = doctorBranchRepository;
    }

    @Transactional(readOnly = true)
    public Page<DoctorScheduleExceptionResponse> list(Pageable pageable) {
        return repository.findAllWithDetails(pageable).map(DoctorScheduleExceptionResponse::from);
    }

    @Transactional
    public DoctorScheduleExceptionResponse create(UUID doctorId, UUID branchId, DoctorScheduleExceptionRequest request) {
        Doctor doctor = doctorRepository.findById(doctorId)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + doctorId));
        Branch branch = branchRepository.findById(branchId)
            .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + branchId));
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)) {
            throw new BusinessException(400, "Doctor is not assigned to branch: " + branchId);
        }
        DoctorScheduleException item = new DoctorScheduleException();
        item.setDoctor(doctor); item.setBranch(branch); apply(item, request);
        return DoctorScheduleExceptionResponse.from(repository.saveAndFlush(item));
    }

    @Transactional
    public DoctorScheduleExceptionResponse update(UUID id, DoctorScheduleExceptionRequest request) {
        DoctorScheduleException item = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Schedule exception not found: " + id));
        apply(item, request);
        return DoctorScheduleExceptionResponse.from(repository.saveAndFlush(item));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) throw new ResourceNotFoundException("Schedule exception not found: " + id);
        repository.deleteById(id);
    }

    private void apply(DoctorScheduleException item, DoctorScheduleExceptionRequest request) {
        item.setExceptionDate(request.exceptionDate());
        item.setType(request.type());
        item.setCustomStartTime(request.customStartTime());
        item.setCustomEndTime(request.customEndTime());
        item.setReason(request.reason() == null || request.reason().isBlank() ? null : request.reason().trim());
    }
}
