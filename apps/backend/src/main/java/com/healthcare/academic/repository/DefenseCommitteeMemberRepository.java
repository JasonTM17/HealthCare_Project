package com.healthcare.academic.repository;

import com.healthcare.academic.entity.DefenseCommitteeMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DefenseCommitteeMemberRepository extends JpaRepository<DefenseCommitteeMember, UUID> {

    @Query("SELECT m FROM DefenseCommitteeMember m WHERE m.thesis.id = :thesisId ORDER BY m.committeeRole ASC")
    List<DefenseCommitteeMember> findByThesisId(@Param("thesisId") UUID thesisId);

    Optional<DefenseCommitteeMember> findByThesisIdAndLecturerId(UUID thesisId, UUID lecturerId);

    List<DefenseCommitteeMember> findByLecturerId(UUID lecturerId);
}
