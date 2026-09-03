package com.healthcare.ai.service;

import com.healthcare.ai.entity.AiCreditTransaction;
import com.healthcare.ai.repository.AiCreditTransactionRepository;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AiCreditService {

    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AiCreditTransactionRepository transactionRepository;

    public AiCreditService(
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            AiCreditTransactionRepository transactionRepository) {
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }

    public record PatientCreditDto(
            UUID patientId,
            UUID userId,
            String fullName,
            String email,
            String phone,
            String tier,
            int credits
    ) {}

    public record DoctorCreditDto(
            UUID doctorId,
            UUID userId,
            String fullName,
            String slug,
            int credits
    ) {}

    @Transactional(readOnly = true)
    public int getPatientCredits(UUID userId) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        return profile != null ? profile.getAiCredits() : 0;
    }

    @Transactional(readOnly = true)
    public String getPatientTier(UUID userId) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        return profile != null ? profile.getPatientTier() : "STANDARD";
    }

    @Transactional(readOnly = true)
    public int getDoctorCredits(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId).orElse(null);
        return doctor != null ? doctor.getAiCredits() : 0;
    }

    @Transactional
    public boolean deductPatientCredit(UUID userId, String description) {
        PatientProfile profile = patientProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) {
            return false;
        }
        int current = profile.getAiCredits() != null ? profile.getAiCredits() : 0;
        if (current <= 0) {
            throw new BusinessException(
                402,
                "INSUFFICIENT_AI_CREDITS",
                "Bạn đã dùng hết lượt hỏi AI (Credit: 0). Vui lòng nâng hạng thẻ hoặc liên hệ quản trị viên để được cấp thêm credit."
            );
        }
        int after = current - 1;
        profile.setAiCredits(after);
        patientProfileRepository.save(profile);

        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "PATIENT", -1, after, "AI_CHAT_USAGE", description
        );
        transactionRepository.save(tx);
        return true;
    }

    @Transactional
    public boolean deductDoctorCredit(UUID userId, String description) {
        Doctor doctor = doctorRepository.findByUserId(userId).orElse(null);
        if (doctor == null) {
            return false;
        }
        int current = doctor.getAiCredits() != null ? doctor.getAiCredits() : 0;
        if (current <= 0) {
            throw new BusinessException(
                402,
                "INSUFFICIENT_AI_CREDITS",
                "Hạn mức AI hỗ trợ lâm sàng của bác sĩ đã hết (Credit: 0). Vui lòng liên hệ quản trị viên để gia hạn."
            );
        }
        int after = current - 1;
        doctor.setAiCredits(after);
        doctorRepository.save(doctor);

        AiCreditTransaction tx = new AiCreditTransaction(
                userId, "DOCTOR", -1, after, "AI_CHAT_USAGE", description
        );
        transactionRepository.save(tx);
        return true;
    }

    @Transactional
    public void grantCredits(UUID userId, String targetRole, int amount, String transactionType, String description) {
        if ("PATIENT".equalsIgnoreCase(targetRole)) {
            PatientProfile profile = patientProfileRepository.findByUserId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Patient profile not found for user: " + userId));
            int after = Math.max(0, (profile.getAiCredits() != null ? profile.getAiCredits() : 0) + amount);
            profile.setAiCredits(after);
            patientProfileRepository.save(profile);

            AiCreditTransaction tx = new AiCreditTransaction(
                    userId, "PATIENT", amount, after, transactionType, description
            );
            transactionRepository.save(tx);
        } else if ("DOCTOR".equalsIgnoreCase(targetRole)) {
            Doctor doctor = doctorRepository.findByUserId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Doctor not found for user: " + userId));
            int after = Math.max(0, (doctor.getAiCredits() != null ? doctor.getAiCredits() : 0) + amount);
            doctor.setAiCredits(after);
            doctorRepository.save(doctor);

            AiCreditTransaction tx = new AiCreditTransaction(
                    userId, "DOCTOR", amount, after, transactionType, description
            );
            transactionRepository.save(tx);
        }
    }

    @Transactional
    public void updatePatientTier(UUID patientProfileId, String newTier, Integer newCredits) {
        PatientProfile profile = patientProfileRepository.findById(patientProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient profile not found: " + patientProfileId));

        profile.setPatientTier(newTier.toUpperCase());
        int defaultTierCredits = switch (newTier.toUpperCase()) {
            case "SILVER" -> 50;
            case "GOLD" -> 100;
            case "VIP" -> 300;
            default -> 20;
        };
        int credits = newCredits != null && newCredits >= 0 ? newCredits : defaultTierCredits;
        profile.setAiCredits(credits);
        patientProfileRepository.save(profile);

        if (profile.getUserId() != null) {
            AiCreditTransaction tx = new AiCreditTransaction(
                    profile.getUserId(),
                    "PATIENT",
                    credits,
                    credits,
                    "TIER_UPGRADE",
                    "Cập nhật hạng thành viên: " + newTier.toUpperCase() + " (" + credits + " credits)"
            );
            transactionRepository.save(tx);
        }
    }

    @Transactional(readOnly = true)
    public List<PatientCreditDto> listAllPatients() {
        return patientProfileRepository.findAll().stream()
                .map(p -> new PatientCreditDto(
                        p.getId(),
                        p.getUserId(),
                        p.getFullName(),
                        p.getEmail(),
                        p.getPhone(),
                        p.getPatientTier(),
                        p.getAiCredits() != null ? p.getAiCredits() : 0
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DoctorCreditDto> listAllDoctors() {
        return doctorRepository.findAll().stream()
                .map(d -> new DoctorCreditDto(
                        d.getId(),
                        d.getUserId(),
                        d.getFullName(),
                        d.getSlug(),
                        d.getAiCredits() != null ? d.getAiCredits() : 0
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AiCreditTransaction> listTransactions(UUID userId) {
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
