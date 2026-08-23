package com.healthcare.auth;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.auth.entity.AuthOtpChallenge;
import com.healthcare.auth.entity.AuthOtpPurpose;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.auth.repository.AuthOtpChallengeRepository;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.dto.AuthResponse;
import com.healthcare.user.dto.RefreshTokenRequest;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class AuthConcurrencyRegressionTest extends TestcontainersIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private AuthOtpService authOtpService;

    @Autowired
    private AuthOtpChallengeRepository challengeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtProperties jwtProperties;

    @MockitoBean
    private EmailSender emailSender;

    @MockitoSpyBean
    private UserSecurityLock userSecurityLockSpy;

    @MockitoSpyBean
    private JwtTokenProvider tokenProviderSpy;

    @Test
    void revokeAllWaitsForRefreshRotationAndRevokesItsReplacement() throws Exception {
        User user = createVerifiedUser("refresh.revoke.race@example.com");
        String originalToken = tokenProviderSpy.generateRefreshToken(user.getId());
        saveRefreshToken(user, originalToken);

        CountDownLatch rotationEntered = new CountDownLatch(1);
        CountDownLatch releaseRotation = new CountDownLatch(1);
        CountDownLatch revokeOwnerLockAttempted = new CountDownLatch(1);

        doAnswer(invocation -> {
            if ("refresh-race".equals(Thread.currentThread().getName())) {
                rotationEntered.countDown();
                if (!releaseRotation.await(10, TimeUnit.SECONDS)) {
                    throw new AssertionError("Timed out waiting to release refresh rotation");
                }
            }
            return invocation.callRealMethod();
        }).when(tokenProviderSpy).generateRefreshToken(user.getId());

        doAnswer(invocation -> {
            if ("revoke-race".equals(Thread.currentThread().getName())) {
                revokeOwnerLockAttempted.countDown();
            }
            return invocation.callRealMethod();
        }).when(userSecurityLockSpy).findByIdForUpdate(user.getId());

        ExecutorService refreshExecutor = namedExecutor("refresh-race");
        ExecutorService revokeExecutor = namedExecutor("revoke-race");
        Future<AuthResponse> refresh = null;
        Future<?> revoke = null;
        try {
            refresh = refreshExecutor.submit(
                () -> authService.refreshToken(new RefreshTokenRequest(originalToken))
            );
            boolean reachedRotation = rotationEntered.await(5, TimeUnit.SECONDS);
            if (!reachedRotation && refresh.isDone()) {
                refresh.get(1, TimeUnit.SECONDS);
            }
            assertThat(reachedRotation)
                .as("refresh reached replacement generation")
                .isTrue();

            revoke = revokeExecutor.submit(() -> authService.logout(user.getId()));
            boolean usedOwnerLock = revokeOwnerLockAttempted.await(2, TimeUnit.SECONDS);
            releaseRotation.countDown();

            AuthResponse rotated = refresh.get(10, TimeUnit.SECONDS);
            revoke.get(10, TimeUnit.SECONDS);

            assertThat(usedOwnerLock)
                .as("revoke-all must enter the same user-row lock used by rotation")
                .isTrue();
            assertThat(refreshTokenRepository.findAllActiveByUserId(user.getId())).isEmpty();
            assertThat(refreshTokenRepository.findByTokenHash(hashToken(rotated.refreshToken())))
                .get()
                .extracting(RefreshToken::isRevoked)
                .isEqualTo(true);
        } finally {
            releaseRotation.countDown();
            refreshExecutor.shutdownNow();
            revokeExecutor.shutdownNow();
            refreshExecutor.awaitTermination(5, TimeUnit.SECONDS);
            revokeExecutor.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    @Test
    void concurrentFirstOtpIssuanceSerializesOnOwnerAndDeliversOneActiveCode() throws Exception {
        User user = createVerifiedUser("otp.first.race@example.com");
        CountDownLatch firstOwnerLocked = new CountDownLatch(1);
        CountDownLatch releaseFirstOwner = new CountDownLatch(1);
        CountDownLatch secondOwnerLockAttempted = new CountDownLatch(1);

        doAnswer(invocation -> {
            String threadName = Thread.currentThread().getName();
            if ("otp-first".equals(threadName)) {
                Object lockedUser = invocation.callRealMethod();
                firstOwnerLocked.countDown();
                if (!releaseFirstOwner.await(10, TimeUnit.SECONDS)) {
                    throw new AssertionError("Timed out waiting to release the first OTP owner lock");
                }
                return lockedUser;
            }
            if ("otp-second".equals(threadName)) {
                secondOwnerLockAttempted.countDown();
            }
            return invocation.callRealMethod();
        }).when(userSecurityLockSpy).findByIdForUpdate(user.getId());

        ExecutorService firstExecutor = namedExecutor("otp-first");
        ExecutorService secondExecutor = namedExecutor("otp-second");
        try {
            Future<?> first = firstExecutor.submit(
                () -> authOtpService.requestPasswordReset(user.getEmail(), null)
            );
            boolean acquiredOwnerLock = firstOwnerLocked.await(5, TimeUnit.SECONDS);
            if (!acquiredOwnerLock && first.isDone()) {
                first.get(1, TimeUnit.SECONDS);
            }
            assertThat(acquiredOwnerLock)
                .as("first issuance acquired the stable user-row lock")
                .isTrue();

            Future<?> second = secondExecutor.submit(
                () -> authOtpService.requestPasswordReset(user.getEmail(), null)
            );
            assertThat(secondOwnerLockAttempted.await(5, TimeUnit.SECONDS))
                .as("second issuance attempted the same stable user-row lock")
                .isTrue();
            assertThat(second.isDone()).isFalse();

            releaseFirstOwner.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);

            List<AuthOtpChallenge> challenges = challengeRepository.findAll();
            assertThat(challenges).hasSize(1);
            assertThat(challenges.getFirst().getPurpose()).isEqualTo(AuthOtpPurpose.PASSWORD_RESET);
            assertThat(challenges.getFirst().getConsumedAt()).isNull();
            verify(emailSender, times(1)).send(anyString(), anyString(), anyString());
        } finally {
            releaseFirstOwner.countDown();
            firstExecutor.shutdownNow();
            secondExecutor.shutdownNow();
            firstExecutor.awaitTermination(5, TimeUnit.SECONDS);
            secondExecutor.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    private User createVerifiedUser(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("Str0ng!Pass"));
        user.setDisplayName("Concurrency Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.saveAndFlush(user);
    }

    private void saveRefreshToken(User user, String token) {
        RefreshToken stored = new RefreshToken();
        stored.setUser(user);
        stored.setTokenHash(hashToken(token));
        stored.setExpiresAt(OffsetDateTime.now().plusSeconds(jwtProperties.refreshTokenTtl()));
        stored.setCreatedAt(OffsetDateTime.now());
        refreshTokenRepository.saveAndFlush(stored);
    }

    private String hashToken(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new AssertionError("SHA-256 unavailable", exception);
        }
    }

    private ExecutorService namedExecutor(String threadName) {
        return Executors.newSingleThreadExecutor(runnable -> new Thread(runnable, threadName));
    }
}
