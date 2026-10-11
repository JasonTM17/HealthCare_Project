package com.healthcare.storage;

import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.storage.entity.StoredFile;
import com.healthcare.storage.repository.StoredFileRepository;
import com.healthcare.storage.service.FileStorageService;
import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import java.io.ByteArrayInputStream;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FileStorageDownloadIntegrityTest {
    private static final String KEY = "clinical-reports/owned.pdf";
    private final UserDetails admin = User.withUsername("test").password("unused").roles("ADMIN").build();
    private MinioClient client;
    private StoredFileRepository repository;
    private ClinicalAccessAuditService audit;
    private FileStorageService service;

    @BeforeEach
    void setUp() {
        client = mock(MinioClient.class);
        repository = mock(StoredFileRepository.class);
        audit = mock(ClinicalAccessAuditService.class);
        service = new FileStorageService(client, repository, null, null, null, null, null, null, audit);
        ReflectionTestUtils.setField(service, "bucket", "healthcare-files");
        ReflectionTestUtils.setField(service, "bucketReady", true);
        ReflectionTestUtils.setField(service, "uploadEnabled", true);
        ReflectionTestUtils.setField(service, "maxFileSizeBytes", 10485760L);
    }

    private GetObjectResponse object(byte[] bytes, Long expectedSize) throws Exception {
        if (expectedSize == null) {
            when(repository.findByObjectKey(KEY)).thenReturn(Optional.empty());
        } else {
            StoredFile file = new StoredFile();
            file.setObjectKey(KEY);
            file.setSizeBytes(expectedSize);
            when(repository.findByObjectKey(KEY)).thenReturn(Optional.of(file));
        }
        GetObjectResponse response = spy(new GetObjectResponse(
                new okhttp3.Headers.Builder().build(), "healthcare-files", null, KEY,
                new ByteArrayInputStream(bytes)));
        when(client.getObject(any())).thenReturn(response);
        return response;
    }

    @Test
    void mismatchedStoredSizeCannotReturnOrAuditAllow() throws Exception {
        GetObjectResponse response = object(new byte[603], 384512L);
        assertThatThrownBy(() -> service.download(KEY, admin))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(error -> ((ResponseStatusException) error).getStatusCode().value()).isEqualTo(503);
        verify(response).close();
        verify(audit, never()).record(any(), any(), any(), any(), any(), eq("ALLOW"));
        verify(audit).record(eq(admin), isNull(), eq(ClinicalAccessAuditService.TARGET_FILE),
                eq(KEY), eq(ClinicalAccessAuditService.ACTION_DOWNLOAD), eq("DENY"));
    }

    @Test
    void exactSizeReturnsBytesAndClosesUpstream() throws Exception {
        byte[] bytes = "%PDF-1.7 owned test".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        GetObjectResponse response = object(bytes, (long) bytes.length);
        assertThat(service.download(KEY, admin)).isEqualTo(bytes);
        verify(response).close();
        verify(audit).record(eq(admin), isNull(), any(), eq(KEY), any(), eq("ALLOW"));
    }

    @Test
    void legacyAdminAccessPreservesBoundedDownloadWithoutInventedMetadata() throws Exception {
        GetObjectResponse response = object(new byte[603], null);
        assertThat(service.download(KEY, admin)).hasSize(603);
        verify(response).close();
    }

    @Test
    void unauthorizedIdentityDeniedBeforeObjectFetch() throws Exception {
        StoredFile file = new StoredFile();
        when(repository.findByObjectKey(KEY)).thenReturn(Optional.of(file));
        UserDetails unrelated = User.withUsername("unrelated").password("unused").roles("PATIENT").build();
        assertThatThrownBy(() -> service.download(KEY, unrelated))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(client, never()).getObject(any());
        verify(audit, never()).record(any(), any(), any(), any(), any(), eq("ALLOW"));
    }
}
