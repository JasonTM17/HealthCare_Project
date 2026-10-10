package com.healthcare.demo;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import com.healthcare.security.HealthcareUserPrincipal;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Validates the closed stored graph before a fixture-specific write or outbound side effect. */
@Component
public class DashboardDemonstrationGuard {
    private final JdbcTemplate jdbc;

    public DashboardDemonstrationGuard(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Keep the stable owner row locked until the decision transaction commits. */
    public void requireReviewer(UserDetails principal) {
        if (!(principal instanceof HealthcareUserPrincipal authenticated)
                || !DashboardDemonstration.OWNER_ADMIN.equals(authenticated.getUserId())
                || authenticated.isDemo()) {
            throw new AccessDeniedException("Chỉ quản trị viên được chỉ định được xử lý giao dịch minh họa này");
        }
        if (jdbc.queryForList("SELECT id FROM users WHERE id=? FOR SHARE", UUID.class,
                authenticated.getUserId()).size() != 1) {
            throw new AccessDeniedException("Quyền quản trị không còn hợp lệ");
        }
        // Read authority only after locking: an authenticated request may have waited
        // while governance revoked its status, role or security epoch.
        Boolean eligible = jdbc.queryForObject("""
            SELECT status='ACTIVE' AND email_verified AND NOT is_demo AND security_version=? AND EXISTS
              (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='ADMIN')
            FROM users u WHERE id=?
            """, Boolean.class, authenticated.getSecurityVersion(), authenticated.getUserId());
        if (!Boolean.TRUE.equals(eligible)) throw new AccessDeniedException("Quyền quản trị không còn hợp lệ");
    }

    /** Also covers delivery before a patient initializes the payment row. */
    public void requireOrdinaryTransferContent(String content) {
        for (String code : jdbc.queryForList("SELECT booking_code FROM appointments WHERE id=?", String.class,
                DashboardDemonstration.id("appointment"))) {
            if (("HC " + code.replace("APT-", "")).equals(content.trim())) {
                DashboardDemonstration.requireOrdinaryPayment(DashboardDemonstration.id("appointment"));
            }
        }
    }

    public void requireAppointment(UUID appointmentId) {
        if (!DashboardDemonstration.appointment(appointmentId)) return;
        Boolean valid = jdbc.queryForObject("""
            SELECT a.synthetic_fixture AND p.synthetic_fixture AND u.synthetic_fixture AND u.is_demo
              AND u.status='ACTIVE' AND u.email_verified
              AND a.patient_id=? AND p.user_id=? AND a.doctor_id=? AND a.branch_id=? AND a.package_id=?
              AND a.specialty_id IS NULL AND d.user_id IS NULL AND NOT d.active AND NOT b.active AND NOT pk.active
              AND pk.price>0 AND EXISTS (SELECT 1 FROM doctor_branches db WHERE db.doctor_id=d.id AND db.branch_id=b.id)
              AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='PATIENT')
              AND (SELECT count(*) FROM user_roles ur WHERE ur.user_id=u.id)=1
            FROM appointments a JOIN patient_profiles p ON p.id=a.patient_id JOIN users u ON u.id=p.user_id
              JOIN doctors d ON d.id=a.doctor_id JOIN branches b ON b.id=a.branch_id JOIN packages pk ON pk.id=a.package_id
            WHERE a.id=? FOR SHARE OF a,p,u,d,b,pk
            """, Boolean.class, DashboardDemonstration.id("patientProfile"), DashboardDemonstration.id("patientUser"),
            DashboardDemonstration.id("doctor"), DashboardDemonstration.id("branch"), DashboardDemonstration.id("package"), appointmentId);
        require(valid);
    }

    /** Foreign claimants/admins are suppressed, never redirected to the normal fan-out path. */
    public boolean allowNotification(UUID referenceId, UUID recipientId) {
        if (!DashboardDemonstration.notificationReference(referenceId)) {
            throw new IllegalArgumentException("Not a demonstration notification reference");
        }
        if (DashboardDemonstration.appointment(referenceId)) {
            requireAppointment(referenceId);
        } else {
            Boolean valid = jdbc.queryForObject("""
                SELECT q.synthetic_fixture AND p.synthetic_fixture AND u.synthetic_fixture AND u.is_demo
                  AND q.patient_profile_id=? AND q.author_user_id=? AND p.user_id=u.id
                  AND u.status='ACTIVE' AND u.email_verified
                  AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='PATIENT')
                  AND (SELECT count(*) FROM user_roles ur WHERE ur.user_id=u.id)=1
                FROM health_questions q JOIN patient_profiles p ON p.id=q.patient_profile_id
                  JOIN users u ON u.id=q.author_user_id WHERE q.id=? FOR SHARE OF q,p,u
                """, Boolean.class, DashboardDemonstration.id("patientProfile"), DashboardDemonstration.id("patientUser"), referenceId);
            require(valid);
        }
        if (DashboardDemonstration.id("patientUser").equals(recipientId)) return true;
        if (!DashboardDemonstration.OWNER_ADMIN.equals(recipientId)) return false;
        // Lock then read fresh role/status; account governance locks the same user before changing roles.
        if (jdbc.queryForList("SELECT id FROM users WHERE id=? FOR SHARE", UUID.class, recipientId).size() != 1) {
            require(false);
        }
        require(jdbc.queryForObject("""
            SELECT status='ACTIVE' AND email_verified AND NOT is_demo AND EXISTS
              (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='ADMIN')
            FROM users u WHERE id=?
            """, Boolean.class, recipientId));
        return true;
    }

    private static void require(Boolean valid) {
        if (!Boolean.TRUE.equals(valid)) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Dữ liệu minh họa không còn khớp cấu hình kiểm thử; không thể tiếp tục.");
    }
}
