package com.healthcare.payment.controller;

import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.dto.SubmitBankTransferRequest;
import com.healthcare.payment.service.BankTransferPaymentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/appointments/{appointmentId}/payment")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPaymentController {

    private final BankTransferPaymentService paymentService;

    public PatientPaymentController(BankTransferPaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public ResponseEntity<BankTransferPaymentResponse> get(
            @PathVariable UUID appointmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(paymentService.getForPatient(appointmentId, principal));
    }

    @PostMapping("/submit")
    public ResponseEntity<BankTransferPaymentResponse> submit(
            @PathVariable UUID appointmentId,
            @Valid @RequestBody SubmitBankTransferRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(paymentService.submit(appointmentId, request, idempotencyKey, principal));
    }
}
