package com.healthcare.careplan.service;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CarePlanService {
    private static final List<String> ELIGIBLE_APPOINTMENT_STATUSES =
        List.of("CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED");

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final NotificationService notifications;

    public CarePlanService(JdbcTemplate jdbc, UserRepository users, NotificationService notifications) {
        this.jdbc = jdbc;
        this.users = users;
        this.notifications = notifications;
    }

    @Transactional
    public CarePlanContracts.Plan create(CarePlanContracts.CreateRequest request, UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID doctorId = doctorIdForUser(userId);
        Map<String, Object> appointment;
        try {
            appointment = jdbc.queryForMap("""
                SELECT a.patient_id, pp.user_id AS patient_user_id, a.doctor_id, a.status
                  FROM appointments a
                  JOIN patient_profiles pp ON pp.id = a.patient_id
                  JOIN doctors d ON d.id = a.doctor_id
                 WHERE a.id = ? AND d.user_id = ? AND d.active
                """, request.appointmentId(), userId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
        if (!doctorId.equals(appointment.get("doctor_id"))) throw notFound();
        if (!ELIGIBLE_APPOINTMENT_STATUSES.contains(String.valueOf(appointment.get("status")))) {
            throw new BusinessException(409, "CARE_PLAN_APPOINTMENT_NOT_ELIGIBLE",
                "Lịch hẹn chưa đủ điều kiện tạo kế hoạch chăm sóc");
        }

        UUID planId = UUID.randomUUID();
        String title = trimRequired(request.title(), "CARE_PLAN_TITLE_REQUIRED", "Tên kế hoạch không được để trống");
        jdbc.update("""
            INSERT INTO patient_care_plans(id, patient_profile_id, appointment_id, doctor_id, title)
            VALUES (?, ?, ?, ?, ?)
            """, planId, appointment.get("patient_id"), request.appointmentId(), doctorId, title);
        int sequence = 1;
        for (CarePlanContracts.ItemRequest item : request.items()) {
            insertItem(planId, (UUID) appointment.get("patient_id"), request.appointmentId(), doctorId,
                sequence++, item.goal(), item.reminder(), item.dueAt());
        }
        notifyUser((UUID) appointment.get("patient_user_id"), EventType.CARE_PLAN_CREATED,
            "Kế hoạch chăm sóc mới", "Bác sĩ đã tạo kế hoạch \"" + title + "\" cho lịch hẹn của bạn.", planId);
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
    public CarePlanContracts.Plan update(
            UUID planId,
            CarePlanContracts.UpdateRequest request,
            UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID doctorId = doctorIdForUser(userId);
        Map<String, Object> plan = planForDoctor(planId, doctorId);
        requireOpenPlan(plan);

        jdbc.update("""
            UPDATE patient_care_plans
               SET title = ?
             WHERE id = ? AND doctor_id = ?
               AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
            """, trimRequired(request.title(), "CARE_PLAN_TITLE_REQUIRED", "Tên kế hoạch không được để trống"),
            planId, doctorId);

        int nextSequence = nextSequence(planId);
        Set<UUID> seen = new HashSet<>();
        for (CarePlanContracts.ItemUpdateRequest item : request.items()) {
            if (item.id() == null) {
                insertItem(planId, (UUID) plan.get("patient_profile_id"), (UUID) plan.get("appointment_id"), doctorId,
                    nextSequence++, item.goal(), item.reminder(), item.dueAt());
            } else {
                if (!seen.add(item.id())) {
                    throw new BusinessException(400, "CARE_PLAN_ITEM_DUPLICATE",
                        "Một mục chăm sóc bị gửi trùng trong yêu cầu.");
                }
                updateOpenItem(planId, doctorId, item);
            }
        }
        return getPlan(planId, userId, false);
    }

    @Transactional
    public void delete(UUID planId, UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID doctorId = doctorIdForUser(userId);
        int changed = jdbc.update("""
            UPDATE patient_care_plans
               SET deleted_at = CURRENT_TIMESTAMP,
                   status = CASE WHEN status = 'OPEN' THEN 'CANCELLED' ELSE status END
             WHERE id = ? AND doctor_id = ?
               AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
            """, planId, doctorId);
        if (changed == 0) throw notFound();
        jdbc.update("""
            UPDATE patient_care_plan_items
               SET deleted_at = CURRENT_TIMESTAMP,
                   status = CASE WHEN status = 'OPEN' THEN 'CANCELLED' ELSE status END
             WHERE care_plan_id = ? AND doctor_id = ?
               AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
            """, planId, doctorId);
    }

    @Transactional
    public CarePlanContracts.Item complete(UUID itemId, UserDetails principal) {
        UUID userId = currentUser(principal);
        UUID profile = profileForUser(userId);
        Map<String, Object> target = itemForPatient(itemId, profile);
        updateOpenItemStatus(itemId, "DONE", "i.patient_profile_id = ?", profile);
        refreshPlanStatus((UUID) target.get("care_plan_id"));
        notifyUser((UUID) target.get("doctor_user_id"), EventType.CARE_PLAN_ITEM_COMPLETED,
            "Bệnh nhân hoàn tất mục chăm sóc",
            "Bệnh nhân đã đánh dấu hoàn tất: " + String.valueOf(target.get("goal")), itemId);
        return itemForPatientResponse(itemId, profile);
    }

    @Transactional
    public CarePlanContracts.Item doctorComplete(UUID itemId, UserDetails principal) {
        return doctorUpdateItemStatus(itemId, principal, "DONE", EventType.CARE_PLAN_ITEM_COMPLETED,
            "Mục chăm sóc đã hoàn tất", "Bác sĩ đã đánh dấu hoàn tất: ");
    }

    @Transactional
    public CarePlanContracts.Item doctorCancel(UUID itemId, UserDetails principal) {
        return doctorUpdateItemStatus(itemId, principal, "CANCELLED", EventType.CARE_PLAN_ITEM_CANCELLED,
            "Mục chăm sóc đã hủy", "Bác sĩ đã hủy mục: ");
    }

    private CarePlanContracts.Item doctorUpdateItemStatus(
            UUID itemId,
            UserDetails principal,
            String status,
            EventType eventType,
            String notificationTitle,
            String notificationMessagePrefix) {
        UUID userId = currentUser(principal);
        UUID doctorId = doctorIdForUser(userId);
        Map<String, Object> target = itemForDoctor(itemId, doctorId);
        requireOpenPlan(target);
        updateOpenItemStatus(itemId, status, "i.doctor_id = ?", doctorId);
        refreshPlanStatus((UUID) target.get("care_plan_id"));
        notifyUser((UUID) target.get("patient_user_id"), eventType, notificationTitle,
            notificationMessagePrefix + String.valueOf(target.get("goal")), itemId);
        return itemForDoctorResponse(itemId, doctorId);
    }

    private void insertItem(
            UUID planId,
            UUID patientProfileId,
            UUID appointmentId,
            UUID doctorId,
            int sequence,
            String goal,
            String reminder,
            OffsetDateTime dueAt) {
        jdbc.update("""
            INSERT INTO patient_care_plan_items(
                care_plan_id, patient_profile_id, appointment_id, doctor_id,
                sequence_number, goal, reminder, due_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, planId, patientProfileId, appointmentId, doctorId, sequence,
            trimRequired(goal, "CARE_PLAN_ITEM_GOAL_REQUIRED", "Mục tiêu chăm sóc không được để trống"),
            blankToNull(reminder), dueAt);
    }

    private void updateOpenItem(UUID planId, UUID doctorId, CarePlanContracts.ItemUpdateRequest item) {
        int changed = jdbc.update("""
            UPDATE patient_care_plan_items
               SET goal = ?, reminder = ?, due_at = ?
             WHERE id = ? AND care_plan_id = ? AND doctor_id = ? AND status = 'OPEN'
               AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
            """,
            trimRequired(item.goal(), "CARE_PLAN_ITEM_GOAL_REQUIRED", "Mục tiêu chăm sóc không được để trống"),
            blankToNull(item.reminder()), item.dueAt(), item.id(), planId, doctorId);
        if (changed == 0) throw notFound();
    }

    private void updateOpenItemStatus(
            UUID itemId,
            String status,
            String actorPredicate,
            Object actorId) {
        int changed = jdbc.update("""
            UPDATE patient_care_plan_items i
               SET status = ?,
                   completed_at = CASE WHEN ? = 'DONE' THEN CURRENT_TIMESTAMP ELSE NULL END
              WHERE i.id = ? AND i.status = 'OPEN'
                AND i.deleted_at IS NULL AND i.retention_expires_at > CURRENT_TIMESTAMP
                AND EXISTS (
                   SELECT 1 FROM patient_care_plans p
                    WHERE p.id = i.care_plan_id AND p.status = 'OPEN'
                      AND p.deleted_at IS NULL AND p.retention_expires_at > CURRENT_TIMESTAMP
                )
                """ + " AND " + actorPredicate,
            status, status, itemId, actorId);
        if (changed == 0) throw notFound();
    }

    private void refreshPlanStatus(UUID planId) {
        jdbc.update("""
            UPDATE patient_care_plans p
               SET status = CASE
                   WHEN EXISTS (
                       SELECT 1 FROM patient_care_plan_items i
                        WHERE i.care_plan_id = p.id AND i.status = 'OPEN'
                          AND i.deleted_at IS NULL AND i.retention_expires_at > CURRENT_TIMESTAMP
                   ) THEN 'OPEN'
                   WHEN EXISTS (
                       SELECT 1 FROM patient_care_plan_items i
                        WHERE i.care_plan_id = p.id AND i.status = 'DONE'
                          AND i.deleted_at IS NULL AND i.retention_expires_at > CURRENT_TIMESTAMP
                   ) THEN 'DONE'
                   ELSE 'CANCELLED'
               END
             WHERE p.id = ? AND p.deleted_at IS NULL AND p.retention_expires_at > CURRENT_TIMESTAMP
            """, planId);
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

    private Map<String, Object> planForDoctor(UUID planId, UUID doctorId) {
        try {
            return jdbc.queryForMap("""
                SELECT p.id, p.patient_profile_id, p.appointment_id, p.doctor_id, p.title, p.status,
                       pp.user_id AS patient_user_id, d.user_id AS doctor_user_id
                  FROM patient_care_plans p
                  JOIN patient_profiles pp ON pp.id = p.patient_profile_id
                  JOIN doctors d ON d.id = p.doctor_id
                 WHERE p.id = ? AND p.doctor_id = ?
                   AND p.deleted_at IS NULL AND p.retention_expires_at > CURRENT_TIMESTAMP
                """, planId, doctorId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    private Map<String, Object> itemForPatient(UUID itemId, UUID profile) {
        return itemTarget(itemId, "i.patient_profile_id = ?", profile);
    }

    private Map<String, Object> itemForDoctor(UUID itemId, UUID doctorId) {
        return itemTarget(itemId, "i.doctor_id = ?", doctorId);
    }

    private Map<String, Object> itemTarget(UUID itemId, String actorPredicate, Object actorId) {
        try {
            return jdbc.queryForMap("""
                SELECT i.id, i.care_plan_id, i.goal, i.status AS item_status,
                       p.status, p.title, pp.user_id AS patient_user_id, d.user_id AS doctor_user_id
                  FROM patient_care_plan_items i
                  JOIN patient_care_plans p ON p.id = i.care_plan_id
                  JOIN patient_profiles pp ON pp.id = i.patient_profile_id
                  JOIN doctors d ON d.id = i.doctor_id
                 WHERE i.id = ?
                   AND i.deleted_at IS NULL AND i.retention_expires_at > CURRENT_TIMESTAMP
                   AND p.deleted_at IS NULL AND p.retention_expires_at > CURRENT_TIMESTAMP
                   """ + " AND " + actorPredicate,
                itemId, actorId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    private CarePlanContracts.Item itemForPatientResponse(UUID itemId, UUID profile) {
        return itemResponse(itemId, "patient_profile_id = ?", profile);
    }

    private CarePlanContracts.Item itemForDoctorResponse(UUID itemId, UUID doctorId) {
        return itemResponse(itemId, "doctor_id = ?", doctorId);
    }

    private CarePlanContracts.Item itemResponse(UUID itemId, String actorPredicate, Object actorId) {
        try {
            return jdbc.queryForObject("""
                SELECT id, sequence_number, goal, reminder, status, due_at, completed_at
                  FROM patient_care_plan_items
                WHERE id = ? AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
                """ + " AND " + actorPredicate,
                (rs, n) -> new CarePlanContracts.Item(
                    rs.getObject("id", UUID.class), rs.getInt("sequence_number"), rs.getString("goal"),
                    rs.getString("reminder"), rs.getString("status"), rs.getObject("due_at", OffsetDateTime.class),
                    rs.getObject("completed_at", OffsetDateTime.class)), itemId, actorId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound();
        }
    }

    private int nextSequence(UUID planId) {
        Integer value = jdbc.queryForObject("""
            SELECT COALESCE(MAX(sequence_number), 0) + 1
              FROM patient_care_plan_items
             WHERE care_plan_id = ?
            """, Integer.class, planId);
        return value == null ? 1 : value;
    }

    private CarePlanContracts.Plan mapPlan(Map<String, Object> row, List<CarePlanContracts.Item> items) {
        return new CarePlanContracts.Plan((UUID) row.get("id"), (UUID) row.get("appointment_id"),
            (UUID) row.get("doctor_id"), String.valueOf(row.get("doctor_name")), String.valueOf(row.get("title")),
            String.valueOf(row.get("status")), toOffsetDateTime(row.get("starts_at")),
            toOffsetDateTime(row.get("ends_at")), items);
    }

    private static OffsetDateTime toOffsetDateTime(Object value) {
        if (value == null) return null;
        if (value instanceof OffsetDateTime offset) return offset;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant().atOffset(java.time.ZoneOffset.UTC);
        if (value instanceof java.util.Date date) return date.toInstant().atOffset(java.time.ZoneOffset.UTC);
        if (value instanceof java.time.Instant instant) return instant.atOffset(java.time.ZoneOffset.UTC);
        return null;
    }

    private void notifyUser(UUID userId, EventType eventType, String title, String message, UUID referenceId) {
        if (userId == null) return;
        notifications.create(userId, eventType, title, message, referenceId);
    }

    private void requireOpenPlan(Map<String, Object> row) {
        if (!"OPEN".equals(String.valueOf(row.get("status")))) {
            throw new BusinessException(409, "CARE_PLAN_NOT_EDITABLE",
                "Kế hoạch chăm sóc không còn ở trạng thái có thể chỉnh sửa.");
        }
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

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String trimRequired(String value, String code, String message) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isBlank()) throw new BusinessException(400, code, message);
        return trimmed;
    }

    private UUID currentUser(UserDetails principal) {
        if (principal == null) throw new AccessDeniedException("Authentication required");
        if (principal instanceof HealthcareUserPrincipal hp) return hp.getUserId();
        return users.findByEmail(principal.getUsername()).map(User::getId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user unavailable"));
    }

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("CARE_PLAN_NOT_FOUND", "Không tìm thấy kế hoạch chăm sóc");
    }
}
