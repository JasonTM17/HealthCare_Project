package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.BranchResponse;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class BranchService {

    private final BranchRepository branchRepository;

    public BranchService(BranchRepository branchRepository) {
        this.branchRepository = branchRepository;
    }

    public Page<BranchResponse> listActive(Pageable pageable) {
        return branchRepository.findByActiveTrue(pageable).map(this::toResponse);
    }

    public BranchResponse getBySlug(String slug) {
        return branchRepository.findBySlugAndActiveTrue(slug)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + slug));
    }

    private BranchResponse toResponse(Branch branch) {
        return new BranchResponse(
            branch.getId().toString(),
            branch.getName(),
            branch.getSlug(),
            branch.getAddress(),
            branch.getPhone()
        );
    }
}
