package com.healthcare.payment.controller;

import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.dto.PaymentWebhookEventAdminView;
import com.healthcare.payment.dto.ReviewBankTransferRequest;
import com.healthcare.payment.dto.RefundBankTransferRequest;
import com.healthcare.payment.service.BankStatementImportService;
import com.healthcare.payment.service.BankTransferPaymentService;
import com.healthcare.payment.service.PaymentInvoiceService;
import com.healthcare.payment.service.PaymentWebhookEventAdminService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {

    private final BankTransferPaymentService paymentService;
    private final PaymentWebhookEventAdminService webhookEventAdminService;
    private final PaymentInvoiceService invoiceService;
    private final BankStatementImportService statementImportService;

    public AdminPaymentController(BankTransferPaymentService paymentService,
            PaymentWebhookEventAdminService webhookEventAdminService,
            PaymentInvoiceService invoiceService,
            BankStatementImportService statementImportService) {
        this.paymentService = paymentService;
        this.webhookEventAdminService = webhookEventAdminService;
        this.invoiceService = invoiceService;
        this.statementImportService = statementImportService;
    }

    @Operation(summary = "Danh sách giao dịch thanh toán viện phí", description = "Truy xuất danh sách chuyển khoản viện phí của bệnh nhân theo trạng thái")
    @GetMapping
    public ResponseEntity<Page<BankTransferPaymentResponse>> list(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(paymentService.listForAdmin(status, pageable));
    }

    @Operation(summary = "Thông báo ngân hàng chưa khớp", description = "Danh sách bằng chứng chuyển khoản từ webhook ngân hàng chưa ghép được thanh toán, gồm các bản đã bị đánh dấu không thể ghép tự động (sai số tiền, lịch đã hủy) để xử lý thủ công")
    @GetMapping("/webhook-events")
    public ResponseEntity<java.util.List<PaymentWebhookEventAdminView>> webhookEvents(
            @RequestParam(defaultValue = "unprocessed") String scope,
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(webhookEventAdminService.list(scope, limit));
    }

    @Operation(summary = "Nhập sao kê ngân hàng", description = "Tải lên tệp sao kê (mỗi dòng: số tiền ; nội dung chuyển khoản ; mã giao dịch). Các dòng khớp nội dung + số tiền sẽ vào hàng chờ đối soát như webhook ngân hàng, dòng lệch được liệt kê để xử lý thủ công")
    @PostMapping(value = "/statements/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BankStatementImportService.ImportResult> importStatement(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails principal) throws java.io.IOException {
        String csv = new String(file.getBytes(), StandardCharsets.UTF_8);
        return ResponseEntity.ok(statementImportService.importStatement(file.getOriginalFilename(), csv, principal));
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

    @Operation(summary = "Biên nhận thanh toán PDF", description = "Tải biên nhận của một giao dịch đã xác nhận; lượt tải sau trả lại cùng biên nhận đã cấp")
    @GetMapping(value = "/{paymentId}/invoice.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> invoicePdf(
            @PathVariable UUID paymentId,
            @AuthenticationPrincipal UserDetails principal) {
        byte[] pdf = invoiceService.receiptForAdmin(paymentId, principal);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header("Content-Disposition", "inline; filename=\"payment-receipt-" + paymentId + ".pdf\"")
            .body(pdf);
    }
}
