package com.healthcare.ai.chat.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientGender;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.user.entity.UserPreferences;
import com.healthcare.user.repository.UserPreferencesRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Server-side source of per-account assistant tuning. The browser never sends
 * this data: tone and the opt-in patient context are read from
 * {@code user_preferences} and the patient's own records at message time, so
 * the personalization cannot be spoofed or widened from a request body.
 *
 * <p>Context lines are deliberately narrow and operational (identity the user
 * is talking to, a coarse age band, the nearest upcoming visit). Deep medical
 * fields (medical history, allergies, diagnoses) stay out of the prompt —
 * they are neither needed for hospital-support guidance nor safe to place in
 * an external provider call.
 */
@Service
public class AiPatientContextService {

    private static final Set<String> SUPPORTED_TONES = Set.of("than_thien", "chuyen_nghiep", "ngan_gon");
    private static final Set<AppointmentStatus> UPCOMING_STATUSES = Set.of(
        AppointmentStatus.PENDING_CONFIRMATION, AppointmentStatus.CONFIRMED);
    private static final DateTimeFormatter VN_DATE = DateTimeFormatter.ofPattern("dd/MM", Locale.ROOT);

    private final UserPreferencesRepository preferencesRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final AppointmentRepository appointmentRepository;

    @Autowired
    public AiPatientContextService(
            UserPreferencesRepository preferencesRepository,
            PatientProfileRepository patientProfileRepository,
            AppointmentRepository appointmentRepository) {
        this.preferencesRepository = preferencesRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.appointmentRepository = appointmentRepository;
    }

    /** Validated reply register plus the opt-in patient context lines. */
    public record AssistantTuning(String tone, List<String> patientContext) {
        public static final AssistantTuning DEFAULT = new AssistantTuning("than_thien", List.of());
    }

    /** Read-only lookup: chatting never creates a preferences row. */
    public AssistantTuning tuningFor(UUID userId) {
        if (userId == null) return AssistantTuning.DEFAULT;
        Optional<UserPreferences> preferences = preferencesRepository.findById(userId);
        if (preferences.isEmpty()) return AssistantTuning.DEFAULT;
        String tone = preferences.get().getChatTone();
        if (tone == null || !SUPPORTED_TONES.contains(tone)) tone = "than_thien";
        List<String> context = preferences.get().isChatPersonalized()
            ? buildPatientContext(userId)
            : List.of();
        return new AssistantTuning(tone, context);
    }

    private List<String> buildPatientContext(UUID userId) {
        Optional<PatientProfile> profile = patientProfileRepository.findByUserId(userId);
        if (profile.isEmpty()) return List.of();
        List<String> lines = new ArrayList<>();
        String name = boundedOneLine(profile.get().getFullName(), 80);
        if (!name.isBlank()) lines.add("Hồ sơ người dùng do hệ thống cung cấp: tên " + name + ".");
        String demographic = demographicLine(profile.get());
        if (demographic != null) lines.add(demographic);
        String upcoming = nearestAppointmentLine(profile.get().getId());
        if (upcoming != null) lines.add(upcoming);
        return lines;
    }

    private String demographicLine(PatientProfile profile) {
        List<String> parts = new ArrayList<>();
        if (profile.getGender() == PatientGender.MALE) parts.add("giới tính nam");
        else if (profile.getGender() == PatientGender.FEMALE) parts.add("giới tính nữ");
        String band = ageBand(profile.getDateOfBirth());
        if (band != null) parts.add(band);
        if (parts.isEmpty()) return null;
        return "Thông tin đối tượng: " + String.join(", ", parts) + ".";
    }

    private String ageBand(LocalDate dateOfBirth) {
        if (dateOfBirth == null) return null;
        int age = LocalDate.now().getYear() - dateOfBirth.getYear();
        if (age < 0 || age > 120) return null;
        int low = (age / 10) * 10;
        return "nhóm tuổi " + low + "-" + (low + 9);
    }

    private String nearestAppointmentLine(UUID patientId) {
        LocalDate today = LocalDate.now();
        // The repository sorts newest first and requires a Pageable; a small
        // page is enough to find the earliest still-upcoming visit.
        Optional<Appointment> soonest = appointmentRepository
            .findByPatientIdOrderByAppointmentDateDescStartTimeDesc(
                patientId, org.springframework.data.domain.PageRequest.of(0, 30)).stream()
            .filter(visit -> visit.getAppointmentDate() != null
                && !visit.getAppointmentDate().isBefore(today))
            .filter(visit -> UPCOMING_STATUSES.contains(visit.getStatus()))
            .min(java.util.Comparator
                .comparing(Appointment::getAppointmentDate)
                .thenComparing(visit -> visit.getStartTime() == null
                    ? java.time.LocalTime.MAX
                    : visit.getStartTime()));
        if (soonest.isEmpty()) return null;
        Appointment visit = soonest.get();
        String time = visit.getStartTime() == null
            ? ""
            : " lúc " + visit.getStartTime().format(DateTimeFormatter.ofPattern("HH:mm"));
        return "Lịch hẹn sắp tới gần nhất: ngày "
            + visit.getAppointmentDate().format(VN_DATE) + time
            + " (chỉ nhắc khi người dùng hỏi về lịch hẹn của họ).";
    }

    /** One line, length-capped: a name is prompt content, not free-form storage. */
    private static String boundedOneLine(String value, int maxLength) {
        if (value == null) return "";
        String flat = value.replaceAll("\\s+", " ").strip();
        return flat.length() > maxLength ? flat.substring(0, maxLength) : flat;
    }
}
