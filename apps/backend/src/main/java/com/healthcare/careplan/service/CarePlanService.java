package com.healthcare.careplan.service;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CarePlanService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public CarePlanService(JdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    @Transactional
    public CarePlanContracts.Plan create(CarePlanContracts.CreateRequest request, UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID doctorId = doctorIdForUser(userId);
        Map<String, Object> appointment;
        try {
            appointment = jdbc.queryForMap("""
                SELECT a.patient_id, a.doctor_id, a.status
                  FROM appointments a
                  JOIN doctors d ON d.id = a.doctor_id
                 WHERE a.id = ? AND d.user_id = ? AND d.active
                """, request.appointmentId(), userId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
        if (!doctorId.equals(appointment.get("doctor_id"))) throw notFound();
        if (!List.of("CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED").contains(String.valueOf(appointment.get("status")))) {
            throw new BusinessException(409, "CARE_PLAN_APPOINTMENT_NOT_ELIGIBLE", "Lịch hẹn chưa đủ điều kiện tạo kế hoạch chăm sóc");
        }
        UUID planId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO patient_care_plans(id, patient_profile_id, appointment_id, doctor_id, title)
            VALUES (?, ?, ?, ?, ?)
            """, planId, appointment.get("patient_id"), request.appointmentId(), doctorId, request.title().trim());
        int sequence = 1;
        for (CarePlanContracts.ItemRequest item : request.items()) {
            jdbc.update("""
                INSERT INTO patient_care_plan_items(
                    care_plan_id, patient_profile_id, appointment_id, doctor_id,
                    sequence_number, goal, reminder, due_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, planId, appointment.get("patient_id"), request.appointmentId(), doctorId,
                sequence++, item.goal().trim(), blankToNull(item.reminder()), item.dueAt());
        }
        return getPlan(planId, userId, false);
    }

    @Transactional(readOnly = true)
    public List<CarePlanContracts.Plan> patientPlans(UserDetails principal) {
        UUID userId = currentUser(principal);
        return plans("p.patient_profile_id IN (SELECT id FROM patient_profiles WHERE user_id = ?)", userId);
    }

    @Transactional(readOnly = true)
    public List<CarePlanContracts.Plan> doctorPlans(UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID doctorId = doctorIdForUser(userId);
        return plans("p.doctor_id = ?", doctorId);
    }

    @Transactional
    public CarePlanContracts.Item complete(UUID itemId, UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID profile = profileForUser(userId);
        int changed = jdbc.update("""
            UPDATE patient_care_plan_items
               SET status = 'DONE', completed_at = CURRENT_TIMESTAMP
             WHERE id = ? AND patient_profile_id = ? AND status = 'OPEN'
               AND retention_expires_at > CURRENT_TIMESTAMP
            """, itemId, profile);
        if (changed == 0) throw notFound();
        jdbc.update("""
            UPDATE patient_care_plans p
               SET status = CASE WHEN NOT EXISTS (
                   SELECT 1 FROM patient_care_plan_items i
                    WHERE i.care_plan_id = p.id AND i.status = 'OPEN'
               ) THEN 'DONE' ELSE p.status END
             WHERE p.id = (SELECT care_plan_id FROM patient_care_plan_items WHERE id = ?)
               AND p.retention_expires_at > CURRENT_TIMESTAMP
            """, itemId);
        return jdbc.queryForObject("""
            SELECT id, sequence_number, goal, reminder, status, due_at, completed_at
              FROM patient_care_plan_items
             WHERE id = ? AND patient_profile_id = ? AND retention_expires_at > CURRENT_TIMESTAMP
            """, (rs, n) -> new CarePlanContracts.Item(
                rs.getObject("id", UUID.class), rs.getInt("sequence_number"), rs.getString("goal"),
                rs.getString("reminder"), rs.getString("status"), rs.getObject("due_at", OffsetDateTime.class),
                rs.getObject("completed_at", OffsetDateTime.class)), itemId, profile);
    }

    private List<CarePlanContracts.Plan> plans(String predicate, Object... args) {
        List<Map<String, Object>> planRows = jdbc.queryForList("""
            SELECT p.id, p.appointment_id, p.doctor_id, d.full_name doctor_name,
                   p.title, p.status, p.starts_at, p.ends_at
              FROM patient_care_plans p
              JOIN doctors d ON d.id = p.doctor_id
             WHERE p.deleted_at IS NULL AND p.retention_expires_at > CURRENT_TIMESTAMP
             """ + " AND " + predicate + " ORDER BY p.updated_at DESC", args);
        List<CarePlanContracts.Plan> result = new ArrayList<>();
        for (Map<String, Object> row : planRows) {
            UUID id = (UUID) row.get("id");
            List<CarePlanContracts.Item> items = jdbc.query("""
                SELECT id, sequence_number, goal, reminder, status, due_at, completed_at
                  FROM patient_care_plan_items
                 WHERE care_plan_id = ? AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
                 ORDER BY sequence_number ASC
                """, (rs, n) -> new CarePlanContracts.Item(
                    rs.getObject("id", UUID.class), rs.getInt("sequence_number"), rs.getString("goal"),
                    rs.getString("reminder"), rs.getString("status"), rs.getObject("due_at", OffsetDateTime.class),
                    rs.getObject("completed_at", OffsetDateTime.class)), id);
            result.add(mapPlan(row, items));
        }
        return result;
    }

    private CarePlanContracts.Plan getPlan(UUID planId, UUID actor, boolean patient) {
        String predicate = patient
            ? "p.id = ? AND p.patient_profile_id IN (SELECT id FROM patient_profiles WHERE user_id = ?)"
            : "p.id = ? AND (p.doctor_id IN (SELECT id FROM doctors WHERE user_id = ?) OR p.patient_profile_id IN (SELECT id FROM patient_profiles WHERE user_id = ?))";
        Object[] args = patient ? new Object[]{planId, actor} : new Object[]{planId, actor, actor};
        List<CarePlanContracts.Plan> values = plans(predicate, args);
        if (values.isEmpty()) throw notFound();
        return values.get(0);
    }

    private CarePlanContracts.Plan mapPlan(Map<String, Object> row, List<CarePlanContracts.Item> items) {
        return new CarePlanContracts.Plan((UUID) row.get("id"), (UUID) row.get("appointment_id"),
            (UUID) row.get("doctor_id"), String.valueOf(row.get("doctor_name")), String.valueOf(row.get("title")),
            String.valueOf(row.get("status")), (OffsetDateTime) row.get("starts_at"), (OffsetDateTime) row.get("ends_at"), items);
    }

    private UUID profileForUser(UUID userId) {
        try { return jdbc.queryForObject("SELECT id FROM patient_profiles WHERE user_id = ?", UUID.class, userId); }
        catch (DataAccessException ex) { throw new AccessDeniedException("Patient profile unavailable"); }
    }

    private UUID doctorIdForUser(UUID userId) {
        try {
            return jdbc.queryForObject("""
                SELECT d.id FROM doctors d
                JOIN users u ON u.id = d.user_id
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE d.user_id = ? AND d.active AND u.status = 'ACTIVE' AND r.code = 'DOCTOR'
                """, UUID.class, userId);
        } catch (DataAccessException ex) { throw new AccessDeniedException("Doctor authentication required"); }
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private UUID currentUser(UserDetails principal) {
        if (principal == null) throw new AccessDeniedException("Authentication required");
        if (principal instanceof HealthcareUserPrincipal hp) return hp.getUserId();
        return users.findByEmail(principal.getUsername()).map(User::getId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user unavailable"));
    }

    private ResourceNotFoundException notFound() { return new ResourceNotFoundException("CARE_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch chăm sóc"); }
}
