package com.healthcare.clinical.service;

import com.healthcare.security.HealthcareUserPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Append-only clinical access evidence. Rows record who touched which artifact
 * and the allow/deny decision. They must never copy diagnosis, notes, Rx lines,
 * or file bytes.
 */
@Service
public class ClinicalAccessAuditService {

    public static final String TARGET_MEDICAL_RECORD = "MEDICAL_RECORD";
    public static final String TARGET_PRESCRIPTION = "PRESCRIPTION";
    public static final String TARGET_DIAGNOSTIC = "DIAGNOSTIC";
    public static final String TARGET_FILE = "FILE";
    public static final String ACTION_READ = "READ";
    public static final String ACTION_DOWNLOAD = "DOWNLOAD";
    public static final String DECISION_ALLOW = "ALLOW";
    public static final String DECISION_DENY = "DENY";

    private final JdbcTemplate jdbcTemplate;

    public ClinicalAccessAuditService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void record(
            UserDetails principal,
            UUID patientId,
            String targetType,
            String targetId,
            String action,
            String decision) {
        jdbcTemplate.update(
            """
            insert into clinical_access_audit
                (id, actor_user_id, actor_email, actor_role, patient_id, target_type, target_id, action, decision)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            UUID.randomUUID(),
            actorUserId(principal),
            bound(actorEmail(principal), 320),
            bound(actorRole(principal), 32),
            patientId,
            bound(targetType, 32),
            bound(targetId, 128),
            bound(action, 32),
            bound(decision, 16)
        );
    }

    private UUID actorUserId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        return null;
    }

    private String actorEmail(UserDetails principal) {
        if (principal == null || principal.getUsername() == null || principal.getUsername().isBlank()) {
            return "anonymous";
        }
        return principal.getUsername();
    }

    private String actorRole(UserDetails principal) {
        if (principal == null) {
            return "ANONYMOUS";
        }
        for (String role : new String[] {"ADMIN", "DOCTOR", "PATIENT"}) {
            String expected = "ROLE_" + role;
            for (GrantedAuthority authority : principal.getAuthorities()) {
                if (expected.equals(authority.getAuthority())) {
                    return role;
                }
            }
        }
        return "UNKNOWN";
    }

    private String bound(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.substring(0, Math.min(maxLength, normalized.length()));
    }
}
