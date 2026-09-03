package com.healthcare.ai.controller;

import com.healthcare.ai.entity.AiCreditTransaction;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/patient/ai-credits")
@PreAuthorize("hasRole('PATIENT')")
public class PatientAiCreditController {

    private final AiCreditService aiCreditService;
    private final UserRepository userRepository;

    public PatientAiCreditController(AiCreditService aiCreditService, UserRepository userRepository) {
        this.aiCreditService = aiCreditService;
        this.userRepository = userRepository;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + principal.getUsername()));

        int credits = aiCreditService.getPatientCredits(user.getId());
        String tier = aiCreditService.getPatientTier(user.getId());
        List<AiCreditTransaction> history = aiCreditService.listTransactions(user.getId());

        int maxCredits = switch (tier.toUpperCase()) {
            case "SILVER" -> 50;
            case "GOLD" -> 100;
            case "VIP" -> 300;
            default -> 20;
        };

        return ResponseEntity.ok(Map.of(
                "tier", tier,
                "credits", credits,
                "maxCredits", maxCredits,
                "history", history
        ));
    }
}
