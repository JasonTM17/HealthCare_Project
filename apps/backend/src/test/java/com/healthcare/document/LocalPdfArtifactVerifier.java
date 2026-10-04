package com.healthcare.document;

import com.healthcare.document.service.SyntheticPdfRenderer;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class LocalPdfArtifactVerifier {
    @TestFactory
    Stream<DynamicTest> actualDownloadedDocumentsParse() {
        String directory = System.getProperty("local.pdf.artifacts.dir");
        if (directory == null || directory.isBlank()) throw new IllegalStateException("Actual local PDF artifact directory is required");
        Path root = Path.of(directory).toAbsolutePath();
        Map<String,String> titles = Map.of("visit-summary.pdf","BẢN TỔNG KẾT LẦN KHÁM","prescription.pdf","ĐƠN THUỐC","appointment-reminder.pdf","GIẤY NHẮC LỊCH HẸN KHÁM");
        return titles.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(entry -> DynamicTest.dynamicTest(entry.getKey(), () -> {
            byte[] bytes = Files.readAllBytes(root.resolve(entry.getKey()));
            assertThat(bytes.length).isGreaterThan(5);
            assertThat(new String(bytes,0,5,StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
            try (PDDocument pdf = Loader.loadPDF(bytes)) {
                assertThat(pdf.getNumberOfPages()).isGreaterThan(0);
                String text = new PDFTextStripper().getText(pdf);
                assertThat(text.contains(SyntheticPdfRenderer.DISCLAIMER_LINE)).as("unsigned synthetic disclaimer present").isTrue();
                assertThat(text.contains(entry.getValue())).as("correct document class title present").isTrue();
                assertThat(pdf.getDocumentInformation().getCustomMetadataValue("SourceContentSha256")).matches("[0-9a-f]{64}");
                System.out.printf("LOCAL_PDF_PARSE alias=%s pages=%d bytes=%d%n",entry.getKey(),pdf.getNumberOfPages(),bytes.length);
            }
        }));
    }
}
