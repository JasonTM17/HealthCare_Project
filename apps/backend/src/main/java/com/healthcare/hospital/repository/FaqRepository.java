package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Faq;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface FaqRepository extends JpaRepository<Faq, UUID> {
    Page<Faq> findByActiveTrue(Pageable pageable);

    /** Public FAQ material is governed by the same current clinical eligibility as RAG. */
    @Query(value = """
        SELECT DISTINCT f.*
          FROM faqs f
          JOIN ai_content_review_heads h
            ON h.source_type = 'FAQ' AND h.source_id = f.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer_user ON reviewer_user.id = r.reviewed_by
          JOIN user_roles reviewer_link ON reviewer_link.user_id = reviewer_user.id
          JOIN roles reviewer_role ON reviewer_role.id = reviewer_link.role_id
          JOIN doctors reviewer_doctor ON reviewer_doctor.user_id = reviewer_user.id
         WHERE f.active = TRUE
           AND h.eligibility_state = 'APPROVED' AND r.state = 'APPROVED'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND reviewer_user.status = 'ACTIVE' AND reviewer_doctor.active = TRUE
           AND reviewer_role.code = 'DOCTOR'
        ORDER BY f.updated_at DESC
        """,
        countQuery = """
        SELECT COUNT(DISTINCT f.id)
          FROM faqs f
          JOIN ai_content_review_heads h ON h.source_type = 'FAQ' AND h.source_id = f.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer_user ON reviewer_user.id = r.reviewed_by
          JOIN user_roles reviewer_link ON reviewer_link.user_id = reviewer_user.id
          JOIN roles reviewer_role ON reviewer_role.id = reviewer_link.role_id
          JOIN doctors reviewer_doctor ON reviewer_doctor.user_id = reviewer_user.id
         WHERE f.active = TRUE AND h.eligibility_state = 'APPROVED'
           AND r.state = 'APPROVED' AND r.expires_at > CURRENT_TIMESTAMP
           AND reviewer_user.status = 'ACTIVE' AND reviewer_doctor.active = TRUE
           AND reviewer_role.code = 'DOCTOR'
        """, nativeQuery = true)
    Page<Faq> findClinicallyEligibleActive(Pageable pageable);
}
