package com.healthcare.career.controller;

import com.healthcare.career.dto.JobApplicationAdminResponse;
import com.healthcare.career.dto.UpdateApplicationStatusRequest;
import com.healthcare.career.service.AdminCareerService;
import com.healthcare.common.SafePageRequests;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/careers/applications")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCareerController {

    private static final Set<String> APPLICATION_SORT_PROPERTIES =
        Set.of("id", "status", "createdAt");

    private final AdminCareerService adminCareerService;

    public AdminCareerController(AdminCareerService adminCareerService) {
        this.adminCareerService = adminCareerService;
    }

    @GetMapping
    public Page<JobApplicationAdminResponse> list(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 30) Pageable pageable) {
        return adminCareerService.list(status,
            SafePageRequests.normalize(pageable, Sort.by(Sort.Direction.DESC, "createdAt"), APPLICATION_SORT_PROPERTIES));
    }

    @PatchMapping("/{id}/status")
    public JobApplicationAdminResponse updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateApplicationStatusRequest request) {
        return adminCareerService.updateStatus(id, request.status());
    }
}
