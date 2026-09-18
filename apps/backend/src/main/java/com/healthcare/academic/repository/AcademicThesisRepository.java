package com.healthcare.academic.repository;

import com.healthcare.academic.entity.AcademicThesis;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AcademicThesisRepository extends JpaRepository<AcademicThesis, UUID> {

    Optional<AcademicThesis> findByTopicCode(String topicCode);

    @Query("""
        SELECT t FROM AcademicThesis t
        WHERE t.primarySupervisor.id = :supervisorId
          AND (:status IS NULL OR :status = '' OR t.status = :status)
          AND (:academicYear IS NULL OR :academicYear = '' OR t.academicYear = :academicYear)
        ORDER BY t.createdAt DESC
    """)
    Page<AcademicThesis> findBySupervisorWithFilters(
        @Param("supervisorId") UUID supervisorId,
        @Param("status") String status,
        @Param("academicYear") String academicYear,
        Pageable pageable
    );

    @Query("""
        SELECT t FROM AcademicThesis t
        WHERE (:status IS NULL OR :status = '' OR t.status = :status)
          AND (:academicYear IS NULL OR :academicYear = '' OR t.academicYear = :academicYear)
        ORDER BY t.createdAt DESC
    """)
    Page<AcademicThesis> findAllWithFilters(
        @Param("status") String status,
        @Param("academicYear") String academicYear,
        Pageable pageable
    );

    long countByPrimarySupervisorIdAndStatusNot(UUID supervisorId, String status);
}
