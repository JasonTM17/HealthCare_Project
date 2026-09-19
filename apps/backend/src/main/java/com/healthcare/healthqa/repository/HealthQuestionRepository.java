package com.healthcare.healthqa.repository;

import com.healthcare.healthqa.entity.HealthQuestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HealthQuestionRepository extends JpaRepository<HealthQuestion, UUID> {

    Optional<HealthQuestion> findByIdAndDeletedAtIsNull(UUID id);

    Page<HealthQuestion> findByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<HealthQuestion> findByTopicSlugAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
        String topicSlug, String status, Pageable pageable
    );

    List<HealthQuestion> findByAuthorUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID authorUserId);

    List<HealthQuestion> findByPatientProfileIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID patientProfileId);

    @Query("""
        SELECT q FROM HealthQuestion q
        WHERE q.deletedAt IS NULL
          AND q.status = 'PUBLISHED'
          AND (:topicSlug = '' OR q.topicSlug = :topicSlug)
          AND (:query = '' OR LOWER(q.normalizedQuestion) LIKE LOWER(CONCAT('%', :query, '%')))
        ORDER BY q.createdAt DESC
        """)
    Page<HealthQuestion> searchPublishedQuestions(
        @Param("topicSlug") String topicSlug,
        @Param("query") String query,
        Pageable pageable
    );
}
