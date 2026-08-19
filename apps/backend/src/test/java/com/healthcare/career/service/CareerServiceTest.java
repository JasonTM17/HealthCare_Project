package com.healthcare.career.service;

import com.healthcare.career.dto.JobApplicationRequest;
import com.healthcare.career.entity.EmploymentType;
import com.healthcare.career.entity.JobApplication;
import com.healthcare.career.entity.JobPosition;
import com.healthcare.career.repository.JobApplicationRepository;
import com.healthcare.career.repository.JobPositionRepository;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CareerServiceTest {

    @Mock private JobPositionRepository jobPositionRepository;
    @Mock private JobApplicationRepository jobApplicationRepository;
    private CareerService careerService;
    private JobPosition openPosition;

    @BeforeEach
    void setUp() {
        careerService = new CareerService(jobPositionRepository, jobApplicationRepository);
        openPosition = new JobPosition();
        openPosition.setId(UUID.randomUUID());
        openPosition.setSlug("dieu-duong-da-khoa");
        openPosition.setTitle("Điều dưỡng đa khoa");
        openPosition.setDepartment("Khối Điều dưỡng");
        openPosition.setLocation("Bệnh viện Trung tâm");
        openPosition.setEmploymentType(EmploymentType.FULL_TIME);
        openPosition.setSummary("Chăm sóc người bệnh theo phân công.");
        openPosition.setResponsibilities("Tiếp nhận người bệnh\nBàn giao đầy đủ");
        openPosition.setRequirements("Tốt nghiệp chuyên ngành Điều dưỡng");
        openPosition.setBenefits("Được hướng dẫn khi nhận việc");
        openPosition.setActive(true);
    }

    @Test
    void applyPersistsNormalizedApplicantAndReturnsReceiptCode() {
        when(jobPositionRepository.findBySlug(openPosition.getSlug())).thenReturn(Optional.of(openPosition));
        when(jobApplicationRepository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        JobApplicationRequest request = new JobApplicationRequest(
            "  Nguyễn Thị Minh  ",
            "  MINH@example.com ",
            "0901 234 567",
            3,
            "Tôi có kinh nghiệm chăm sóc người bệnh và mong muốn đồng hành lâu dài.",
            "https://example.com/cv/minh",
            true
        );

        var receipt = careerService.apply(openPosition.getSlug(), request);

        ArgumentCaptor<JobApplication> captor = ArgumentCaptor.forClass(JobApplication.class);
        verify(jobApplicationRepository).save(captor.capture());
        assertThat(captor.getValue().getFullName()).isEqualTo("Nguyễn Thị Minh");
        assertThat(captor.getValue().getEmail()).isEqualTo("minh@example.com");
        assertThat(captor.getValue().getPhone()).isEqualTo("0901234567");
        assertThat(receipt.applicationCode()).startsWith("UV-");
        assertThat(receipt.jobTitle()).isEqualTo("Điều dưỡng đa khoa");
    }

    @Test
    void recentDuplicateApplicationIsRejectedWithoutPersistingPiiAgain() {
        when(jobPositionRepository.findBySlug(openPosition.getSlug())).thenReturn(Optional.of(openPosition));
        when(jobApplicationRepository.existsByJobPositionIdAndEmailIgnoreCaseAndCreatedAtAfter(
            any(UUID.class), any(String.class), any()
        )).thenReturn(true);
        JobApplicationRequest request = new JobApplicationRequest(
            "Nguyễn Thị Minh", "minh@example.com", "0901234567", null,
            "Tôi mong muốn đồng hành cùng đội ngũ chăm sóc người bệnh.", "", true
        );

        assertThatThrownBy(() -> careerService.apply(openPosition.getSlug(), request))
            .isInstanceOf(DuplicateResourceException.class)
            .hasMessageContaining("đã được tiếp nhận");
        verify(jobApplicationRepository, never()).save(any());
    }

    @Test
    void expiredPositionCannotReceiveApplications() {
        openPosition.setDeadline(LocalDate.now().minusDays(1));
        when(jobPositionRepository.findBySlug(openPosition.getSlug())).thenReturn(Optional.of(openPosition));
        JobApplicationRequest request = new JobApplicationRequest(
            "Nguyễn Thị Minh", "minh@example.com", "0901234567", null,
            "Tôi mong muốn đồng hành cùng đội ngũ chăm sóc người bệnh.", "", true
        );

        assertThatThrownBy(() -> careerService.apply(openPosition.getSlug(), request))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("ngừng nhận hồ sơ");
        verify(jobApplicationRepository, never()).save(any());
    }

    @Test
    void listOpenPositionsNormalizesOptionalFiltersBeforeRepositoryQuery() {
        var pageable = PageRequest.of(0, 30);
        when(jobPositionRepository.findOpenPositions(any(LocalDate.class), any(), any(), eq(pageable)))
            .thenReturn(Page.empty(pageable));

        careerService.listOpenPositions("  Khối Điều Dưỡng  ", " BỆNH VIỆN ", pageable);

        verify(jobPositionRepository).findOpenPositions(
            any(LocalDate.class),
            eq("khối điều dưỡng"),
            eq("bệnh viện"),
            eq(pageable)
        );
    }
}
