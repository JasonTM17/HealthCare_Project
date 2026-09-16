package com.healthcare.hospital.service;

import com.healthcare.common.SafePageRequests;
import com.healthcare.hospital.dto.BranchResponse;
import com.healthcare.hospital.dto.DoctorSummaryResponse;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class BranchService {

    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of("id", "name", "slug");

    private final BranchRepository branchRepository;
    private final DoctorBranchRepository doctorBranchRepository;

    public BranchService(BranchRepository branchRepository, DoctorBranchRepository doctorBranchRepository) {
        this.branchRepository = branchRepository;
        this.doctorBranchRepository = doctorBranchRepository;
    }

    public Page<BranchResponse> listActive(Pageable pageable) {
        Page<Branch> page = branchRepository.findByActiveTrue(
            SafePageRequests.normalize(pageable, Sort.unsorted(), ALLOWED_SORT_PROPERTIES));
        Map<UUID, Long> activeDoctorCounts = activeDoctorCounts(page.getContent());
        return page.map(branch -> toResponse(
            branch,
            false,
            activeDoctorCounts.getOrDefault(branch.getId(), 0L)));
    }

    public BranchResponse getBySlug(String slug) {
        return branchRepository.findBySlugAndActiveTrue(slug)
            .map(branch -> toResponse(
                branch,
                true,
                activeDoctorCounts(List.of(branch)).getOrDefault(branch.getId(), 0L)))
            .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + slug));
    }

    private BranchResponse toResponse(Branch branch, boolean includeDoctors, long activeDoctorCount) {
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
            doctors,
            activeDoctorCount
        );
    }

    private Map<UUID, Long> activeDoctorCounts(List<Branch> branches) {
        if (branches.isEmpty()) return Map.of();
        Map<UUID, Long> counts = new HashMap<>();
        List<UUID> branchIds = branches.stream()
            .map(Branch::getId)
            .filter(id -> id != null)
            .toList();
        if (branchIds.isEmpty()) return counts;
        doctorBranchRepository.countActiveDoctorsByBranchIds(branchIds)
            .forEach(item -> counts.put(item.getBranchId(), item.getDoctorCount()));
        return counts;
    }
}
