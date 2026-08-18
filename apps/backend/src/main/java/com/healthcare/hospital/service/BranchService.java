package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.BranchResponse;
import com.healthcare.hospital.dto.DoctorSummaryResponse;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BranchService {

    private final BranchRepository branchRepository;
    private final DoctorBranchRepository doctorBranchRepository;

    public BranchService(BranchRepository branchRepository, DoctorBranchRepository doctorBranchRepository) {
        this.branchRepository = branchRepository;
        this.doctorBranchRepository = doctorBranchRepository;
    }

    public Page<BranchResponse> listActive(Pageable pageable) {
        return branchRepository.findByActiveTrue(pageable).map(branch -> toResponse(branch, false));
    }

    public BranchResponse getBySlug(String slug) {
        return branchRepository.findBySlugAndActiveTrue(slug)
            .map(branch -> toResponse(branch, true))
            .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + slug));
    }

    private BranchResponse toResponse(Branch branch, boolean includeDoctors) {
        List<DoctorSummaryResponse> doctors = includeDoctors
            ? doctorBranchRepository.findByBranchId(branch.getId()).stream()
                .filter(link -> link.getDoctor().isActive())
                .map(link -> {
                    var doctor = link.getDoctor();
                    return new DoctorSummaryResponse(
                        doctor.getId().toString(),
                        doctor.getFullName(),
                        doctor.getSlug(),
                        doctor.getPhotoUrl(),
                        null,
                        branch.getId().toString()
                    );
                })
                .toList()
            : List.of();
        return new BranchResponse(
            branch.getId().toString(),
            branch.getName(),
            branch.getSlug(),
            branch.getAddress(),
            branch.getPhone(),
            branch.getWorkingHours(),
            branch.getEmergencyHotline(),
            branch.getMapUrl(),
            HospitalJsonMapper.strings(branch.getAmenities()),
            doctors
        );
    }
}
