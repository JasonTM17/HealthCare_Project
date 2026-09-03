package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiCreditService;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/ai-credits")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiCreditController {

    private final AiCreditService aiCreditService;

    public AdminAiCreditController(AiCreditService aiCreditService) {
        this.aiCreditService = aiCreditService;
    }

    public record GrantCreditRequest(
            @NotNull UUID userId,
            @NotBlank String targetRole, // PATIENT, DOCTOR
            @NotNull int amount,
            String description
    ) {}

    public record UpdateTierRequest(
            @NotNull UUID patientProfileId,
            @NotBlank String tier,
            Integer credits
    ) {}

    @GetMapping("/patients")
    public ResponseEntity<List<AiCreditService.PatientCreditDto>> listPatients() {
        return ResponseEntity.ok(aiCreditService.listAllPatients());
    }

    @GetMapping("/doctors")
    public ResponseEntity<List<AiCreditService.DoctorCreditDto>> listDoctors() {
        return ResponseEntity.ok(aiCreditService.listAllDoctors());
    }

    @PostMapping("/grant")
    public ResponseEntity<Map<String, Object>> grantCredits(@RequestBody GrantCreditRequest request) {
        aiCreditService.grantCredits(
                request.userId(),
                request.targetRole(),
                request.amount(),
                "ADMIN_GRANT",
                request.description() != null ? request.description() : "Admin cấp phát credit AI"
        );
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Đã cấp phát credit thành công"));
    }

    @PutMapping("/tier")
    public ResponseEntity<Map<String, Object>> updateTier(@RequestBody UpdateTierRequest request) {
        aiCreditService.updatePatientTier(request.patientProfileId(), request.tier(), request.credits());
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Đã cập nhật hạng và hạn mức AI"));
    }
}
