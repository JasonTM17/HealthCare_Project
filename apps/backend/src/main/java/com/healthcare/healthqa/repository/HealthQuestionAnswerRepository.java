package com.healthcare.healthqa.repository;

import com.healthcare.healthqa.entity.HealthQuestionAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HealthQuestionAnswerRepository extends JpaRepository<HealthQuestionAnswer, UUID> {

    Optional<HealthQuestionAnswer> findByIdAndDeletedAtIsNull(UUID id);

    List<HealthQuestionAnswer> findByQuestionIdAndDeletedAtIsNullOrderByRevisionDesc(UUID questionId);

    List<HealthQuestionAnswer> findByQuestionIdAndStatusAndDeletedAtIsNullOrderByRevisionDesc(UUID questionId, String status);

    List<HealthQuestionAnswer> findByDoctorUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID doctorUserId);

    Optional<HealthQuestionAnswer> findByQuestionIdAndRevision(UUID questionId, Integer revision);
}
