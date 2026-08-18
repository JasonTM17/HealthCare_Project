package com.healthcare.career.repository;

import com.healthcare.career.entity.ApplicationStatus;
import com.healthcare.career.entity.JobApplication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface JobApplicationRepository extends JpaRepository<JobApplication, UUID> {

    boolean existsByApplicationCode(String applicationCode);

    boolean existsByJobPositionIdAndEmailIgnoreCaseAndCreatedAtAfter(
        UUID jobPositionId,
        String email,
        OffsetDateTime createdAfter
    );

    @Query("""
        select application from JobApplication application
        join fetch application.jobPosition job
        where (:status is null or application.status = :status)
        order by application.createdAt desc
        """)
    Page<JobApplication> findForAdmin(@Param("status") ApplicationStatus status, Pageable pageable);
}
