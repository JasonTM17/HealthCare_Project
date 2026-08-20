package com.healthcare.career.service;

import com.healthcare.career.dto.JobApplicationRequest;
import com.healthcare.career.dto.JobApplicationReceipt;
import com.healthcare.career.dto.JobPositionResponse;
import com.healthcare.career.entity.EmploymentType;
import com.healthcare.career.entity.JobApplication;
import com.healthcare.career.entity.JobPosition;
import com.healthcare.career.repository.JobApplicationRepository;
import com.healthcare.career.repository.JobPositionRepository;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class CareerService {

    private static final int DUPLICATE_WINDOW_DAYS = 7;
    private final JobPositionRepository jobPositionRepository;
    private final JobApplicationRepository jobApplicationRepository;

    public CareerService(
            JobPositionRepository jobPositionRepository,
            JobApplicationRepository jobApplicationRepository) {
        this.jobPositionRepository = jobPositionRepository;
        this.jobApplicationRepository = jobApplicationRepository;
    }

    @Transactional(readOnly = true)
    public Page<JobPositionResponse> listOpenPositions(
            String department,
            String location,
            Pageable pageable) {
        return jobPositionRepository.findOpenPositions(
            LocalDate.now(),
            normalizeFilter(department),
            normalizeFilter(location),
            pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public JobPositionResponse getOpenPosition(String slug) {
        return toResponse(requireOpenPosition(slug));
    }

    @Transactional
    public JobApplicationReceipt apply(String slug, JobApplicationRequest request) {
        JobPosition job = requireOpenPosition(slug);
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);

        if (jobApplicationRepository.existsByJobPositionIdAndEmailIgnoreCaseAndCreatedAtAfter(
                job.getId(), normalizedEmail, OffsetDateTime.now(ZoneOffset.UTC).minusDays(DUPLICATE_WINDOW_DAYS))) {
            throw new DuplicateResourceException(
                "Hồ sơ cho vị trí này đã được tiếp nhận gần đây. Vui lòng kiểm tra email hoặc liên hệ bộ phận tuyển dụng."
            );
        }

        JobApplication application = new JobApplication();
        application.setApplicationCode(newApplicationCode());
        application.setJobPosition(job);
        application.setFullName(request.fullName().trim());
        application.setEmail(normalizedEmail);
        application.setPhone(normalizePhone(request.phone()));
        application.setYearsExperience(request.yearsExperience());
        application.setCoverLetter(request.coverLetter().trim());
        application.setResumeUrl(blankToNull(request.resumeUrl()));
        JobApplication saved = jobApplicationRepository.save(application);

        return new JobApplicationReceipt(
            saved.getApplicationCode(),
            job.getTitle(),
            saved.getCreatedAt(),
            "Hồ sơ đã được tiếp nhận. Bộ phận tuyển dụng sẽ liên hệ nếu hồ sơ phù hợp."
        );
    }

    JobPosition requireOpenPosition(String slug) {
        JobPosition job = jobPositionRepository.findBySlug(slug)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vị trí tuyển dụng này."));
        if (!job.isActive() || (job.getDeadline() != null && job.getDeadline().isBefore(LocalDate.now()))) {
            throw new ResourceNotFoundException("Vị trí tuyển dụng này đã ngừng nhận hồ sơ.");
        }
        return job;
    }

    JobPositionResponse toResponse(JobPosition job) {
        return new JobPositionResponse(
            job.getId().toString(),
            job.getSlug(),
            job.getTitle(),
            job.getDepartment(),
            job.getLocation(),
            job.getEmploymentType().name(),
            employmentTypeLabel(job.getEmploymentType()),
            job.getSummary(),
            lines(job.getResponsibilities()),
            lines(job.getRequirements()),
            lines(job.getBenefits()),
            job.getDeadline(),
            job.isFeatured()
        );
    }

    private String newApplicationCode() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = "UV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            if (!jobApplicationRepository.existsByApplicationCode(code)) return code;
        }
        return "UV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private List<String> lines(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split("\\R+"))
            .map(String::trim)
            .filter(line -> !line.isEmpty())
            .toList();
    }

    private String employmentTypeLabel(EmploymentType employmentType) {
        return switch (employmentType) {
            case FULL_TIME -> "Toàn thời gian";
            case PART_TIME -> "Bán thời gian";
            case CONTRACT -> "Hợp đồng";
            case INTERNSHIP -> "Thực tập";
        };
    }

    private String normalizePhone(String phone) {
        return phone.trim().replaceAll("[ .-]", "");
    }

    private String normalizeFilter(String value) {
        String normalized = blankToNull(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
