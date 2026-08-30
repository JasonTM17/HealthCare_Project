package com.healthcare.clinical;

import static org.assertj.core.api.Assertions.assertThat;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

/** Verifies append-only access evidence can be written from read-only callers. */
class ClinicalAccessAuditTransactionIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ClinicalAccessAuditService clinicalAccessAuditService;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void auditWriteUsesIndependentTransactionFromReadOnlyCaller() {
        UUID patientId = UUID.randomUUID();

        TransactionTemplate readOnlyTransaction = new TransactionTemplate(transactionManager);
        readOnlyTransaction.setReadOnly(true);
        readOnlyTransaction.executeWithoutResult(status -> clinicalAccessAuditService.record(
                null,
                patientId,
                ClinicalAccessAuditService.TARGET_MEDICAL_RECORD,
                "read-only-regression",
                ClinicalAccessAuditService.ACTION_READ,
                ClinicalAccessAuditService.DECISION_ALLOW
            ));

        Integer allowCount = jdbcTemplate.queryForObject(
            """
            select count(*) from clinical_access_audit
            where target_type = 'MEDICAL_RECORD' and decision = 'ALLOW'
              and target_id = ? and patient_id = ?
            """,
            Integer.class,
            "read-only-regression",
            patientId
        );
        assertThat(allowCount).isEqualTo(1);
    }
}
