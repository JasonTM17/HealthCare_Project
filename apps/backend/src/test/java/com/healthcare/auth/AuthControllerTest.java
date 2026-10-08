package com.healthcare.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.auth.repository.AuthOtpChallengeRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.appointment.entity.PatientProfile;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerTest extends TestcontainersIntegrationTest {
    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private AuthOtpChallengeRepository authOtpChallengeRepository;

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockitoBean
    private EmailSender emailSender;

    private final AtomicReference<String> lastEmailBody = new AtomicReference<>("");
    private final AtomicInteger sentEmailCount = new AtomicInteger();

    @BeforeEach
    void captureAuthEmail() {
        lastEmailBody.set("");
        sentEmailCount.set(0);
        doAnswer(invocation -> {
            lastEmailBody.set(invocation.getArgument(2, String.class));
            sentEmailCount.incrementAndGet();
            return null;
        }).when(emailSender).send(anyString(), anyString(), anyString());
    }

    @Test
    void registrationAndOtpIssuanceSucceedWhenSmtpFailsWithOutboxDisabled() throws Exception {
        doThrow(new IllegalStateException("SMTP unavailable"))
            .when(emailSender).send(anyString(), anyString(), anyString());

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "smtp.down.registration@example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "SMTP Down Registration"
                    }
                    """))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.verificationRequired").value(true));

        User user = userRepository.findByEmail("smtp.down.registration@example.com").orElseThrow();
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(authOtpChallengeRepository.findAll()).anySatisfy(challenge -> {
            assertThat(challenge.getUser().getId()).isEqualTo(user.getId());
            assertThat(challenge.getPurpose()).isEqualTo(com.healthcare.auth.entity.AuthOtpPurpose.EMAIL_VERIFICATION);
            assertThat(challenge.getConsumedAt()).isNull();
        });

        mockMvc.perform(post("/api/v1/auth/password-reset-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"smtp.down.registration@example.com\"}"))
            .andExpect(status().isAccepted());
        assertThat(authOtpChallengeRepository.findAll()).anySatisfy(challenge -> {
            assertThat(challenge.getUser().getId()).isEqualTo(user.getId());
            assertThat(challenge.getPurpose()).isEqualTo(com.healthcare.auth.entity.AuthOtpPurpose.PASSWORD_RESET);
            assertThat(challenge.getConsumedAt()).isNull();
        });
    }

    @Test
    void registerCreatesPatientAndDoesNotExposePasswordHash() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "Patient.One@Example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Patient One"
                    }
                    """))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.verificationRequired").value(true))
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andExpect(jsonPath("$.refreshToken").doesNotExist())
            .andExpect(jsonPath("$.passwordHash").doesNotExist())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("email").asText()).isEqualTo("patient.one@example.com");
        assertThat(userRepository.findByEmail("patient.one@example.com").orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void registrationWithPhoneCreatesLinkedPatientProfile() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "portal.patient@example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Portal Patient",
                      "phone": "090 123-4567"
                    }
                    """))
            .andExpect(status().isAccepted());

        var user = userRepository.findByEmail("portal.patient@example.com").orElseThrow();
        var profile = patientProfileRepository.findByUserId(user.getId()).orElseThrow();
        assertThat(profile.getPhone()).isEqualTo("0901234567");
        assertThat(profile.getFullName()).isEqualTo("Portal Patient");
    }

    @Test
    void registrationReusesMatchingUnlinkedBookingProfile() throws Exception {
        PatientProfile bookingProfile = new PatientProfile();
        bookingProfile.setFullName("Booking Name");
        bookingProfile.setPhone("0907654321");
        bookingProfile.setEmail("reuse.booking@example.com");
        bookingProfile = patientProfileRepository.saveAndFlush(bookingProfile);

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "reuse.booking@example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Registered Name",
                      "phone": "090 765-4321"
                    }
                    """))
            .andExpect(status().isAccepted());

        User user = userRepository.findByEmail("reuse.booking@example.com").orElseThrow();
        PatientProfile linked = patientProfileRepository.findByUserId(user.getId()).orElseThrow();
        assertThat(linked.getId()).isEqualTo(bookingProfile.getId());
        assertThat(linked.getFullName()).isEqualTo("Registered Name");
    }

    /**
     * A phone already bound to a live account must not be claimable by a
     * fresh registration. The block stays (anti-hijack), but the caller now
     * gets an actionable code instead of the generic CONFLICT.
     */
    @Test
    void registerWithPhoneAlreadyBoundToAnotherAccountReturnsOwnedByAccountCode() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "phone.owner@example.com",
                      "password": "%s",
                      "displayName": "Phone Owner",
                      "phone": "0901110001"
                    }
                    """.formatted(fixturePassword())))
            .andExpect(status().isAccepted());

        long profilesBefore = patientProfileRepository.count();

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "hijack.attempt@example.com",
                      "password": "%s",
                      "displayName": "Hijack Attempt",
                      "phone": "090 111-0001"
                    }
                    """.formatted(fixturePassword())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PHONE_OWNED_BY_ACCOUNT"))
            .andExpect(jsonPath("$.message").value(
                "Số điện thoại này đã liên kết một tài khoản khác — hãy đăng nhập hoặc dùng SĐT khác"));

        // Blocking behavior preserved: nothing persisted for the impostor.
        assertThat(userRepository.findByEmail("hijack.attempt@example.com")).isEmpty();
        assertThat(patientProfileRepository.count()).isEqualTo(profilesBefore);
    }

    /**
     * A guest booked with phone X under email Z; someone now registers phone
     * X with a different email W. Still blocked, but the code must tell them
     * which email to come back to — not the generic CONFLICT.
     */
    @Test
    void registerWithGuestBookingPhoneAndMismatchedEmailReturnsBookingEmailCode() throws Exception {
        PatientProfile bookingProfile = new PatientProfile();
        bookingProfile.setFullName("Guest Booked");
        bookingProfile.setPhone("0902220002");
        bookingProfile.setEmail("guest.booking@example.com");
        patientProfileRepository.saveAndFlush(bookingProfile);

        long profilesBefore = patientProfileRepository.count();

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "wrong.email@example.com",
                      "password": "%s",
                      "displayName": "Wrong Email",
                      "phone": "090 222-0002"
                    }
                    """.formatted(fixturePassword())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PHONE_LINKED_TO_BOOKING_EMAIL"))
            .andExpect(jsonPath("$.message").value(
                "Số điện thoại này đã dùng đặt lịch với một email khác — hãy đăng ký bằng email bạn đã nhận mã xác nhận đặt lịch"));

        // Blocking behavior preserved: nothing persisted for the impostor.
        assertThat(userRepository.findByEmail("wrong.email@example.com")).isEmpty();
        assertThat(patientProfileRepository.count()).isEqualTo(profilesBefore);
    }

    /**
     * Hermetic throwaway password for disposable Testcontainers accounts.
     * Generated per call so no credential literal is added to source.
     */
    private static String fixturePassword() {
        return "Fixture!" + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + "A1";
    }

    @Test
    void registerRejectsSeparatorOnlyPhoneWith400BeforeAnyProfileExists() throws Exception {
        long profilesBefore = patientProfileRepository.count();

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "separator.phone@example.com",
                      "password": "%s",
                      "displayName": "Separator Phone",
                      "phone": "-----"
                    }
                    """.formatted(fixturePassword())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.message").value("Số điện thoại không hợp lệ"))
            .andExpect(jsonPath("$.fieldErrors[0].field").value("phone"));

        // Nothing persisted: no user, and least of all a PatientProfile —
        // one without a phone would leave the account in a state the
        // portal profile page can never repair.
        assertThat(userRepository.findByEmail("separator.phone@example.com")).isEmpty();
        assertThat(patientProfileRepository.count()).isEqualTo(profilesBefore);
    }

    @Test
    void registerWithoutPhoneKeepsCurrentPhonelessAccountBehavior() throws Exception {
        long profilesBefore = patientProfileRepository.count();

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "no.phone@example.com",
                      "password": "%s",
                      "displayName": "No Phone",
                      "phone": ""
                    }
                    """.formatted(fixturePassword())))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.verificationRequired").value(true));

        var user = userRepository.findByEmail("no.phone@example.com").orElseThrow();
        assertThat(patientProfileRepository.findByUserId(user.getId())).isEmpty();
        assertThat(patientProfileRepository.count()).isEqualTo(profilesBefore);
    }

    @Test
    void duplicateVerifiedEmailReturnsConflict() throws Exception {
        String body = """
            {
              "email": "duplicate@example.com",
              "password": "Str0ng!Pass",
              "displayName": "Duplicate Patient"
            }
            """;

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isAccepted());

        User user = userRepository.findByEmail("duplicate@example.com").orElseThrow();
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(java.time.OffsetDateTime.now());
        userRepository.saveAndFlush(user);

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));
    }

    /**
     * Regression for the pending-account dead end: a lost code used to lock the
     * email forever (re-register 409, login EMAIL_VERIFICATION_REQUIRED). The
     * repeat request now re-issues the code and answers like a fresh
     * registration without touching the existing account.
     */
    @Test
    void duplicatePendingEmailResendsVerificationInsteadOfConflict() throws Exception {
        String body = """
            {
              "email": "pending.dup@example.com",
              "password": "Str0ng!Pass",
              "displayName": "Pending Duplicate"
            }
            """;

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isAccepted());

        User user = userRepository.findByEmail("pending.dup@example.com").orElseThrow();
        String originalHash = user.getPasswordHash();

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.verificationRequired").value(true))
            .andExpect(jsonPath("$.email").value("pending.dup@example.com"));

        User after = userRepository.findByEmail("pending.dup@example.com").orElseThrow();
        assertThat(after.getPasswordHash()).isEqualTo(originalHash);
        assertThat(after.isEmailVerified()).isFalse();
        // Inside the resend cooldown the already-issued code stays valid and
        // no duplicate mail is sent — same contract as the resend endpoint.
        assertThat(sentEmailCount).hasValue(1);
    }

    /**
     * Companion to the within-cooldown pin: once the original challenge ages
     * past the resend cooldown, a repeated registration actually issues a
     * fresh code + email and consumes the stale one — the path that unblocks
     * a pending user whose first mail never arrived.
     */
    @Test
    void duplicatePendingEmailAfterCooldownIssuesFreshCodeAndMail() throws Exception {
        String body = """
            {
              "email": "pending.cooldown@example.com",
              "password": "Str0ng!Pass",
              "displayName": "Pending Cooldown"
            }
            """;

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isAccepted());

        var challenges = authOtpChallengeRepository.findAll();
        assertThat(challenges).hasSize(1);
        var stale = challenges.getFirst();
        stale.setCreatedAt(java.time.OffsetDateTime.now().minusMinutes(30));
        authOtpChallengeRepository.saveAndFlush(stale);

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.verificationRequired").value(true));

        assertThat(sentEmailCount).hasValue(2);
        var after = authOtpChallengeRepository.findAll();
        assertThat(after).hasSize(2);
        assertThat(after.stream().filter(c -> c.getConsumedAt() != null).count()).isEqualTo(1);
    }

    /**
     * Mail clients and the verify form let grouped codes through ("123 456",
     * "123-456"); the digit check happens after separator stripping so a
     * well-meant paste is not rejected as INVALID_OTP.
     */
    @Test
    void emailVerificationAcceptsCodeWithGroupingSeparators() throws Exception {
        registerPending("verify.spaced@example.com", "Str0ng!Pass", "Verify Spaced");
        String otp = otpFromLastEmail();
        String grouped = otp.substring(0, 3) + "-" + otp.substring(3);

        mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"verify.spaced@example.com\",\"otp\":\"%s\"}".formatted(grouped)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.emailVerified").value(true));
    }

    @Test
    void loginReturnsTokens() throws Exception {
        register("login.patient@example.com", "Str0ng!Pass", "Login Patient");

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "login.patient@example.com",
                      "password": "Str0ng!Pass"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists())
            .andExpect(jsonPath("$.refreshToken").exists())
            .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("user").get("email").asText()).isEqualTo("login.patient@example.com");
    }

    @Test
    void loginRejectsValidUnverifiedCredentialsWithStableCode() throws Exception {
        registerPending("pending.login@example.com", "Str0ng!Pass", "Pending Login");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "pending.login@example.com",
                      "password": "Str0ng!Pass"
                    }
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_REQUIRED"));
    }

    @Test
    void emailVerificationConsumesOtpOnceAndAutoLogsIn() throws Exception {
        registerPending("verify.once@example.com", "Str0ng!Pass", "Verify Once");
        String otp = otpFromLastEmail();

        mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"verify.once@example.com\",\"otp\":\"%s\"}".formatted(otp)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists())
            .andExpect(jsonPath("$.user.emailVerified").value(true));

        mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"verify.once@example.com\",\"otp\":\"%s\"}".formatted(otp)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OTP_ALREADY_USED"));
    }

    @Test
    void invalidVerificationAttemptsPersistAndConsumeTheOtpAtTheLimit() throws Exception {
        registerPending("verify.attempts@example.com", "Str0ng!Pass", "Verify Attempts");
        String validOtp = otpFromLastEmail();
        String invalidOtp = "000000".equals(validOtp) ? "111111" : "000000";

        for (int attempt = 1; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"verify.attempts@example.com\",\"otp\":\"%s\"}".formatted(invalidOtp)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OTP"));
        }

        var beforeLimit = authOtpChallengeRepository.findAll().getFirst();
        assertThat(beforeLimit.getAttempts()).isEqualTo(4);
        assertThat(beforeLimit.getConsumedAt()).isNull();

        mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"verify.attempts@example.com\",\"otp\":\"%s\"}".formatted(invalidOtp)))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("OTP_ATTEMPTS_EXCEEDED"));

        var persisted = authOtpChallengeRepository.findAll().getFirst();
        assertThat(persisted.getAttempts()).isEqualTo(5);
        assertThat(persisted.getConsumedAt()).isNotNull();

        mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"verify.attempts@example.com\",\"otp\":\"%s\"}".formatted(validOtp)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OTP_ALREADY_USED"));
    }

    @Test
    void passwordResetUsesPurposeScopedOtpAndRevokesRefreshSessions() throws Exception {
        JsonNode session = register("reset.patient@example.com", "Str0ng!Pass", "Reset Patient");
        String oldRefreshToken = session.get("refreshToken").asText();

        mockMvc.perform(post("/api/v1/auth/password-reset-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"reset.patient@example.com\"}"))
            .andExpect(status().isAccepted());
        String otp = otpFromLastEmail();

        mockMvc.perform(post("/api/v1/auth/password-reset-requests/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"reset.patient@example.com\",\"otp\":\"%s\",\"newPassword\":\"N3w!Password\"}".formatted(otp)))
            .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(oldRefreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void verificationResendKeepsCooldownStateExternallyGeneric() throws Exception {
        registerPending("resend.cooldown@example.com", "Str0ng!Pass", "Resend Cooldown");

        MvcResult cooldownResponse = mockMvc.perform(post("/api/v1/auth/email-verifications/resend")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"resend.cooldown@example.com\"}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.message").value(
                "If the account is eligible, a verification code has been sent."))
            .andReturn();

        MvcResult unknownResponse = mockMvc.perform(post("/api/v1/auth/email-verifications/resend")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"unknown.resend@example.com\"}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.message").value(
                "If the account is eligible, a verification code has been sent."))
            .andReturn();

        assertThat(cooldownResponse.getResponse().getContentAsString())
            .isEqualTo(unknownResponse.getResponse().getContentAsString());
        assertThat(sentEmailCount).hasValue(1);
    }

    @Test
    void preferencesArePersistedPerAuthenticatedUser() throws Exception {
        JsonNode session = register("preferences.patient@example.com", "Str0ng!Pass", "Preferences Patient");
        String accessToken = session.get("accessToken").asText();

        mockMvc.perform(get("/api/v1/users/me/preferences")
                .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.locale").value("vi-VN"))
            .andExpect(jsonPath("$.timezone").value("Asia/Ho_Chi_Minh"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/users/me/preferences")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"emailNotifications\":false,\"locale\":\"en-US\",\"timezone\":\"UTC\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.emailNotifications").value(false))
            .andExpect(jsonPath("$.locale").value("en-US"))
            .andExpect(jsonPath("$.timezone").value("UTC"));
    }

    @Test
    void invalidLoginReturnsUnauthorized() throws Exception {
        register("invalid.login@example.com", "Str0ng!Pass", "Invalid Login");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "invalid.login@example.com",
                      "password": "Wrong!Pass1"
                    }
                    """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void disabledAccountLoginUsesGenericUnauthorizedResponse() throws Exception {
        register("disabled.login@example.com", "Str0ng!Pass", "Disabled Login");

        userRepository.findByEmail("disabled.login@example.com")
            .ifPresent(user -> {
                user.setStatus("DISABLED");
                userRepository.save(user);
            });

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "disabled.login@example.com",
                      "password": "Str0ng!Pass"
                    }
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void protectedEndpointRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void logoutWorksWhenAuthenticated() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout"))
            .andExpect(status().isOk());
    }

    @Test
    void refreshRotatesTokenAndRejectsReuse() throws Exception {
        JsonNode registration = register("refresh.patient@example.com", "Str0ng!Pass", "Refresh Patient");
        String originalRefreshToken = registration.get("refreshToken").asText();

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(originalRefreshToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.refreshToken").exists())
            .andReturn();

        JsonNode refreshed = objectMapper.readTree(refreshResult.getResponse().getContentAsString());
        assertThat(refreshed.get("refreshToken").asText()).isNotEqualTo(originalRefreshToken);

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(originalRefreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesActiveRefreshTokens() throws Exception {
        JsonNode registration = register("logout.patient@example.com", "Str0ng!Pass", "Logout Patient");
        String accessToken = registration.get("accessToken").asText();
        String refreshToken = registration.get("refreshToken").asText();

        mockMvc.perform(post("/api/v1/auth/logout")
                .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshReuseRevokesTheReplacementToken() throws Exception {
        JsonNode registration = register("reuse.patient@example.com", "Str0ng!Pass", "Reuse Patient");
        String originalRefreshToken = registration.get("refreshToken").asText();
        String replacementRefreshToken = refresh(originalRefreshToken).get("refreshToken").asText();

        refreshFails(originalRefreshToken);
        refreshFails(replacementRefreshToken);
    }

    @Test
    void refreshRejectsWhenStoredSessionOwnerDoesNotMatchSignedSubject() throws Exception {
        JsonNode registration = register("session.owner@example.com", "Str0ng!Pass", "Session Owner");
        register("other.owner@example.com", "Str0ng!Pass", "Other Owner");
        String refreshToken = registration.get("refreshToken").asText();

        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(hashToken(refreshToken)).orElseThrow();
        storedToken.setUser(userRepository.findByEmail("other.owner@example.com").orElseThrow());
        refreshTokenRepository.saveAndFlush(storedToken);

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void administratorBoundaryRejectsPatientRole() throws Exception {
        JsonNode registration = register("patient.role@example.com", "Str0ng!Pass", "Patient Role");

        mockMvc.perform(get("/api/v1/users/admin/access")
                .header("Authorization", "Bearer " + registration.get("accessToken").asText()))
            .andExpect(status().isForbidden());
    }

    @Test
    void refreshTokenCannotBeUsedAsAccessToken() throws Exception {
        JsonNode registration = register("type.guard@example.com", "Str0ng!Pass", "Type Guard");
        String refreshToken = registration.get("refreshToken").asText();

        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + refreshToken))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void accessTokenCannotBeUsedForRefresh() throws Exception {
        JsonNode registration = register("type.guard.refresh@example.com", "Str0ng!Pass", "Type Guard Refresh");
        String accessToken = registration.get("accessToken").asText();

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(accessToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void structurallyInvalidSignedRefreshTokenReturnsUnauthorized() throws Exception {
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        String malformedToken = Jwts.builder()
            .subject("not-a-uuid")
            .claim("type", "refresh")
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(900)))
            .signWith(key)
            .compact();

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(malformedToken)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    private JsonNode register(String email, String password, String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "%s",
                      "displayName": "%s"
                    }
                    """.formatted(email, password, displayName)))
            .andExpect(status().isAccepted())
            .andReturn();

        User user = userRepository.findByEmail(email.toLowerCase()).orElseThrow();
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(java.time.OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        return issueTestSession(user);
    }

    private JsonNode registerPending(String email, String password, String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "%s",
                      "displayName": "%s"
                    }
                    """.formatted(email, password, displayName)))
            .andExpect(status().isAccepted())
            .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode issueTestSession(User user) {
        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = tokenProvider.generateRefreshToken(user.getId());
        RefreshToken stored = new RefreshToken();
        stored.setUser(user);
        stored.setTokenHash(hashToken(refreshToken));
        stored.setExpiresAt(java.time.OffsetDateTime.now().plusSeconds(jwtProperties.refreshTokenTtl()));
        stored.setCreatedAt(java.time.OffsetDateTime.now());
        refreshTokenRepository.saveAndFlush(stored);
        var body = objectMapper.createObjectNode();
        body.put("accessToken", accessToken);
        body.put("refreshToken", refreshToken);
        body.put("tokenType", "Bearer");
        body.put("expiresIn", jwtProperties.accessTokenTtl());
        return body;
    }

    private String otpFromLastEmail() {
        Matcher matcher = Pattern.compile("\\b(\\d{6})\\b").matcher(lastEmailBody.get());
        if (!matcher.find()) throw new AssertionError("Test email did not contain a six-digit OTP");
        return matcher.group(1);
    }

    private JsonNode refresh(String refreshToken) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isOk())
            .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void refreshFails(String refreshToken) throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }

    private String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new AssertionError("SHA-256 unavailable", e);
        }
    }

    @Test
    void disabledUserCannotRefreshTokens() throws Exception {
        JsonNode registration = register("disabled.refresh@example.com", "Str0ng!Pass", "Disabled Refresh");
        String refreshToken = registration.get("refreshToken").asText();

        userRepository.findByEmail("disabled.refresh@example.com")
            .ifPresent(user -> {
                user.setStatus("DISABLED");
                userRepository.save(user);
            });

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void deletedUserTokenIsRejectedWithUnauthorized() throws Exception {
        JsonNode registration = register("deleted.user@example.com", "Str0ng!Pass", "Deleted User");
        String accessToken = registration.get("accessToken").asText();

        userRepository.findByEmail("deleted.user@example.com").ifPresent(userRepository::delete);

        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isUnauthorized());
    }
}
