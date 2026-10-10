package com.healthcare.exception;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import java.util.UUID;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PdfErrorNegotiationTest {
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new PdfEndpoint())
            .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void jsonOnlyAcceptGetsTyped406InsteadOfInternalError() throws Exception {
        mvc.perform(get("/test/pdf/conflict").accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotAcceptable())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(ErrorCodes.REQUEST_FAILED))
            .andExpect(jsonPath("$.status").value(406));
    }

    @Test
    void pdfAcceptStillGetsReadableBusinessConflict() throws Exception {
        assertPdfError("conflict", 409, ErrorCodes.CONFLICT);
    }

    @Test
    void pdfAcceptStillGetsReadableResponseStatusConflict() throws Exception {
        assertPdfError("status", 409, ErrorCodes.CONFLICT);
    }

    @Test
    void pdfAcceptStillGetsReadableMissingDocument() throws Exception {
        assertPdfError("missing", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    @Test
    void pdfAcceptStillGetsReadableAccessDenial() throws Exception {
        assertPdfError("denied", 403, ErrorCodes.ACCESS_DENIED);
    }

    @Test
    void malformedDocumentIdIsReadable400UnderPdfAccept() throws Exception {
        mvc.perform(get("/test/pdf/invalid/not-a-uuid").accept(MediaType.APPLICATION_PDF))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value(ErrorCodes.VALIDATION_ERROR));
    }

    private void assertPdfError(String path, int expectedStatus, String code) throws Exception {
        mvc.perform(get("/test/pdf/" + path).accept(MediaType.APPLICATION_PDF))
            .andExpect(status().is(expectedStatus))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.status").value(expectedStatus))
            .andExpect(jsonPath("$.code").value(code))
            .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @RestController
    static class PdfEndpoint {
        @GetMapping(value = "/test/pdf/invalid/{id}", produces = MediaType.APPLICATION_PDF_VALUE)
        byte[] invalid(@PathVariable UUID id) { return new byte[0]; }

        @GetMapping(value = "/test/pdf/conflict", produces = MediaType.APPLICATION_PDF_VALUE)
        byte[] conflict() { throw new BusinessException(409, "Tài liệu chưa sẵn sàng."); }

        @GetMapping(value = "/test/pdf/status", produces = MediaType.APPLICATION_PDF_VALUE)
        byte[] responseStatus() { throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài liệu chưa sẵn sàng."); }

        @GetMapping(value = "/test/pdf/missing", produces = MediaType.APPLICATION_PDF_VALUE)
        byte[] missing() { throw new ResourceNotFoundException("Không tìm thấy tài liệu."); }

        @GetMapping(value = "/test/pdf/denied", produces = MediaType.APPLICATION_PDF_VALUE)
        byte[] denied() { throw new AccessDeniedException("private technical detail"); }
    }
}
