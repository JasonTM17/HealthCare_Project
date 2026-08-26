package com.healthcare.consultation;

import com.healthcare.consultation.service.PatientConsultationRetentionService;
import com.healthcare.storage.service.ConsultationAttachmentStorage;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.contains;
import org.mockito.InOrder;
import static org.mockito.Mockito.*;

class PatientConsultationRetentionServiceTest {
    @Test
    void patientDeletionSetsPrivateCleanupGucAndDeletesOnlyOwnedThread() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID userId = UUID.randomUUID();
        UUID threadId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        when(jdbc.update(contains("DELETE FROM patient_consultation_threads"), eq(threadId), eq(userId))).thenReturn(1);

        PatientConsultationRetentionService service = new PatientConsultationRetentionService(jdbc, users, true, 100, 20);
        service.deleteForPatient(threadId, principal);

        verify(jdbc).execute("SET LOCAL healthcare.retention_cleanup = 'on'");
        verify(jdbc).update(contains("USING patient_profiles"), eq(threadId), eq(userId));
    }

    @Test
    void missingOwnedThreadIsNotDisclosed() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        UserDetails principal = mock(UserDetails.class);
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);

        PatientConsultationRetentionService service = new PatientConsultationRetentionService(jdbc, users, true, 100, 20);
        assertThatThrownBy(() -> service.deleteForPatient(UUID.randomUUID(), principal))
            .isInstanceOf(com.healthcare.exception.ResourceNotFoundException.class)
            .extracting("code").isEqualTo("CONSULTATION_NOT_FOUND");
    }

    @Test
    void deletesAllAttachmentObjectsBeforeDeletingOwnedThreadRows() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        UserDetails principal = mock(UserDetails.class);
        UUID userId = UUID.randomUUID();
        UUID threadId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        when(jdbc.query(contains("patient_consultation_attachments"), any(RowMapper.class),
                eq(threadId), eq(userId))).thenReturn(List.of(List.of(
                "private/consultations/" + threadId + "/upload/a",
                "private/consultations/" + threadId + "/upload/a",
                "private/consultations/" + threadId + "/verified/a")));
        when(jdbc.update(contains("DELETE FROM patient_consultation_threads"), eq(threadId), eq(userId)))
            .thenReturn(1);

        PatientConsultationRetentionService service = new PatientConsultationRetentionService(
            jdbc, users, storage, true, 100, 20);
        service.deleteForPatient(threadId, principal);

        InOrder order = inOrder(storage, jdbc);
        order.verify(storage).deleteObjects(List.of(
            "private/consultations/" + threadId + "/upload/a",
            "private/consultations/" + threadId + "/verified/a"));
        order.verify(jdbc).update(contains("DELETE FROM patient_consultation_threads"), eq(threadId), eq(userId));
    }

    @Test
    void storageFailureKeepsDatabaseRowsForRetry() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserRepository users = mock(UserRepository.class);
        ConsultationAttachmentStorage storage = mock(ConsultationAttachmentStorage.class);
        UserDetails principal = mock(UserDetails.class);
        UUID userId = UUID.randomUUID();
        UUID threadId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(principal.getUsername()).thenReturn("patient@example.test");
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        when(jdbc.query(contains("patient_consultation_attachments"), any(RowMapper.class),
                eq(threadId), eq(userId))).thenReturn(List.of(java.util.Arrays.asList(
                "private/consultations/" + threadId + "/upload/a",
                "private/consultations/" + threadId + "/upload/a",
                "private/consultations/" + threadId + "/verified/a")));
        doThrow(new IllegalStateException("closed storage failure"))
            .when(storage).deleteObjects(anyCollection());

        PatientConsultationRetentionService service = new PatientConsultationRetentionService(
            jdbc, users, storage, true, 100, 20);
        assertThatThrownBy(() -> service.deleteForPatient(threadId, principal))
            .isInstanceOf(IllegalStateException.class);
        verify(jdbc, never()).update(contains("DELETE FROM patient_consultation_threads"), any(), any());
    }
}
