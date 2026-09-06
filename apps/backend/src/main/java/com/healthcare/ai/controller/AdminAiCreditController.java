package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiCreditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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

    private static final int MAX_GRANT_AMOUNT = 10_000;

    private final AiCreditService aiCreditService;

    public AdminAiCreditController(AiCreditService aiCreditService) {
        this.aiCreditService = aiCreditService;
    }

    public record GrantCreditRequest(
            @NotNull UUID userId,
            @NotBlank @Pattern(regexp = "^(PATIENT|DOCTOR)$") String targetRole,
            @NotNull @Min(1) @Max(MAX_GRANT_AMOUNT) int amount,
            @Size(max = 200) String description
    ) {}

    public record UpdateTierRequest(
            @NotNull UUID patientProfileId,
            @NotBlank @Pattern(regexp = "^(SILVER|GOLD|VIP)$") String tier,
            @Min(0) @Max(MAX_GRANT_AMOUNT) Integer credits
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
    public ResponseEntity<Map<String, Object>> grantCredits(@Valid @RequestBody GrantCreditRequest request) {
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
    public ResponseEntity<Map<String, Object>> updateTier(@Valid @RequestBody UpdateTierRequest request) {
        aiCreditService.updatePatientTier(request.patientProfileId(), request.tier(), request.credits());
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Đã cập nhật hạng và hạn mức AI"));
    }
}
