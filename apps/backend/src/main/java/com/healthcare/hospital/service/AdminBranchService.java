package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.BranchRequest;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.BranchRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminBranchService {

    private final BranchRepository branchRepository;

    public AdminBranchService(BranchRepository branchRepository) {
        this.branchRepository = branchRepository;
    }

    @Transactional(readOnly = true)
    public Page<Branch> list(Pageable pageable) {
        return branchRepository.findAll(pageable);
    }

    @Transactional
    public Branch create(BranchRequest request) {
        if (branchRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Branch slug already exists: " + request.slug());
        }
        Branch branch = new Branch();
        branch.setName(request.name());
        branch.setSlug(request.slug());
        branch.setAddress(request.address());
        branch.setPhone(request.phone());
        branch.setActive(request.active());
        return branchRepository.save(branch);
    }

    @Transactional
    public Branch update(String slug, BranchRequest request) {
        Branch branch = branchRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Branch not found: " + slug));
        if (!slug.equals(request.slug()) && branchRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Branch slug already exists: " + request.slug());
        }
        branch.setName(request.name());
        branch.setSlug(request.slug());
        branch.setAddress(request.address());
        branch.setPhone(request.phone());
        branch.setActive(request.active());
        return branchRepository.save(branch);
    }

    @Transactional
    public void delete(String slug) {
        Branch branch = branchRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Branch not found: " + slug));
        branchRepository.delete(branch);
    }
}
