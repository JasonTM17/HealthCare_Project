package com.healthcare.ai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Materializes expired approval rounds for queue/audit consumers.  Resolver
 * authorization still checks database time directly, so a delayed scheduler
 * can never extend eligibility.
 */
@Service
public class AiClinicalReviewExpiryService {

    private final JdbcTemplate jdbc;
    private final AiClinicalOutboxService outboxService;

    /** Compatibility constructor retained for focused unit fixtures. */
    public AiClinicalReviewExpiryService(JdbcTemplate jdbc) {
        this(jdbc, null);
    }

    @Autowired
    public AiClinicalReviewExpiryService(JdbcTemplate jdbc, AiClinicalOutboxService outboxService) {
        this.jdbc = jdbc;
        this.outboxService = outboxService;
    }

    @Scheduled(fixedDelayString = "${ai.content-review.expiry-sweep-ms:300000}")
    public void scheduledSweep() {
        try {
            expireNow();
        } catch (RuntimeException ignored) {
            // Authorization remains fail-closed if the maintenance sweep is
            // temporarily unavailable; the next scheduled run retries.
        }
    }

    @Transactional
    public int expireNow() {
        List<Map<String, Object>> expired = jdbc.queryForList("""
            SELECT source_type, source_id, content_revision, content_hash,
                   eligibility_revision, current_approval_round
              FROM ai_content_review_heads
             WHERE eligibility_state = 'APPROVED'
               AND approval_expires_at <= CURRENT_TIMESTAMP
             ORDER BY approval_expires_at, source_type, source_id
             FOR UPDATE SKIP LOCKED
            """);
        int count = 0;
        for (Map<String, Object> row : expired) {
            String type = String.valueOf(row.get("source_type"));
            UUID sourceId = (UUID) row.get("source_id");
            long revision = number(row.get("content_revision"));
            long eligibility = number(row.get("eligibility_revision")) + 1L;
            Long round = row.get("current_approval_round") == null
                ? null : number(row.get("current_approval_round"));
            int updatedRound = jdbc.update("""
                UPDATE ai_content_approval_rounds
                   SET state = 'EXPIRED'
                 WHERE source_type = ? AND source_id = ?
                   AND content_revision = ? AND approval_round = ?
                   AND state = 'APPROVED'
                """, type, sourceId, revision, round);
            if (updatedRound != 1) continue;
            jdbc.update("""
                UPDATE ai_content_review_heads
                   SET eligibility_revision = ?, eligibility_state = 'EXPIRED'
                 WHERE source_type = ? AND source_id = ?
                   AND eligibility_state = 'APPROVED'
                """, eligibility, type, sourceId);
            jdbc.update("""
                INSERT INTO ai_content_review_events(
                    event_id, source_type, source_id, content_revision,
                    content_hash, eligibility_revision, approval_round,
                    event_type, actor_id, actor_role, correlation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'EXPIRED', NULL, 'SYSTEM', ?)
                """, UUID.randomUUID(), type, sourceId, revision,
                String.valueOf(row.get("content_hash")), eligibility, round,
                UUID.randomUUID());
            if (outboxService != null) {
                outboxService.append(
                    type, sourceId, revision, eligibility,
                    String.valueOf(row.get("content_hash")), "TOMBSTONE"
                );
            }
            count++;
        }
        return count;
    }

    private long number(Object value) {
        if (!(value instanceof Number number)) {
            throw new IllegalStateException("review revision is not numeric");
        }
        return number.longValue();
    }
}
