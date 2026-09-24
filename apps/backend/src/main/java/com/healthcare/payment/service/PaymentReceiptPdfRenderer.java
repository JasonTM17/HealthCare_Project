package com.healthcare.payment.service;

import com.healthcare.payment.entity.PaymentInvoice;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ArrayList;

/**
 * Offline renderer for payment receipts. Deterministic like the clinical
 * synthetic documents (ADR-005): fonts are embedded from the classpath so
 * Vietnamese diacritics render, and every displayed timestamp comes from the
 * invoice snapshot instead of the wall clock.
 */
@Component
public class PaymentReceiptPdfRenderer {

    private static final PDRectangle PAGE_SIZE = PDRectangle.A4;
    private static final float MARGIN = 48f;
    private static final float BODY_SIZE = 10f;
    private static final float BODY_LEADING = 15f;
    private static final DateTimeFormatter ISSUED_FORMAT =
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm 'GMT'XXX");

    private final byte[] regularFontBytes;
    private final byte[] boldFontBytes;

    public PaymentReceiptPdfRenderer() {
        this.regularFontBytes = readFont("fonts/NotoSans-Regular.ttf");
        this.boldFontBytes = readFont("fonts/NotoSans-Bold.ttf");
    }

    public byte[] render(PaymentInvoice invoice, String transferContent, String transactionReference,
            OffsetDateTime verifiedAt, PaymentStatusSnapshot status) {
        try (PDDocument document = new PDDocument()) {
            PDDocumentInformation info = document.getDocumentInformation();
            info.setProducer("healthcare-payment-receipts/1.0");
            info.setCreator("HealthCare payment receipt renderer (offline)");
            info.setCustomMetadataValue("InvoiceNumber", invoice.getInvoiceNumber());
            info.setCustomMetadataValue("PaymentId", invoice.getPaymentId().toString());

            PDFont regular = PDType0Font.load(document, new ByteArrayInputStream(regularFontBytes), false);
            PDFont bold = PDType0Font.load(document, new ByteArrayInputStream(boldFontBytes), false);
            PDPage page = new PDPage(PAGE_SIZE);
            document.addPage(page);
            float y = PAGE_SIZE.getHeight() - MARGIN;
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                y = draw(bold, 15f, "BIÊN NHẬN THANH TOÁN VIỆN PHÍ", stream, y);
                y = draw(bold, 10f, "Số: " + invoice.getInvoiceNumber(), stream, y - 4f);
                y -= 12f;
                stream.setLineWidth(0.8f);
                stream.moveTo(MARGIN, y);
                stream.lineTo(PAGE_SIZE.getWidth() - MARGIN, y);
                stream.stroke();
                y -= BODY_LEADING;
                y = labelValue(bold, regular, "Mã lịch hẹn", invoice.getBookingCode(), stream, y);
                y = labelValue(bold, regular, "Bệnh nhân", invoice.getPatientName(), stream, y);
                y = labelValue(bold, regular, "Bác sĩ", invoice.getDoctorName(), stream, y);
                y = labelValue(bold, regular, "Số tiền", formatMoney(invoice.getAmount(), invoice.getCurrency()), stream, y);
                y = labelValue(bold, regular, "Nội dung chuyển khoản", transferContent, stream, y);
                y = labelValue(bold, regular, "Mã giao dịch", transactionReference, stream, y);
                y = labelValue(bold, regular, "Xác nhận lúc",
                    verifiedAt == null ? null : ISSUED_FORMAT.format(verifiedAt), stream, y);
                y = labelValue(bold, regular, "Ngày phát hành", ISSUED_FORMAT.format(invoice.getIssuedAt()), stream, y);
                y = labelValue(bold, regular, "Trạng thái", status.label(), stream, y);
                y -= BODY_LEADING;
                for (String line : wrap("Tài liệu được tạo tự động từ hệ thống đặt lịch; giá trị đối chiếu dựa trên sao kê ngân hàng của bệnh viện.", regular, 8.5f, PAGE_SIZE.getWidth() - 2 * MARGIN)) {
                    y = draw(regular, 8.5f, line, stream, y);
                }
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream(32 * 1024);
            document.save(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể tạo biên nhận thanh toán", exception);
        }
    }

    private float labelValue(PDFont bold, PDFont regular, String label, String value,
            PDPageContentStream stream, float y) throws IOException {
        if (value == null || value.isBlank()) {
            return y;
        }
        return labelValue(bold, regular, label, value, stream, y, BODY_SIZE);
    }

    private float labelValue(PDFont bold, PDFont regular, String label, String value,
            PDPageContentStream stream, float y, float size) throws IOException {
        float labelWidth = bold.getStringWidth(label + ": ") / 1000f * size;
        List<String> lines = wrap(value, regular, size, PAGE_SIZE.getWidth() - 2 * MARGIN - labelWidth - 6f);
        float cursor = y;
        float lineY = cursor - size;
        drawAt(label + ":", bold, size, MARGIN, lineY, stream);
        for (String line : lines) {
            drawAt(line, regular, size, MARGIN + labelWidth + 6f, lineY, stream);
            lineY -= BODY_LEADING;
            cursor -= BODY_LEADING;
        }
        return cursor;
    }

    private float draw(PDFont font, float size, String text, PDPageContentStream stream, float y)
            throws IOException {
        return drawAt(text, font, size, MARGIN, y, stream);
    }

    private float drawAt(String text, PDFont font, float size, float x, float y, PDPageContentStream stream)
            throws IOException {
        stream.beginText();
        stream.setFont(font, size);
        stream.newLineAtOffset(x, y);
        try {
            stream.showText(text);
        } catch (IllegalArgumentException exception) {
            // A missing glyph must fail the render, not drop Vietnamese diacritics.
            throw new IOException("Text cannot be rendered with the bundled font", exception);
        }
        stream.endText();
        return y - size;
    }

    private List<String> wrap(String text, PDFont font, float size, float maxWidth) throws IOException {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String word : text.trim().split("\\s+")) {
            String candidate = current.isEmpty() ? word : current + " " + word;
            if (font.getStringWidth(candidate) / 1000f * size <= maxWidth) {
                current.setLength(0);
                current.append(candidate);
                continue;
            }
            if (!current.isEmpty()) {
                lines.add(current.toString());
                current.setLength(0);
                current.append(word);
            } else {
                current.append(word);
            }
        }
        lines.add(current.toString());
        return lines;
    }

    private String formatMoney(BigDecimal amount, String currency) {
        return String.format(java.util.Locale.ROOT, "%,d %s", amount.toBigIntegerExact().longValueExact(),
            "VND".equals(currency) ? "đ" : currency);
    }

    private byte[] readFont(String path) {
        try (InputStream stream = new ClassPathResource(path).getInputStream()) {
            return StreamUtils.copyToByteArray(stream);
        } catch (IOException exception) {
            throw new IllegalStateException("Bundled PDF font is missing: " + path, exception);
        }
    }

    /** Receipt-face wording for the payment state at issuance. */
    public enum PaymentStatusSnapshot {
        PAID("Đã thanh toán"),
        REFUND_PENDING("Đã thanh toán — đang chờ hoàn tiền"),
        REFUNDED("Đã thanh toán — đã hoàn tiền");

        private final String label;

        PaymentStatusSnapshot(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }
}
