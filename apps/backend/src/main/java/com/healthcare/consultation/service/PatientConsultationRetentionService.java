package com.healthcare.consultation.service;

import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Retention authority for private consultation/Q&amp;A content.
 *
 * The cleanup GUC is set only inside the transaction so immutable-content and
 * append-only audit triggers remain closed to ordinary application writes.
 * Consultation audit events survive a thread delete through V40's nullable
 * SET NULL foreign key; message, attachment and participant rows do not.
 */
@Service
public class PatientConsultationRetentionService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final boolean enabled;
    private final int batchSize;
    private final int maxBatches;

    public PatientConsultationRetentionService(
            JdbcTemplate jdbc,
            UserRepository users,
            @Value("${patient.consultation.cleanup-enabled:true}") boolean enabled,
            @Value("${patient.consultation.cleanup-batch-size:100}") int batchSize,
            @Value("${patient.consultation.cleanup-max-batches:20}") int maxBatches) {
        this.jdbc = jdbc;
        this.users = users;
        this.enabled = enabled;
        this.batchSize = Math.max(1, Math.min(batchSize, 500));
        this.maxBatches = Math.max(1, Math.min(maxBatches, 100));
    }

    /** Daily bounded sweep; a failed batch rolls back without partial content. */
    @Scheduled(cron = "${patient.consultation.cleanup-cron:0 35 3 * * *}")
    @Transactional
    public int purgeExpired() {
        if (!enabled) return 0;
        jdbc.execute("SET LOCAL healthcare.retention_cleanup = 'on'");
        int removed = 0;
        for (int batch = 0; batch < maxBatches; batch++) {
            List<UUID> threads = jdbc.query("""
                SELECT id FROM patient_consultation_threads
                 WHERE retention_expires_at <= CURRENT_TIMESTAMP
                 ORDER BY retention_expires_at ASC, id ASC
                 LIMIT ?
                """, (rs, n) -> rs.getObject("id", UUID.class), batchSize);
            if (threads.isEmpty()) break;
            for (UUID thread : threads) {
                removed += deleteThread(thread, null);
            }
            if (threads.size() < batchSize) break;
        }
        // Q&amp;A has independent retention and no patient-facing audit thread.
        jdbc.update("DELETE FROM health_questions WHERE retention_expires_at <= CURRENT_TIMESTAMP");
        return removed;
    }

    /** Immediate patient privacy deletion for one owned consultation thread. */
    @Transactional
    public void deleteForPatient(UUID threadId, UserDetails principal) {
        UUID userId = currentUserId(principal);
        jdbc.execute("SET LOCAL healthcare.retention_cleanup = 'on'");
        int deleted = deleteThread(threadId, userId);
        if (deleted == 0) throw notFound();
    }

    private int deleteThread(UUID threadId, UUID ownerUserId) {
        String sql = ownerUserId == null
            ? "DELETE FROM patient_consultation_threads WHERE id = ?"
            : "DELETE FROM patient_consultation_threads t USING patient_profiles p "
                + "WHERE t.id = ? AND p.id = t.patient_profile_id AND p.user_id = ?";
        return ownerUserId == null
            ? jdbc.update(sql, threadId)
            : jdbc.update(sql, threadId, ownerUserId);
    }

    private UUID currentUserId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal hp) return hp.getUserId();
        if (principal == null) throw new AccessDeniedException("Authentication required");
        return users.findByEmail(principal.getUsername()).map(User::getId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user unavailable"));
    }

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("CONSULTATION_NOT_FOUND", "Không tìm thấy tư vấn");
    }
}
