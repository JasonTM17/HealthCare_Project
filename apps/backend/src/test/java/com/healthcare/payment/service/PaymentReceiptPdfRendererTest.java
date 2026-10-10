package com.healthcare.payment.service;

import com.healthcare.payment.entity.PaymentInvoice;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class PaymentReceiptPdfRendererTest {
    @Test
    void verificationAndIssuanceUseSameHospitalTimezoneWithoutChangingInstants() throws Exception {
        PaymentInvoice invoice = new PaymentInvoice();
        invoice.setPaymentId(UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111"));
        invoice.setInvoiceNumber("HD-TEST-000001");
        invoice.setIssuedAt(OffsetDateTime.parse("2026-10-10T10:56:00+07:00"));
        invoice.setBookingCode("PDF-TEST");
        invoice.setPatientName("Người kiểm thử PDF");
        invoice.setDoctorName("Bác sĩ kiểm thử");
        invoice.setAmount(new BigDecimal("250000"));
        invoice.setCurrency("VND");
        byte[] bytes = new PaymentReceiptPdfRenderer().render(invoice, "PDF-TEST", "NO-MONEY",
            OffsetDateTime.parse("2026-10-10T03:53:00Z"), PaymentReceiptPdfRenderer.PaymentStatusSnapshot.PAID);
        try (var document = Loader.loadPDF(bytes)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("10/10/2026 10:53 GMT+07:00", "10/10/2026 10:56 GMT+07:00");
            assertThat(text).doesNotContain("GMTZ");
        }
    }
}
