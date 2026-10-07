package com.healthcare.auth;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.dto.RefreshTokenRequest;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Rejection must commit security revocation even though the service throws. */
@TestPropertySource(properties = "healthcare.demo.login-allowed=false")
class RefreshRevocationCommitTest extends AbstractIntegrationTest {

    @Autowired private AuthService authService;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private BrowserSessionService browserSessionService;

    @Test
    void disabledDemoRefreshCommitsCredentialAndSessionRevocation() throws Exception {
        assertCommittedRevocation(true, true, ErrorCodes.DEMO_LOGIN_DISABLED);
    }

    @Test
    void unverifiedEmailRefreshCommitsCredentialAndSessionRevocation() throws Exception {
        assertCommittedRevocation(false, false, ErrorCodes.EMAIL_VERIFICATION_REQUIRED);
    }

    private void assertCommittedRevocation(boolean demo, boolean verified, String expectedCode)
            throws Exception {
        User user = new User();
        user.setEmail(demo ? "revoked-demo@example.test" : "revoked-verification@example.test");
        user.setPasswordHash("synthetic-password-hash");
        user.setDisplayName("Synthetic revocation subject");
        user.setStatus("ACTIVE");
        user.setDemo(demo);
        user.setEmailVerified(verified);
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user = userRepository.saveAndFlush(user);

        String refresh = tokenProvider.generateRefreshToken(user.getId());
        RefreshToken stored = new RefreshToken();
        stored.setUser(user);
        stored.setTokenHash(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(refresh.getBytes(StandardCharsets.UTF_8))));
        stored.setCreatedAt(OffsetDateTime.now());
        stored.setExpiresAt(OffsetDateTime.now().plusDays(1));
        refreshTokenRepository.saveAndFlush(stored);
        browserSessionService.issue(user.getId());

        // No outer test transaction: fresh JDBC reads observe the service proxy's commit.
        assertThatThrownBy(() -> authService.refreshToken(new RefreshTokenRequest(refresh)))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getCode())
                .isEqualTo(expectedCode));

        assertThat(jdbcTemplate.queryForObject(
            "SELECT count(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
            Long.class, user.getId()))
            .as("refresh credentials remain revoked outside the rejected transaction")
            .isZero();
        assertThat(jdbcTemplate.queryForObject(
            "SELECT count(*) FROM browser_sessions WHERE user_id = ? AND revoked_at IS NULL",
            Long.class, user.getId()))
            .as("browser sessions remain revoked outside the rejected transaction")
            .isZero();
    }
}
