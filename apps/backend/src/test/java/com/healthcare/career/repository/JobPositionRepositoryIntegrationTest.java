package com.healthcare.career.repository;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.career.entity.EmploymentType;
import com.healthcare.career.entity.JobPosition;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class JobPositionRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Test
    void listsOpenPositionsWhenOptionalFiltersAreAbsent() {
        JobPosition position = new JobPosition();
        position.setSlug("dieu-duong-da-khoa");
        position.setTitle("Điều dưỡng đa khoa");
        position.setDepartment("Khối Điều dưỡng");
        position.setLocation("Bệnh viện Trung tâm");
        position.setEmploymentType(EmploymentType.FULL_TIME);
        position.setSummary("Chăm sóc người bệnh theo phân công.");
        position.setResponsibilities("Tiếp nhận người bệnh");
        position.setRequirements("Tốt nghiệp chuyên ngành Điều dưỡng");
        position.setBenefits("Được hướng dẫn khi nhận việc");
        position.setActive(true);
        jobPositionRepository.saveAndFlush(position);

        var result = jobPositionRepository.findOpenPositions(
            LocalDate.now(), null, null, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(JobPosition::getSlug)
            .containsExactly("dieu-duong-da-khoa");
    }
}
