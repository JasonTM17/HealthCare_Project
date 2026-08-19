package com.healthcare.storage.controller;

import com.healthcare.storage.service.FileStorageService;
import com.healthcare.storage.dto.StoredFileResponse;
import com.healthcare.storage.entity.StoredFile;
import com.healthcare.storage.entity.StoredFilePurpose;
import org.springframework.http.ContentDisposition;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/files")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<StoredFileResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) UUID patientId,
            @RequestParam(defaultValue = "GENERAL") StoredFilePurpose purpose,
            @AuthenticationPrincipal UserDetails userDetails) throws Exception {
        StoredFile storedFile = fileStorageService.upload(file, patientId, purpose, userDetails);
        return ResponseEntity.ok(StoredFileResponse.from(storedFile));
    }

    @GetMapping("/{objectName}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'PATIENT')")
    public ResponseEntity<Resource> download(
            @PathVariable String objectName,
            @AuthenticationPrincipal UserDetails userDetails) throws Exception {
        byte[] data = fileStorageService.download(objectName, userDetails);
        StoredFile metadata = fileStorageService.findMetadata(objectName).orElse(null);
        String filename = metadata == null ? "download" : metadata.getOriginalFilename();
        MediaType contentType = metadata == null
            ? MediaType.APPLICATION_OCTET_STREAM
            : MediaType.parseMediaType(metadata.getContentType());
        return ResponseEntity.ok()
            .contentType(contentType)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
            .body(new ByteArrayResource(data));
    }

    @DeleteMapping("/{objectName}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String objectName) throws Exception {
        fileStorageService.delete(objectName);
        return ResponseEntity.noContent().build();
    }
}
