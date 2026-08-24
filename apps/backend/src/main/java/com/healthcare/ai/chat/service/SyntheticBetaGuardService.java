package com.healthcare.ai.chat.service;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Database-owned synthetic beta boundary for remote patient-chat egress.
 *
 * <p>The environment flag is only an additional deployment switch.  A remote
 * request gets the synthetic assertion only when the current guard is enabled,
 * unexpired, and the authenticated user's complete patient graph is marked
 * synthetic.  Any missing table/row or SQL error fails closed.</p>
 */
@Service
public class SyntheticBetaGuardService {

    private final JdbcTemplate jdbc;
    private final boolean available;

    public SyntheticBetaGuardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.available = true;
    }

    private SyntheticBetaGuardService() {
        this.jdbc = null;
        this.available = false;
    }

    /** Disabled compatibility instance used by isolated unit-test constructors. */
    public static SyntheticBetaGuardService disabled() {
        return new SyntheticBetaGuardService();
    }

    public boolean eligible(UUID userId) {
        if (!available || userId == null) {
            return false;
        }
        try {
            return guardEnabled() && userSynthetic(userId) && profilesSynthetic(userId) && appointmentsSynthetic(userId);
        } catch (DataAccessException ex) {
            // Do not expose SQL details and never fail open if V39 is missing,
            // partially migrated, or temporarily unavailable.
            return false;
        }
    }

    private boolean guardEnabled() {
        Boolean value = jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1
                FROM synthetic_beta_guard
                WHERE guard_id = TRUE
                  AND environment IN ('LOCAL', 'TEST', 'STAGING')
                  AND allowlist_state = 'ENABLED'
                  AND manifest_hash IS NOT NULL
                  AND rows_written < row_budget
                  AND expires_at > CURRENT_TIMESTAMP
            )
            """, Boolean.class);
        return Boolean.TRUE.equals(value);
    }

    private boolean userSynthetic(UUID userId) {
        Boolean value = jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM users
                WHERE id = ? AND synthetic_fixture = TRUE
            )
            """, Boolean.class, userId);
        return Boolean.TRUE.equals(value);
    }

    private boolean profilesSynthetic(UUID userId) {
        Boolean value = jdbc.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM patient_profiles
                WHERE user_id = ?
            )
            AND NOT EXISTS (
                SELECT 1 FROM patient_profiles
                WHERE user_id = ? AND COALESCE(synthetic_fixture, FALSE) = FALSE
            )
            """, Boolean.class, userId, userId);
        return Boolean.TRUE.equals(value);
    }

    private boolean appointmentsSynthetic(UUID userId) {
        Boolean value = jdbc.queryForObject("""
            SELECT NOT EXISTS (
                SELECT 1
                FROM appointments a
                JOIN patient_profiles p ON p.id = a.patient_id
                WHERE p.user_id = ?
                  AND COALESCE(a.synthetic_fixture, FALSE) = FALSE
            )
            """, Boolean.class, userId);
        return Boolean.TRUE.equals(value);
    }
}
