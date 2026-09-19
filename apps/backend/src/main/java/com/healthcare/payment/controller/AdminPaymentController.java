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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {

    private final BankTransferPaymentService paymentService;

    public AdminPaymentController(BankTransferPaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Operation(summary = "Danh sách giao dịch thanh toán viện phí", description = "Truy xuất danh sách chuyển khoản viện phí của bệnh nhân theo trạng thái")
    @GetMapping
    public ResponseEntity<Page<BankTransferPaymentResponse>> list(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(paymentService.listForAdmin(status, pageable));
    }

    @Operation(summary = "Duyệt giao dịch chuyển khoản", description = "Xác nhận đối soát hoặc từ chối chứng từ thanh toán viện phí của bệnh nhân")
    @PatchMapping("/{paymentId}")
    public ResponseEntity<BankTransferPaymentResponse> review(
            @PathVariable UUID paymentId,
            @Valid @RequestBody ReviewBankTransferRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(paymentService.review(paymentId, request, principal));
    }

    @Operation(summary = "Hoàn tiền giao dịch viện phí", description = "Xử lý hoàn tiền cho bệnh nhân trong trường hợp hủy lịch khám hoặc thanh toán thừa")
    @PatchMapping("/{paymentId}/refund")
    public ResponseEntity<BankTransferPaymentResponse> refund(
            @PathVariable UUID paymentId,
            @Valid @RequestBody RefundBankTransferRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(paymentService.refund(paymentId, request, principal));
    }
}
