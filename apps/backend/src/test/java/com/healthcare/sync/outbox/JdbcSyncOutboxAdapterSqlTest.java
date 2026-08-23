package com.healthcare.sync.outbox;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class JdbcSyncOutboxAdapterSqlTest {

    @Test
    void insertUsesV30GeneratedIdempotencyAndLeaseColumnNames() throws Exception {
        String insert = sql("INSERT_EVENT");
        String select = sql("SELECT_COLUMNS");
        String claim = sql("CLAIM_EVENT");
        String acknowledge = sql("ACKNOWLEDGE_EVENT");
        String insertColumns = insert.substring(0, insert.indexOf(") VALUES"));

        assertThat(insertColumns)
            .contains("entity_classification")
            .doesNotContain("idempotency_key")
            .doesNotContain("\n            classification,")
            .doesNotContain("lease_token");
        assertThat(insert)
            .contains("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)");
        assertThat(count(insert, '?')).isEqualTo(11);
        assertThat(select)
            .contains("entity_classification")
            .contains("lease_token");
        assertThat(claim)
            .contains("lease_token")
            .contains("claimed_at")
            .contains("worker_id")
            .doesNotContain("claim_token");
        assertThat(acknowledge)
            .contains("lease_token")
            .contains("acknowledged_at")
            .doesNotContain("claim_token");
    }

    private String sql(String fieldName) throws Exception {
        Field field = JdbcSyncOutboxAdapter.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        return (String) field.get(null);
    }

    private int count(String value, char character) {
        return (int) value.chars().filter(codePoint -> codePoint == character).count();
    }
}
