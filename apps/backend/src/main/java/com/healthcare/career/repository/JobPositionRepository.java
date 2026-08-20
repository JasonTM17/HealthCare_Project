package com.healthcare.career.repository;

import com.healthcare.career.entity.JobPosition;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface JobPositionRepository extends JpaRepository<JobPosition, UUID> {

    Optional<JobPosition> findBySlug(String slug);

    @Query("""
        select job from JobPosition job
        where job.active = true
          and (job.deadline is null or job.deadline >= :today)
          and (:department is null or lower(job.department) = :department)
          and (:location is null or lower(job.location) = :location)
        order by job.featured desc, job.createdAt desc
        """)
    Page<JobPosition> findOpenPositions(
        @Param("today") LocalDate today,
        @Param("department") String department,
        @Param("location") String location,
        Pageable pageable
    );
}
