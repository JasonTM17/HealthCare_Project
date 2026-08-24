package com.healthcare.ai;

import com.healthcare.ai.chat.service.SyntheticBetaGuardService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

class SyntheticBetaGuardServiceTest {

    @Test
    void requiresGuardAndEverySyntheticPatientProjection() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doReturn(true).when(jdbc).queryForObject(anyString(), eq(Boolean.class));
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(true);

        assertThat(new SyntheticBetaGuardService(jdbc).eligible(UUID.randomUUID())).isTrue();
    }

    @Test
    void failsClosedWhenGuardIsDisabled() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doReturn(false).when(jdbc).queryForObject(anyString(), eq(Boolean.class));
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
            .thenReturn(false);

        assertThat(new SyntheticBetaGuardService(jdbc).eligible(UUID.randomUUID())).isFalse();
    }

    @Test
    void disabledCompatibilityInstanceCannotAuthorizeRemoteEgress() {
        assertThat(SyntheticBetaGuardService.disabled().eligible(UUID.randomUUID())).isFalse();
    }
}
