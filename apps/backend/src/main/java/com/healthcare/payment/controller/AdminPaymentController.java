package com.healthcare.payment.controller;

import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.dto.ReviewBankTransferRequest;
import com.healthcare.payment.dto.RefundBankTransferRequest;
import com.healthcare.payment.service.BankTransferPaymentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {

    private final BankTransferPaymentService paymentService;

    public AdminPaymentController(BankTransferPaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public ResponseEntity<Page<BankTransferPaymentResponse>> list(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(paymentService.listForAdmin(status, pageable));
    }

    @PatchMapping("/{paymentId}")
    public ResponseEntity<BankTransferPaymentResponse> review(
            @PathVariable UUID paymentId,
            @Valid @RequestBody ReviewBankTransferRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(paymentService.review(paymentId, request, principal));
    }

    @PatchMapping("/{paymentId}/refund")
    public ResponseEntity<BankTransferPaymentResponse> refund(
            @PathVariable UUID paymentId,
            @Valid @RequestBody RefundBankTransferRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(paymentService.refund(paymentId, request, principal));
    }
}
