package com.healthcare.hospital;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Public medical trust labels must never outlive database-owned review eligibility. */
class PublicClinicalContentEligibilityIntegrationTest extends TestcontainersIntegrationTest {

    @Test
    void diseaseGuideIsHiddenUntilApprovedAndDisappearsImmediatelyAfterExpiry() throws Exception {
        UUID guideId = UUID.randomUUID();
        String guideSlug = "huong-dan-benh-tim-mach";
        jdbcTemplate.update("""
            INSERT INTO articles(
                id, title, slug, summary, body, content_kind, published_at, active)
            VALUES (?, ?, ?, ?, ?, 'DISEASE_GUIDE', CURRENT_TIMESTAMP, TRUE)
            """, guideId, "Huong dan benh tim mach", guideSlug,
            "Noi dung thu nghiem tong hop", "Noi dung chi dung cho kiem thu synthetic.");

        mockMvc.perform(get("/api/v1/hospital/articles")
                .param("contentKind", "DISEASE_GUIDE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/v1/hospital/articles/{slug}", guideSlug))
            .andExpect(status().isNotFound());

        approve("ARTICLE", guideId);
        mockMvc.perform(get("/api/v1/hospital/articles")
                .param("contentKind", "DISEASE_GUIDE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].slug").value(guideSlug));
        mockMvc.perform(get("/api/v1/hospital/articles/{slug}", guideSlug))
            .andExpect(status().isOk());

        jdbcTemplate.update("""
            UPDATE ai_content_approval_rounds
               SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
             WHERE source_type = 'ARTICLE' AND source_id = ? AND approval_round = 1
            """, guideId);

        mockMvc.perform(get("/api/v1/hospital/articles")
                .param("contentKind", "DISEASE_GUIDE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/v1/hospital/articles/{slug}", guideSlug))
            .andExpect(status().isNotFound());
    }

    @Test
    void faqIsHiddenUntilApprovedAndDisappearsImmediatelyAfterRevoke() throws Exception {
        UUID faqId = UUID.randomUUID();
        jdbcTemplate.update("""
            INSERT INTO faqs(id, question, answer, active)
            VALUES (?, ?, ?, TRUE)
            """, faqId, "Khi nao can di kham?", "Hay den co so y te khi co dau hieu canh bao.");

        mockMvc.perform(get("/api/v1/hospital/faqs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(0));

        ApprovalFixture approval = approve("FAQ", faqId);
        mockMvc.perform(get("/api/v1/hospital/faqs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].id").value(faqId.toString()));

        jdbcTemplate.update("""
            UPDATE ai_content_approval_rounds
               SET state = 'REVOKED', reviewed_by = ?, reviewer_role = 'DOCTOR',
                   decided_at = CURRENT_TIMESTAMP, expires_at = NULL,
                   reason = 'Synthetic safety revocation'
             WHERE source_type = 'FAQ' AND source_id = ? AND approval_round = 1
            """, approval.reviewerId(), faqId);
        jdbcTemplate.update("""
            UPDATE ai_content_review_heads
               SET eligibility_revision = eligibility_revision + 1,
                   eligibility_state = 'REVOKED', approved_at = NULL,
                   approval_expires_at = NULL
             WHERE source_type = 'FAQ' AND source_id = ?
            """, faqId);

        mockMvc.perform(get("/api/v1/hospital/faqs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(0));
    }

    private ApprovalFixture approve(String sourceType, UUID sourceId) {
        User submitter = user("ADMIN");
        User reviewer = user("DOCTOR");
        Doctor doctor = new Doctor();
        doctor.setFullName("Bac si kiem duyet synthetic");
        doctor.setSlug("reviewer-" + UUID.randomUUID());
        doctor.setUserId(reviewer.getId());
        doctor.setActive(true);
        doctorRepository.saveAndFlush(doctor);

        jdbcTemplate.update("""
            WITH snapshot AS (
                SELECT jsonb_build_object('id', ?::text, 'active', true) AS value
            )
            INSERT INTO ai_content_revisions(
                source_type, source_id, content_revision, content_hash,
                content_snapshot, created_by)
            SELECT ?, ?, 1,
                   encode(digest(convert_to(value::text, 'UTF8'), 'sha256'), 'hex'),
                   value, ?
              FROM snapshot
            """, sourceId, sourceType, sourceId, submitter.getId());
        jdbcTemplate.update("""
            INSERT INTO ai_content_review_heads(
                source_type, source_id, content_revision, content_hash,
                eligibility_revision, eligibility_state, current_approval_round,
                edited_by, submitted_at, approved_at, approval_expires_at)
            SELECT source_type, source_id, content_revision, content_hash,
                   2, 'APPROVED', 1, ?, CURRENT_TIMESTAMP,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '180 days'
              FROM ai_content_revisions
             WHERE source_type = ? AND source_id = ? AND content_revision = 1
            """, submitter.getId(), sourceType, sourceId);
        jdbcTemplate.update("""
            INSERT INTO ai_content_approval_rounds(
                source_type, source_id, content_revision, content_hash,
                approval_round, state, submitted_by, reviewed_by,
                reviewer_role, submitted_at, decided_at, expires_at)
            SELECT source_type, source_id, content_revision, content_hash,
                   1, 'APPROVED', ?, ?, 'DOCTOR', CURRENT_TIMESTAMP,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '180 days'
              FROM ai_content_revisions
             WHERE source_type = ? AND source_id = ? AND content_revision = 1
            """, submitter.getId(), reviewer.getId(), sourceType, sourceId);
        return new ApprovalFixture(reviewer.getId());
    }

    private User user(String roleCode) {
        User user = new User();
        user.setEmail(roleCode.toLowerCase() + "." + UUID.randomUUID() + "@example.test");
        user.setPasswordHash("synthetic-only");
        user.setDisplayName("Synthetic " + roleCode);
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        User saved = userRepository.saveAndFlush(user);
        jdbcTemplate.update("""
            INSERT INTO user_roles(user_id, role_id)
            SELECT ?, id FROM roles WHERE code = ?
            """, saved.getId(), roleCode);
        return saved;
    }

    private record ApprovalFixture(UUID reviewerId) {}
}
