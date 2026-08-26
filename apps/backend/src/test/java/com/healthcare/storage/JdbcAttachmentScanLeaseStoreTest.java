package com.healthcare.storage;

import com.healthcare.storage.service.AttachmentScanAuditHook;
import com.healthcare.storage.service.JdbcAttachmentScanLeaseStore;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class JdbcAttachmentScanLeaseStoreTest {

    @Test
    void acquireMapsDatabaseLeaseAndReleaseUsesTokenPredicate() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID attachmentId = UUID.randomUUID();
        UUID leaseId = UUID.randomUUID();
        String objectKey = "private/consultations/thread/attachment/object.sig";
        AttachmentScanAuditHook.ScanLease expected = new AttachmentScanAuditHook.ScanLease(
            leaseId, attachmentId, objectKey,
            Instant.parse("2026-08-25T12:00:00Z"),
            Instant.parse("2026-08-25T12:02:00Z"));
        when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<AttachmentScanAuditHook.ScanLease>>any(),
            any(Object[].class))).thenReturn(List.of(expected));

        JdbcAttachmentScanLeaseStore store = new JdbcAttachmentScanLeaseStore(jdbc);
        Optional<AttachmentScanAuditHook.ScanLease> actual = store.tryAcquire(
            attachmentId, objectKey, Duration.ofMinutes(2));

        assertThat(actual).contains(expected);
        verify(jdbc).query(contains("RETURNING scan_lease_token"),
            org.mockito.ArgumentMatchers.<RowMapper<AttachmentScanAuditHook.ScanLease>>any(),
            any(Object[].class));

        store.release(expected);
        verify(jdbc).update(contains("scan_lease_token = NULL"),
            eq(attachmentId), eq(objectKey), eq(leaseId));
    }

    @Test
    void databaseFailureKeepsAttachmentQuarantined() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
            .thenThrow(new IllegalStateException("database unavailable"));

        Optional<AttachmentScanAuditHook.ScanLease> lease =
            new JdbcAttachmentScanLeaseStore(jdbc).tryAcquire(
                UUID.randomUUID(), "private/consultations/thread/attachment/object.sig", Duration.ofMinutes(2));

        assertThat(lease).isEmpty();
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }
}
