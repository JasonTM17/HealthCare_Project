package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.service.AdminArticleService;
import com.healthcare.hospital.service.AdminFaqService;
import com.healthcare.hospital.service.AdminSpecialtyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves the catalog-to-governance boundary on a real PostgreSQL transaction.
 * The AI service must never infer a clinical revision from an in-memory edit:
 * every create/update/delete writes an immutable snapshot, a current head,
 * an audit event, and a de-identified outbox row together (or none at all).
 */
class AiClinicalContentRevisionIntegrationTest extends AbstractIntegrationTest {

    @Autowired private AdminSpecialtyService specialtyService;
    @Autowired private AdminArticleService articleService;
    @Autowired private AdminFaqService faqService;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void catalogMutationsCreateImmutableRevisionsAndAtomicOutboxEvents() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String specialtySlug = "revision-specialty-" + suffix;
        String articleSlug = "revision-article-" + suffix;

        Specialty specialty = specialtyService.create(new SpecialtyRequest(
            "Revision Specialty " + suffix, specialtySlug, "Grounded description", true));
        Article article = articleService.create(new ArticleRequest(
            "Revision Article " + suffix, articleSlug, "Approved summary", "Approved body", true));
        Faq faq = faqService.create(new FaqRequest(
            "Revision FAQ " + suffix + "?", "Approved answer", true));

        assertGovernedRow("SPECIALTY", specialty.getId(), 1L, "UPSERT");
        assertGovernedRow("ARTICLE", article.getId(), 1L, "UPSERT");
        assertGovernedRow("FAQ", faq.getId(), 1L, "UPSERT");

        Specialty updated = specialtyService.update(specialtySlug,
            new SpecialtyRequest("Revision Specialty Updated " + suffix, specialtySlug,
                "Updated description", false));
        Map<String, Object> updatedHead = jdbcTemplate.queryForMap("""
            SELECT content_revision, eligibility_revision, eligibility_state
              FROM ai_content_review_heads
             WHERE source_type = 'SPECIALTY' AND source_id = ?
            """, updated.getId());
        assertThat(((Number) updatedHead.get("content_revision")).longValue()).isEqualTo(2L);
        assertThat(((Number) updatedHead.get("eligibility_revision")).longValue()).isEqualTo(2L);
        assertThat(updatedHead.get("eligibility_state")).isEqualTo("DRAFT");
        assertThat(jdbcTemplate.queryForObject("""
            SELECT count(*) FROM ai_content_revisions
             WHERE source_type = 'SPECIALTY' AND source_id = ?
            """, Long.class, updated.getId())).isEqualTo(2L);

        specialtyService.delete(specialtySlug, null);
        assertThat(jdbcTemplate.queryForObject("""
            SELECT operation FROM sync_outbox_events
             WHERE entity_classification = 'DEIDENTIFIED_CLINICAL'
               AND entity_type = 'specialty' AND entity_id = ?
             ORDER BY revision DESC LIMIT 1
            """, String.class, specialty.getId())).isEqualTo("TOMBSTONE");
        assertThat(specialtyRepository.findById(specialty.getId())).isEmpty();
    }

    @Test
    void catalogRevisionAndOutboxRollbackTogether() {
        String slug = "rollback-specialty-" + UUID.randomUUID().toString().replace("-", "");
        TransactionTemplate template = new TransactionTemplate(transactionManager);

        assertThatThrownBy(() -> template.executeWithoutResult(status -> {
            specialtyService.create(new SpecialtyRequest("Rollback Specialty", slug,
                "Should not persist", true));
            throw new IllegalStateException("forced revision transaction rollback");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(specialtyRepository.findBySlug(slug)).isEmpty();
        assertThat(jdbcTemplate.queryForObject("""
            SELECT count(*) FROM ai_content_revisions r
             JOIN specialties s ON s.id = r.source_id
             WHERE r.source_type = 'SPECIALTY' AND s.slug = ?
            """, Long.class, slug)).isZero();
        assertThat(jdbcTemplate.queryForObject("""
            SELECT count(*) FROM sync_outbox_events
             WHERE entity_type = 'specialty' AND entity_id NOT IN (
                 SELECT id FROM specialties
             ) AND occurred_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
            """, Long.class)).isZero();
    }

    private void assertGovernedRow(String sourceType, UUID sourceId, long revision, String operation) {
        Map<String, Object> revisionRow = jdbcTemplate.queryForMap("""
            SELECT content_revision, content_hash, jsonb_typeof(content_snapshot) AS snapshot_type
              FROM ai_content_revisions
             WHERE source_type = ? AND source_id = ? AND content_revision = ?
            """, sourceType, sourceId, revision);
        assertThat(((Number) revisionRow.get("content_revision")).longValue()).isEqualTo(revision);
        assertThat(String.valueOf(revisionRow.get("content_hash"))).matches("[0-9a-f]{64}");
        assertThat(revisionRow.get("snapshot_type")).isEqualTo("object");

        Map<String, Object> head = jdbcTemplate.queryForMap("""
            SELECT eligibility_state, eligibility_revision
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
            """, sourceType, sourceId);
        assertThat(head.get("eligibility_state")).isEqualTo("DRAFT");
        assertThat(((Number) head.get("eligibility_revision")).longValue()).isEqualTo(1L);

        Map<String, Object> outbox = jdbcTemplate.queryForMap("""
            SELECT operation, source_revision, eligibility_revision FROM sync_outbox_events
             WHERE entity_classification = 'DEIDENTIFIED_CLINICAL'
               AND entity_type = ? AND entity_id = ? AND revision = ?
            """, sourceType.toLowerCase(), sourceId, revision);
        assertThat(outbox.get("operation")).isEqualTo(operation);
        assertThat(((Number) outbox.get("source_revision")).longValue()).isEqualTo(revision);
        assertThat(((Number) outbox.get("eligibility_revision")).longValue()).isEqualTo(revision);
    }
}
