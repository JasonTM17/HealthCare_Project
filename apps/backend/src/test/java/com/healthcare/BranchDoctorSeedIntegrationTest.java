package com.healthcare;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class BranchDoctorSeedIntegrationTest extends AbstractIntegrationTest {
    @Autowired private JdbcTemplate jdbc;

    @Test
    void eachActiveBranchSpecialtyGetsOneLinkedDoctorAndTenShifts() throws Exception {
        jdbc.update("""
            insert into branches (id, name, slug, address, active)
            select gen_random_uuid(), 'Seed branch ' || n, 'seed-branch-' || n, 'Test address', n < 3
            from generate_series(1, 3) n
            """);
        jdbc.update("""
            insert into specialties (id, name, slug, active)
            select gen_random_uuid(), 'Seed specialty ' || n, 'seed-specialty-' || n, n < 4
            from generate_series(1, 4) n
            """);
        runSeed();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/hospital/doctors").param("branchSlug", "seed-branch-1"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.totalElements").value(3));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/hospital/doctors").param("branchSlug", "seed-branch-2")
                .param("specialtySlug", "seed-specialty-2"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.totalElements").value(1))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.content[0].branchNames[0]").value("Seed branch 2"));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/hospital/doctors").param("branchSlug", "seed-branch-3"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.totalElements").value(0));
        assertThat(jdbc.queryForObject("select count(*) from doctors where slug like 'demo-bs-%'", Integer.class))
            .isEqualTo(6);
        assertThat(jdbc.queryForObject("""
            select count(*) from doctors d
            join doctor_branches b on b.doctor_id = d.id
            join doctor_specialties s on s.doctor_id = d.id
            where d.slug like 'demo-bs-%' and d.bio like 'DỮ LIỆU MINH HỌA:%'
            """, Integer.class)).isEqualTo(6);
        assertThat(jdbc.queryForObject("""
            select count(*) from doctor_schedules s join doctors d on d.id = s.doctor_id
            where d.slug like 'demo-bs-%' and s.active and s.day_of_week between 1 and 5
                and s.start_time < s.end_time and s.slot_duration_minutes = 30
            """, Integer.class)).isEqualTo(60);
        jdbc.execute("drop table branch_demo_doctor_seed");
        runSeed();
        assertThat(jdbc.queryForObject("select count(*) from doctors where slug like 'demo-bs-%'", Integer.class))
            .isEqualTo(6);
        assertThat(jdbc.queryForObject("select count(*) from doctor_schedules", Integer.class)).isEqualTo(60);
    }

    private void runSeed() {
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            ScriptUtils.executeSqlScript(connection,
                new ClassPathResource("db/migration/V67__expand_branch_demo_doctor_catalog.sql"));
            return null;
        });
    }
}
