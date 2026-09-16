package com.healthcare.auth.mail;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.auth.AuthOtpService;
import com.healthcare.auth.entity.AuthOtpPurpose;
import com.healthcare.auth.repository.AuthOtpChallengeRepository;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;

@TestPropertySource(properties = {
    "app.mail.enabled=true",
    "app.mail.outbox.enabled=true"
})
class AuthOtpOutboxIntegrationTest extends TestcontainersIntegrationTest {

    @Autowired private AuthOtpService authOtpService;
    @Autowired private AuthOtpChallengeRepository challengeRepository;
    @Autowired private EmailOutboxRepository outboxRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository users;

    @MockitoBean
    private JavaMailSender javaMailSender;

    @Test
    void outboxEnabledEnqueuesOtpEvenWhenSmtpWouldFail() {
        doThrow(new MailAuthenticationException("SMTP unavailable"))
            .when(javaMailSender).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        doThrow(new MailAuthenticationException("SMTP unavailable"))
            .when(javaMailSender).send(org.mockito.ArgumentMatchers.any(jakarta.mail.internet.MimeMessage.class));
        User user = createActivePatient("outbox.otp@example.com");

        assertDoesNotThrow(() -> authOtpService.issueVerification(user, new MockHttpServletRequest()));

        assertThat(challengeRepository.findAll()).anySatisfy(challenge -> {
            assertThat(challenge.getUser().getId()).isEqualTo(user.getId());
            assertThat(challenge.getPurpose()).isEqualTo(AuthOtpPurpose.EMAIL_VERIFICATION);
            assertThat(challenge.getConsumedAt()).isNull();
        });
        assertThat(outboxRepository.findAll())
            .singleElement()
            .satisfies(entry -> {
                assertThat(entry.getTemplateKey()).isEqualTo(EmailTemplateKey.EMAIL_VERIFICATION);
                assertThat(entry.getStatus()).isEqualTo(EmailOutboxStatus.QUEUED);
                assertThat(entry.getAttempts()).isZero();
                assertThat(entry.getPayloadCiphertext()).isNotNull();
                assertThat(entry.getPayloadNonce()).isNotNull();
            });
    }

    private User createActivePatient(String email) {
        Role role = roleRepository.findByCode("PATIENT").orElseThrow();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("Str0ng!Pass"));
        user.setDisplayName("Outbox Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(false);
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        User saved = users.saveAndFlush(user);
        jdbcTemplate.update(
            "INSERT INTO user_roles(user_id, role_id) VALUES (?, ?)",
            saved.getId(),
            role.getId()
        );
        return users.findWithRolesById(saved.getId()).orElseThrow();
    }
}
