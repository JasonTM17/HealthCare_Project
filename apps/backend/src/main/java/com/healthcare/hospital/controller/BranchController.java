package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.BranchResponse;
import com.healthcare.hospital.service.BranchService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital/branches")
public class BranchController {

    private final BranchService branchService;

    public BranchController(BranchService branchService) {
        this.branchService = branchService;
    }

    @GetMapping
    public Page<BranchResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return branchService.listActive(pageable);
    }

    @GetMapping("/{slug}")
    public BranchResponse getBySlug(@PathVariable String slug) {
        return branchService.getBySlug(slug);
    }
}
