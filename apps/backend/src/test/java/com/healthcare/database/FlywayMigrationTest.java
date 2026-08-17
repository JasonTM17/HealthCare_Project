package com.healthcare.database;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class FlywayMigrationTest {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void identityRbacTablesAreMigrated() {
        List<String> tables = jdbcTemplate.queryForList(
            "select table_name from information_schema.tables where table_schema = 'public'",
            String.class
        );

        assertThat(tables).contains("users", "roles", "permissions", "user_roles", "role_permissions", "refresh_tokens");
    }

    @Test
    void defaultRolesAreSeeded() {
        List<String> roles = jdbcTemplate.queryForList("select code from roles order by code", String.class);

        assertThat(roles).containsExactly("ADMIN", "DOCTOR", "PATIENT");
    }
}
