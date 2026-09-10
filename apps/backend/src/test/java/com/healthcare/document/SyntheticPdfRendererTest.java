package com.healthcare.document;

import com.healthcare.document.service.DocumentSnapshot;
import com.healthcare.document.service.DocumentSnapshotCodec;
import com.healthcare.document.service.SyntheticPdfRenderer;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SyntheticPdfRendererTest {

    private static SyntheticPdfRenderer renderer;
    private static DocumentSnapshotCodec codec;

    @BeforeAll
    static void setUp() {
        renderer = new SyntheticPdfRenderer();
        codec = new DocumentSnapshotCodec();
    }

    @Test
    void visitSummaryRendersIdenticallyForIdenticalSnapshots() throws Exception {
        DocumentSnapshot snapshot = visitSnapshot("Nguyễn Thị Bích Hòa");
        String hash = codec.sha256Hex(codec.canonicalJson(snapshot));

        byte[] first = renderer.renderVisitSummary(snapshot, hash);
        byte[] second = renderer.renderVisitSummary(snapshot, hash);

        assertThat(first).isNotEmpty();
        assertThat(first).isEqualTo(second);
        assertThat(new String(first, 0, 5, java.nio.charset.StandardCharsets.US_ASCII))
                .isEqualTo("%PDF-");
    }

    @Test
    void prescriptionRendersIdenticallyForIdenticalSnapshots() throws Exception {
        DocumentSnapshot snapshot = prescriptionSnapshot("Trần Văn Đà Nẵng");
        String hash = codec.sha256Hex(codec.canonicalJson(snapshot));

        byte[] first = renderer.renderPrescription(snapshot, hash);
        byte[] second = renderer.renderPrescription(snapshot, hash);

        assertThat(first).isEqualTo(second);
    }

    @Test
    void renderedPdfCarriesVietnameseGlyphsDisclaimerAndProvenance() throws Exception {
        DocumentSnapshot snapshot = visitSnapshot("Nguyễn Thị Bích Hòa");
        String hash = codec.sha256Hex(codec.canonicalJson(snapshot));

        byte[] pdf = renderer.renderVisitSummary(snapshot, hash);
        String text = extractText(pdf);

        assertThat(text).contains(SyntheticPdfRenderer.DISCLAIMER_LINE);
        assertThat(text).contains("Nguyễn Thị Bích Hòa");
        assertThat(text).contains("BẢN TỔNG KẾT LẦN KHÁM");
        assertThat(text).contains(SyntheticPdfRenderer.HASH_LABEL + hash);
        assertThat(text).contains(snapshot.sourceRecordId().toString());
        assertThat(text).contains("Phiên bản biểu mẫu: " + SyntheticPdfRenderer.TEMPLATE_VERSION);
        assertThat(text).contains("không có giá trị pháp lý");
    }

    @Test
    void longContentPaginatesInsteadOfOverflowing() throws Exception {
        DocumentSnapshot snapshot = new DocumentSnapshot(
                com.healthcare.document.entity.DocumentSourceType.VISIT_SUMMARY,
                java.util.UUID.randomUUID(),
                42L,
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                "Phạm Thị Lê Long Quý Bình Dương",
                "0901234567",
                "BS. Nguyễn Trường Giang Khánh",
                OffsetDateTime.parse("2026-03-01T10:15:00Z"),
                new DocumentSnapshot.VisitSummaryPayload(
                        "BK-2026-0001",
                        OffsetDateTime.parse("2026-03-01T08:00:00Z"),
                        "J06.9", "Acute upper respiratory infection",
                        "Nhiệt độ cao kéo dài, ho khan về đêm, viêm đường hô hấp trên",
                        "Ho, sốt, mệt mỏi",
                        120, 80, 96, new BigDecimal("38.5"),
                        new BigDecimal("62.00"), new BigDecimal("168.00"),
                        ("Nghỉ ngơi tuyệt đối tại nhà trong 5 ngày. Uống nhiều nước ấm, "
                            + "súc họng nước muối mỗi sáng. Uống thuốc theo đơn, không tự ý "
                            + "tăng liều. ").repeat(120),
                        "Theo dõi nhiệt độ hai lần mỗi ngày; quay lại nếu sốt trên 39 độ.",
                        LocalDate.parse("2026-03-08")),
                null);

        byte[] pdf = renderer.renderVisitSummary(snapshot, "fixedhash");
        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isGreaterThan(1);
        }
    }

    private String extractText(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private DocumentSnapshot visitSnapshot(String patientName) {
        return new DocumentSnapshot(
                com.healthcare.document.entity.DocumentSourceType.VISIT_SUMMARY,
                java.util.UUID.fromString("00000000-0000-4000-8000-000000000001"),
                1710000000000L,
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                patientName,
                "0901234567",
                "BS. Nguyễn Trường Giang",
                OffsetDateTime.parse("2026-03-01T10:15:00Z"),
                new DocumentSnapshot.VisitSummaryPayload(
                        "BK-2026-0001",
                        OffsetDateTime.parse("2026-03-01T08:00:00Z"),
                        "J06.9", "Acute upper respiratory infection",
                        "Viêm đường hô hấp trên thể nhẹ",
                        "Ho, sốt nhẹ",
                        120, 80, 88, new BigDecimal("37.5"),
                        new BigDecimal("58.50"), new BigDecimal("165.00"),
                        "Nghỉ ngơi, uống nước ấm, thuốc theo đơn",
                        "Tái khám nếu sốt kéo dài quá ba ngày",
                        LocalDate.parse("2026-03-08")),
                null);
    }

    private DocumentSnapshot prescriptionSnapshot(String patientName) {
        return new DocumentSnapshot(
                com.healthcare.document.entity.DocumentSourceType.PRESCRIPTION,
                java.util.UUID.fromString("00000000-0000-4000-8000-000000000002"),
                1710000000001L,
                SyntheticPdfRenderer.TEMPLATE_VERSION,
                patientName,
                "0912345678",
                "BS. Lê Minh Khuê",
                OffsetDateTime.parse("2026-03-01T10:20:00Z"),
                null,
                new DocumentSnapshot.PrescriptionPayload(
                        "RX-260301-ABCD2345",
                        "Viêm đường hô hấp trên thể nhẹ",
                        "Uống nhiều nước, nghỉ ngơi, tránh đồ lạnh",
                        "ACTIVE",
                        List.of(new DocumentSnapshot.PrescriptionItemSnapshot(
                                "Paracetamol", "Acetaminophen", "500", "mg",
                                "Mỗi 8 giờ", 5, 15, "Uống sau ăn"),
                                new DocumentSnapshot.PrescriptionItemSnapshot(
                                "Vitamin C", "Ascorbic acid", "100", "mg",
                                "Mỗi ngày một lần", 7, 7, null))));
    }
}
