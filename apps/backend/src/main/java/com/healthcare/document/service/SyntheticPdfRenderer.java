package com.healthcare.document.service;

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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Offline deterministic renderer for the two approved synthetic document
 * classes (ADR-005). Output bytes are a pure function of the snapshot: fonts
 * are embedded from the classpath (no network), the document-info dates come
 * from the source record, and every displayed timestamp equals the source
 * finalization time. Rendering is integrity provenance, never a signature.
 */
@Component
public class SyntheticPdfRenderer {

    /** Bumping this changes the document idempotency key for every source. */
    public static final String TEMPLATE_VERSION = "1.0";

    public static final String DISCLAIMER_LINE =
        "BẢN TỔNG HỢP DEMO — KHÔNG PHẢI CHỨNG TỪ Y KHOA CÓ CHỮ KÝ";
    public static final String ISSUER_LINE = "Đơn vị phát hành: HealthCare (dự án demo tổng hợp dữ liệu)";
    public static final String HASH_LABEL = "Mã kiểm tra nội dung nguồn (SHA-256): ";

    private static final PDRectangle PAGE_SIZE = PDRectangle.A4;
    private static final float MARGIN = 48f;
    private static final float BOTTOM_LIMIT = 64f;
    private static final float BODY_SIZE = 10f;
    private static final float BODY_LEADING = 12.5f;

    private final byte[] regularFontBytes;
    private final byte[] boldFontBytes;

    public SyntheticPdfRenderer() {
        this.regularFontBytes = readFont("fonts/NotoSans-Regular.ttf");
        this.boldFontBytes = readFont("fonts/NotoSans-Bold.ttf");
    }

    public byte[] renderVisitSummary(DocumentSnapshot snapshot, String snapshotHash) throws IOException {
        Canvas canvas = new Canvas(snapshot);
        try {
            canvas.title("BẢN TỔNG KẾT LẦN KHÁM (BẢN TỔNG HỢP DEMO)");
            canvas.disclaimerBox(DISCLAIMER_LINE);
            canvas.metaBlock(snapshot);
            DocumentSnapshot.VisitSummaryPayload visit = snapshot.visitSummary();
            canvas.section("Thông tin lần khám");
            canvas.labelValue("Mã lịch hẹn", visit.bookingCode());
            canvas.labelValue("Ngày khám", formatDate(visit.visitDate()));
            canvas.section("Sinh hiệu");
            canvas.labelValue("Huyết áp", safePair(visit.bloodPressureSystolic(), visit.bloodPressureDiastolic(), "mmHg"));
            canvas.labelValue("Nhịp tim", safeMetric(visit.heartRate(), "lần/phút"));
            canvas.labelValue("Nhiệt độ", safeMetric(visit.temperature(), "°C"));
            canvas.labelValue("Cân nặng", safeMetric(visit.weightKg(), "kg"));
            canvas.labelValue("Chiều cao", safeMetric(visit.heightCm(), "cm"));
            canvas.section("Kết quả lâm sàng");
            canvas.labelValue("Chẩn đoán (ICD-10)", joinCode(visit.icd10Code(), visit.icd10Name()));
            canvas.labelValue("Chẩn đoán", visit.diagnosis());
            canvas.labelValue("Tóm tắt triệu chứng", visit.symptomsSummary());
            canvas.section("Hướng xử lý");
            canvas.labelValue("Phác đồ điều trị", visit.treatmentPlan());
            canvas.labelValue("Ghi chú bác sĩ", visit.doctorNotes());
            canvas.labelValue("Ngày tái khám", formatDate(visit.followUpDate()));
            return canvas.finish(snapshot, snapshotHash);
        } finally {
            canvas.closeQuietly();
        }
    }

    public byte[] renderPrescription(DocumentSnapshot snapshot, String snapshotHash) throws IOException {
        Canvas canvas = new Canvas(snapshot);
        try {
            canvas.title("ĐƠN THUỐC (BẢN TỔNG HỢP DEMO)");
            canvas.disclaimerBox(DISCLAIMER_LINE);
            canvas.metaBlock(snapshot);
            DocumentSnapshot.PrescriptionPayload prescription = snapshot.prescription();
            canvas.section("Thông tin đơn thuốc");
            canvas.labelValue("Mã đơn thuốc", prescription.prescriptionCode());
            canvas.section("Danh sách thuốc");
            if (prescription.items() == null || prescription.items().isEmpty()) {
                canvas.paragraph("(Đơn thuốc nguồn không có dòng thuốc nào được ghi nhận.)");
            } else {
                int index = 1;
                for (DocumentSnapshot.PrescriptionItemSnapshot item : prescription.items()) {
                    canvas.labelValue("Thuốc " + index++, joinNonBlank(" — ",
                        joinNonBlank(" ", item.medicationName(), item.dosage(), item.unit()),
                        item.activeIngredient()));
                    canvas.labelValue("Liều dùng", joinNonBlank("; ",
                        item.frequency(),
                        safeMetric(item.durationDays(), "ngày"),
                        safeMetric(item.totalQuantity(), null),
                        item.usageNote()));
                }
            }
            canvas.section("Lưu ý chung");
            canvas.paragraph(prescription.generalAdvice());
            return canvas.finish(snapshot, snapshotHash);
        } finally {
            canvas.closeQuietly();
        }
    }

    String issuerLine() {
        return ISSUER_LINE;
    }

    // ── Canvas helpers ──────────────────────────────────────────────────────

    private String formatDate(OffsetDateTime value) {
        return value == null ? null : value.toLocalDate().toString();
    }

    private String formatDate(LocalDate value) {
        return value == null ? null : value.toString();
    }

    private String formatTimestamp(OffsetDateTime value) {
        return value == null ? null
            : value.toInstant().toString().replace("T", " ").replace("Z", " UTC");
    }

    private String joinCode(String code, String name) {
        if (code == null && name == null) return null;
        if (code == null) return name;
        if (name == null) return code;
        return code + " — " + name;
    }

    private String joinNonBlank(String separator, String... parts) {
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank()) continue;
            if (builder.length() > 0) builder.append(separator);
            builder.append(part.trim());
        }
        return builder.isEmpty() ? null : builder.toString();
    }

    private String safePair(Integer first, Integer second, String unit) {
        if (first == null && second == null) return null;
        return first + "/" + second + " " + unit;
    }

    private String safeMetric(Number value, String unit) {
        if (value == null) return null;
        String base = value instanceof BigDecimal decimal
            ? decimal.stripTrailingZeros().toPlainString()
            : value.toString();
        return unit == null || unit.isBlank() ? base : base + " " + unit;
    }

    private byte[] readFont(String path) {
        try (InputStream stream = new ClassPathResource(path).getInputStream()) {
            return StreamUtils.copyToByteArray(stream);
        } catch (IOException exception) {
            throw new IllegalStateException("Bundled PDF font is missing: " + path, exception);
        }
    }

    /**
     * Manages pages, embedded fonts and deterministic pagination. All draw
     * positions derive only from content geometry, so the same snapshot
     * reflows and paginates identically.
     */
    private final class Canvas {

        private final PDDocument document;
        private PDFont regular;
        private PDFont bold;
        private PDPageContentStream stream;
        private float y;

        private Canvas(DocumentSnapshot snapshot) {
            this.document = new PDDocument();
            PDDocumentInformation info = document.getDocumentInformation();
            info.setProducer("healthcare-synthetic-docs/" + TEMPLATE_VERSION);
            info.setCreator("HealthCare synthetic document renderer (offline)");
            // Determinism: PDF dates derive from the source record, never from now().
            OffsetDateTime finalizedAt = snapshot.sourceFinalizedAt() != null
                ? snapshot.sourceFinalizedAt()
                : OffsetDateTime.parse("1970-01-01T00:00:00Z");
            Calendar fixedDate = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
            fixedDate.setTimeInMillis(finalizedAt.toInstant().toEpochMilli());
            info.setCreationDate(fixedDate);
            info.setModificationDate(fixedDate);
        }

        private void ensureOpen() throws IOException {
            if (stream != null) {
                return;
            }
            if (regular == null) {
                regular = PDType0Font.load(document,
                    new ByteArrayInputStream(regularFontBytes), false);
                bold = PDType0Font.load(document,
                    new ByteArrayInputStream(boldFontBytes), false);
            }
            PDPage page = new PDPage(PAGE_SIZE);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            y = PAGE_SIZE.getHeight() - MARGIN;
        }

        private void ensureSpace(float height) throws IOException {
            ensureOpen();
            if (y - height < BOTTOM_LIMIT) {
                footer();
                stream.close();
                stream = null;
                ensureOpen();
            }
        }

        private void title(String text) throws IOException {
            ensureSpace(24f);
            y -= 20f;
            drawText(text, bold, 16f);
        }

        private void section(String text) throws IOException {
            ensureSpace(24f);
            y -= 10f;
            drawText(text, bold, 12f);
        }

        private void disclaimerBox(String text) throws IOException {
            float fontSize = 10.5f;
            List<String> lines = wrap(text, bold, fontSize, PAGE_SIZE.getWidth() - 2 * MARGIN - 12f);
            float boxHeight = lines.size() * (fontSize + 3f) + 12f;
            ensureSpace(boxHeight + 6f);
            y -= boxHeight + 6f;
            stream.setStrokingColor(0.72f, 0.11f, 0.11f);
            stream.setLineWidth(1f);
            stream.addRect(MARGIN, y, PAGE_SIZE.getWidth() - 2 * MARGIN, boxHeight);
            stream.stroke();
            stream.setNonStrokingColor(0.62f, 0.07f, 0.07f);
            float lineY = y + boxHeight - 11f;
            for (String line : lines) {
                drawAt(line, bold, fontSize, MARGIN + 6f, lineY);
                lineY -= fontSize + 3f;
            }
            y -= 4f;
            stream.setNonStrokingColor(0f, 0f, 0f);
        }

        private void metaBlock(DocumentSnapshot snapshot) throws IOException {
            labelValue("Đơn vị phát hành", issuerLine());
            labelValue("Bệnh nhân", snapshot.patientName());
            labelValue("Bác sĩ", snapshot.doctorName());
            labelValue("Dữ liệu chốt lúc", formatTimestamp(snapshot.sourceFinalizedAt()));
        }

        private void labelValue(String label, String value) throws IOException {
            if (value == null || value.isBlank()) {
                return;
            }
            ensureOpen();
            float labelWidth = bold.getStringWidth(label + ": ") / 1000f * BODY_SIZE;
            List<String> lines = wrap(value, regular, BODY_SIZE,
                PAGE_SIZE.getWidth() - 2 * MARGIN - labelWidth - 8f);
            float needed = Math.max(BODY_LEADING, lines.size() * BODY_LEADING);
            ensureSpace(needed);
            y -= needed;
            float lineY = y + needed - BODY_SIZE;
            drawAt(label + ": ", bold, BODY_SIZE, MARGIN, lineY);
            for (String line : lines) {
                drawAt(line, regular, BODY_SIZE, MARGIN + labelWidth + 8f, lineY);
                lineY -= BODY_LEADING;
            }
        }

        private void paragraph(String text) throws IOException {
            if (text == null || text.isBlank()) {
                return;
            }
            ensureOpen();
            List<String> lines = wrap(text, regular, BODY_SIZE, PAGE_SIZE.getWidth() - 2 * MARGIN);
            float needed = Math.max(BODY_LEADING, lines.size() * BODY_LEADING);
            ensureSpace(needed);
            y -= needed;
            float lineY = y + needed - BODY_SIZE;
            for (String line : lines) {
                drawAt(line, regular, BODY_SIZE, MARGIN, lineY);
                lineY -= BODY_LEADING;
            }
        }

        private void drawText(String text, PDFont font, float size) throws IOException {
            drawAt(text, font, size, MARGIN, y);
        }

        private void drawAt(String text, PDFont font, float size, float x, float lineY)
                throws IOException {
            ensureOpen();
            stream.beginText();
            stream.setFont(font, size);
            stream.newLineAtOffset(x, lineY);
            try {
                stream.showText(text);
            } catch (IllegalArgumentException exception) {
                // A glyph missing from the embedded font must fail the render,
                // not silently drop Vietnamese diacritics.
                throw new IOException("Text cannot be rendered with the bundled font", exception);
            }
            stream.endText();
        }

        /** Fixed per-page footer; positions depend only on page geometry. */
        private void footer() throws IOException {
            if (stream == null) {
                return;
            }
            drawAt("Tài liệu tổng hợp tự động — chỉ dùng cho bản demo, không có giá trị pháp lý.",
                regular, 7.5f, MARGIN, 40f);
        }

        private List<String> wrap(String text, PDFont font, float size, float maxWidth)
                throws IOException {
            String normalized = text == null ? "" : text.replace("\r\n", "\n").replace('\r', '\n');
            List<String> lines = new ArrayList<>();
            for (String paragraph : normalized.split("\n", -1)) {
                String trimmed = paragraph.trim();
                if (trimmed.isEmpty()) {
                    lines.add("");
                    continue;
                }
                StringBuilder current = new StringBuilder();
                for (String word : trimmed.split("\\s+")) {
                    String candidate = current.isEmpty() ? word : current + " " + word;
                    if (widthOf(candidate, font, size) <= maxWidth) {
                        current.setLength(0);
                        current.append(candidate);
                        continue;
                    }
                    if (!current.isEmpty()) {
                        lines.add(current.toString());
                        current.setLength(0);
                    }
                    if (widthOf(word, font, size) > maxWidth) {
                        for (int index = 0; index < word.length(); index++) {
                            char ch = word.charAt(index);
                            if (!current.isEmpty()
                                    && widthOf(current.toString() + ch, font, size) > maxWidth) {
                                lines.add(current.toString());
                                current.setLength(0);
                            }
                            current.append(ch);
                        }
                    } else {
                        current.append(word);
                    }
                }
                lines.add(current.toString());
            }
            return lines;
        }

        private float widthOf(String text, PDFont font, float size) throws IOException {
            return font.getStringWidth(text) / 1000f * size;
        }

        private byte[] finish(DocumentSnapshot snapshot, String snapshotHash) throws IOException {
            ensureOpen();
            y -= 12f;
            stream.setNonStrokingColor(0.25f, 0.25f, 0.25f);
            drawText(HASH_LABEL + snapshotHash, regular, 8.5f);
            y -= 11f;
            drawText("Mã bản ghi nguồn: " + snapshot.sourceRecordId()
                + " · Phiên bản biểu mẫu: " + snapshot.templateVersion(), regular, 8.5f);
            stream.setNonStrokingColor(0f, 0f, 0f);
            footer();
            stream.close();
            stream = null;
            ByteArrayOutputStream output = new ByteArrayOutputStream(48 * 1024);
            document.save(output);
            return stabilizeDocumentId(output.toByteArray(), snapshotHash);
        }

        /**
         * PDFBox seeds the trailer document ID from the wall clock, which would
         * make identical snapshots produce different bytes. Replace both ID
         * hex slots, in place and length-preserving, with the snapshot hash so
         * rendering is fully deterministic (ADR-005). The xref-stream
         * dictionary keeps the same byte length, so startxref stays valid.
         */
        private static byte[] stabilizeDocumentId(byte[] pdf, String snapshotHash) {
            if (snapshotHash == null || snapshotHash.length() < 64) {
                return pdf;
            }
            byte[] marker = "/ID [".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
            int markerEnd = lastIndexOf(pdf, marker);
            if (markerEnd < 0) {
                return pdf;
            }
            String idHex = snapshotHash.substring(0, 64).toUpperCase(Locale.ROOT);
            int position = markerEnd;
            int[] slots = new int[2];
            int found = 0;
            while (position < pdf.length && found < slots.length) {
                int ch = pdf[position];
                if (ch == '<') {
                    slots[found++] = position + 1;
                } else if (ch == ']') {
                    return pdf;
                }
                position++;
            }
            if (found < slots.length) {
                return pdf;
            }
            for (int slot : slots) {
                for (int index = 0; index < 64; index++) {
                    int at = slot + index;
                    if (at >= pdf.length) {
                        return pdf;
                    }
                    int original = pdf[at];
                    boolean isHex = (original >= '0' && original <= '9')
                        || (original >= 'A' && original <= 'F')
                        || (original >= 'a' && original <= 'f');
                    if (!isHex) {
                        return pdf;
                    }
                    pdf[at] = (byte) idHex.charAt(index);
                }
            }
            return pdf;
        }

        /** Returns the index right after the last full occurrence of needle. */
        private static int lastIndexOf(byte[] haystack, byte[] needle) {
            for (int start = haystack.length - needle.length; start >= 0; start--) {
                boolean matches = true;
                for (int index = 0; index < needle.length; index++) {
                    if (haystack[start + index] != needle[index]) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    return start + needle.length;
                }
            }
            return -1;
        }

        private void closeQuietly() {
            try {
                if (stream != null) {
                    stream.close();
                }
            } catch (IOException ignored) {
                // Teardown after save or failure.
            }
            try {
                document.close();
            } catch (IOException ignored) {
                // Same teardown path.
            }
        }
    }
}
