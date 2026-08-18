package com.healthcare.career.service;

import com.healthcare.career.dto.JobApplicationAdminResponse;
import com.healthcare.career.entity.ApplicationStatus;
import com.healthcare.career.entity.JobApplication;
import com.healthcare.career.repository.JobApplicationRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.UUID;

@Service
public class AdminCareerService {

    private final JobApplicationRepository jobApplicationRepository;

    public AdminCareerService(JobApplicationRepository jobApplicationRepository) {
        this.jobApplicationRepository = jobApplicationRepository;
    }

    @Transactional(readOnly = true)
    public Page<JobApplicationAdminResponse> list(String status, Pageable pageable) {
        return jobApplicationRepository.findForAdmin(parseStatus(status), pageable).map(this::toResponse);
    }

    @Transactional
    public JobApplicationAdminResponse updateStatus(UUID id, String status) {
        JobApplication application = jobApplicationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hồ sơ ứng tuyển."));
        application.setStatus(parseRequiredStatus(status));
        application.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return toResponse(jobApplicationRepository.save(application));
    }

    private ApplicationStatus parseStatus(String value) {
        if (value == null || value.isBlank()) return null;
        return parseRequiredStatus(value);
    }

    private ApplicationStatus parseRequiredStatus(String value) {
        try {
            return ApplicationStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new BusinessException(400, "Trạng thái hồ sơ không hợp lệ.");
        }
    }

    private JobApplicationAdminResponse toResponse(JobApplication application) {
        return new JobApplicationAdminResponse(
            application.getId().toString(),
            application.getApplicationCode(),
            application.getJobPosition().getId().toString(),
            application.getJobPosition().getTitle(),
            application.getFullName(),
            application.getEmail(),
            application.getPhone(),
            application.getYearsExperience(),
            application.getCoverLetter(),
            application.getResumeUrl(),
            application.getStatus().name(),
            application.getCreatedAt(),
            application.getUpdatedAt()
        );
    }
}
