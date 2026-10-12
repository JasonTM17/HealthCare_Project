package com.healthcare.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminAccountIntegrationTest extends AbstractIntegrationTest {
    private static final String PATH = "/api/v1/admin/users";
    private static final String PASSWORD = "Synthetic!Pass123";
    @Autowired private ObjectMapper mapper;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwords;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private JwtProperties jwtProperties;
    @Autowired private PlatformTransactionManager transactions;
    @Autowired private BrowserSessionService sessions;
    @MockitoBean private EmailSender emailSender;
    private User actor;
    private String admin;

    @BeforeEach
    void administrator() {
        actor = fixture("Admin sentinel", true, false, "ADMIN");
        admin = bearer(actor);
    }

    @Test
    void createPersistsUnverifiedIdentityAndTruthfulDeliveryWithoutLeakingSecrets() throws Exception {
        String email = "created-" + UUID.randomUUID() + "@healthcare.local";
        JsonNode action = read(post(PATH).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
            .content(createBody(email, "New patient", "PATIENT").toString()), 201);
        assertThat(action.path("action").asText()).isEqualTo("CREATED");
        assertThat(action.path("deliveryState").asText()).isEqualTo("REQUESTED_UNCONFIRMED");
        JsonNode account = action.path("account");
        assertSafe(account);
        assertThat(account.path("emailVerified").asBoolean()).isFalse();
        assertThat(account.path("emailVerifiedAt").isNull()).isTrue();
        assertThat(account.path("status").asText()).isEqualTo("ACTIVE");
        assertThat(account.path("version").asLong()).isZero();
        assertThat(account.path("roles").get(0).asText()).isEqualTo("PATIENT");
        User stored = userRepository.findByEmail(email).orElseThrow();
        assertThat(passwords.matches(PASSWORD, stored.getPasswordHash())).isTrue();
        assertThat(stored.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(stored.getCreatedAt().toInstant()).isEqualTo(OffsetDateTime.parse(account.path("createdAt").asText()).toInstant());
        assertThat(stored.getUpdatedAt()).isEqualTo(stored.getCreatedAt());
        read(post(PATH).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
            .content(createBody(email, "Duplicate", "PATIENT").toString()), 409);
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(loginBody(email))).andExpect(status().isForbidden());
    }

    @Test
    void safeDetailInventoryAndExplicitActionsUseOnlyDocumentedFields() throws Exception {
        User target = fixture("Safe identity", true, false, "PATIENT");
        jdbcTemplate.update("update users set google_subject=? where id=?", "synthetic-provider-subject", target.getId());
        JsonNode detail = detail(target.getId());
        assertSafe(detail);
        assertThat(detail.path("googleLinked").asBoolean()).isTrue();
        assertThat(detail.toString()).doesNotContain("synthetic-provider-subject", "passwordHash", "accessToken", "refreshToken", "googleSubject", "lastLogin");
        JsonNode page = read(get(PATH).header("Authorization", admin), 200);
        for (JsonNode item : page.path("content")) assertSafe(item);
        assertThat(page.path("totalElements").asLong()).isEqualTo(2);
        JsonNode reset = action(target.getId(), "password-reset", detail, 200);
        assertThat(reset.path("deliveryState").asText()).isEqualTo("REQUESTED_UNCONFIRMED");
        assertThat(reset.path("account")).isEqualTo(detail);
        action(target.getId(), "verification", detail, 409);
        User pending = fixture("Pending verification", false, false, "PATIENT");
        JsonNode verification = action(pending.getId(), "verification", detail(pending.getId()), 200);
        assertThat(verification.path("account").path("emailVerified").asBoolean()).isFalse();
        assertThat(verification.path("deliveryState").asText()).isEqualTo("REQUESTED_UNCONFIRMED");
        action(pending.getId(), "password-reset", detail(pending.getId()), 409);
    }

    @Test
    void inventoryCombinesLiteralSearchRoleStatusVerificationDemoDatesPagingAndSort() throws Exception {
        User first = fixture("needle A%_", true, false, "PATIENT", "ADMIN");
        User second = fixture("needle B", true, false, "PATIENT");
        fixture("needle C", false, true, "PATIENT");
        OffsetDateTime from = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        OffsetDateTime to = from.plusDays(1);
        jdbcTemplate.update("update users set created_at=? where id=?", from, first.getId());
        jdbcTemplate.update("update users set created_at=? where id=?", to, second.getId());
        JsonNode matched = read(get(PATH).header("Authorization", admin).param("q", "needle")
            .param("role", "PATIENT").param("status", "ACTIVE").param("verified", "true").param("demo", "false")
            .param("createdFrom", from.toString()).param("createdTo", to.toString()), 200);
        assertThat(matched.path("totalElements").asLong()).isEqualTo(1);
        assertThat(matched.path("content").get(0).path("id").asText()).isEqualTo(first.getId().toString());
        for (String literal : List.of("%", "_", "%_")) {
            JsonNode literalPage = read(get(PATH).header("Authorization", admin).param("q", literal), 200);
            assertThat(literalPage.path("totalElements").asLong()).isEqualTo(1);
        }
        JsonNode page0 = read(get(PATH).header("Authorization", admin).param("q", "needle")
            .param("page", "0").param("size", "1").param("sort", "displayName").param("direction", "asc"), 200);
        JsonNode page1 = read(get(PATH).header("Authorization", admin).param("q", "needle")
            .param("page", "1").param("size", "1").param("sort", "displayName").param("direction", "asc"), 200);
        assertThat(page0.path("totalElements").asLong()).isEqualTo(3);
        assertThat(page0.path("totalPages").asInt()).isEqualTo(3);
        assertThat(page0.path("content").get(0).path("id").asText()).isEqualTo(first.getId().toString());
        assertThat(page1.path("content").get(0).path("id").asText()).isEqualTo(second.getId().toString());
        assertThat(read(get(PATH).header("Authorization", admin).param("q", "needle").param("demo", "true"), 200)
            .path("totalElements").asLong()).isEqualTo(1);
    }

    @Test
    void inventoryRejectsUnknownFiltersBoundsUnsafeSortAndInvalidDateRange() throws Exception {
        for (String[] invalid : List.of(new String[]{"page", "-1"}, new String[]{"size", "101"}, new String[]{"size", "0"},
            new String[]{"sort", "passwordHash"}, new String[]{"direction", "sideways"}, new String[]{"role", "SUPER"},
            new String[]{"status", "LOCKED"}, new String[]{"q", "x".repeat(161)})) {
            read(get(PATH).header("Authorization", admin).param(invalid[0], invalid[1]), 400);
        }
        read(get(PATH).header("Authorization", admin).param("createdFrom", "2026-02-02T00:00:00Z")
            .param("createdTo", "2026-02-01T00:00:00Z"), 400);
        read(get(PATH + "/" + UUID.randomUUID()).header("Authorization", admin), 404);
        read(get(PATH + "/not-a-uuid").header("Authorization", admin), 400);
    }

    @Test
    void createValidationRejectsInvalidRolesEmailsAndBcryptByteTruncation() throws Exception {
        List<ObjectNode> invalid = List.of(createBody("invalid", "Valid name", "PATIENT"),
            createBody("new1@healthcare.local", "x", "PATIENT"),
            createBody("new2@healthcare.local", "Valid name", "SUPER"),
            createBody("new3@healthcare.local", "Valid name", "PATIENT").put("password", "漢".repeat(25) + "a1"),
            createBody("new4@healthcare.local", "Valid name", "PATIENT").put("password", "no-digits"));
        for (ObjectNode request : invalid) read(post(PATH).header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(request.toString()), 400);
        ObjectNode nullRole = createBody("null-role@healthcare.local", "Valid name", "PATIENT");
        ((com.fasterxml.jackson.databind.node.ArrayNode) nullRole.get("roles")).addNull();
        read(post(PATH).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(nullRole.toString()), 400);
        assertThat(userRepository.count()).isEqualTo(1);
    }

    @Test
    void sameEpochStaleUpdatedAtAndStaleEpochActionsCannotLoseEdits() throws Exception {
        User user = fixture("Original name", true, false, "PATIENT");
        JsonNode before = detail(user.getId());
        ObjectNode rename = updateBody(before).put("displayName", "Latest name");
        JsonNode after = update(user.getId(), rename, 200);
        assertThat(after.path("version")).isEqualTo(before.path("version"));
        assertThat(after.path("updatedAt").asText()).isNotEqualTo(before.path("updatedAt").asText());
        update(user.getId(), updateBody(before).put("displayName", "Stale overwrite"), 409);
        action(user.getId(), "revoke-sessions", before, 409);
        JsonNode revoked = action(user.getId(), "revoke-sessions", after, 200).path("account");
        assertThat(revoked.path("version").asLong()).isEqualTo(after.path("version").asLong() + 1);
        JsonNode persistedRevoked = detail(user.getId());
        action(user.getId(), "revoke-sessions", after, 409);
        assertThat(detail(user.getId())).isEqualTo(persistedRevoked);
    }

    @Test
    void selfDemotionDisableOrEmailDeverificationAndDemoMutationsAreDenied() throws Exception {
        JsonNode self = detail(actor.getId());
        ObjectNode demotion = updateBody(self); demotion.putArray("roles").add("PATIENT");
        update(actor.getId(), demotion, 409);
        update(actor.getId(), updateBody(self).put("status", "DISABLED"), 409);
        update(actor.getId(), updateBody(self).put("email", "self-changed@healthcare.local"), 409);
        assertThat(detail(actor.getId())).isEqualTo(self);
        assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
        User demo = fixture("Shared demo identity", true, true, "PATIENT");
        JsonNode demoBefore = detail(demo.getId());
        update(demo.getId(), updateBody(demoBefore).put("displayName", "Forbidden"), 403);
        for (String action : List.of("revoke-sessions", "password-reset", "verification")) action(demo.getId(), action, demoBefore, 403);
        assertThat(detail(demo.getId())).isEqualTo(demoBefore);
    }

    @Test
    void accountEmailChangeDeverifiesClearsProviderAndInvalidatesOldIdentity() throws Exception {
        User user = fixture("Email change", true, false, "PATIENT");
        jdbcTemplate.update("update users set google_subject=?,email_verified_at=? where id=?", "private-google-subject", OffsetDateTime.now(), user.getId());
        String old = bearer(user);
        JsonNode before = detail(user.getId());
        String nextEmail = "changed-" + UUID.randomUUID() + "@healthcare.local";
        JsonNode after = update(user.getId(), updateBody(before).put("email", nextEmail), 200);
        assertThat(after.path("emailVerified").asBoolean()).isFalse();
        assertThat(after.path("emailVerifiedAt").isNull()).isTrue();
        assertThat(after.path("googleLinked").asBoolean()).isFalse();
        assertThat(after.path("version").asLong()).isEqualTo(before.path("version").asLong() + 1);
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", old)).andExpect(status().isUnauthorized());
        assertThat(userRepository.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
    }

    @Test
    void lockUnlockNeverRevivesOldAccessRefreshOrBrowserCredentialsAndFreshLoginWorks() throws Exception {
        User user = fixture("Lifecycle patient", true, false, "PATIENT");
        JsonNode auth = read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(user.getEmail())), 200);
        String access = "Bearer " + auth.path("accessToken").asText();
        String refresh = auth.path("refreshToken").asText();
        String cookie = sessions.issue(user.getId()).rawSessionSecret();
        JsonNode before = detail(user.getId());
        JsonNode locked = update(user.getId(), updateBody(before).put("status", "DISABLED"), 200);
        assertThat(locked.path("version").asLong()).isEqualTo(before.path("version").asLong() + 1);
        rejectedCredentials(access, refresh, cookie);
        JsonNode restored = update(user.getId(), updateBody(locked).put("status", "ACTIVE"), 200);
        assertThat(restored.path("version").asLong()).isEqualTo(locked.path("version").asLong() + 1);
        rejectedCredentials(access, refresh, cookie);
        JsonNode fresh = read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(user.getEmail())), 200);
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + fresh.path("accessToken").asText())).andExpect(status().isOk());
        assertThat(tokens.extractSecurityVersion(fresh.path("accessToken").asText())).isEqualTo(restored.path("version").asLong());
    }

    @Test
    void demotionAndRepromotionNeverReviveAdministratorCredentials() throws Exception {
        User second = fixture("Second admin", true, false, "ADMIN");
        JsonNode issued = read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(second.getEmail())), 200);
        String old = "Bearer " + issued.path("accessToken").asText();
        String refresh = issued.path("refreshToken").asText();
        String browser = sessions.issue(second.getId()).rawSessionSecret();
        JsonNode first = detail(second.getId());
        ObjectNode demote = updateBody(first); demote.putArray("roles").add("PATIENT");
        JsonNode demoted = update(second.getId(), demote, 200);
        assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
        rejectedCredentials(old, refresh, browser);
        ObjectNode promote = updateBody(demoted); promote.putArray("roles").add("ADMIN");
        JsonNode promoted = update(second.getId(), promote, 200);
        assertThat(promoted.path("version").asLong()).isEqualTo(first.path("version").asLong() + 2);
        rejectedCredentials(old, refresh, browser);
        JsonNode fresh = read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(second.getEmail())), 200);
        mockMvc.perform(get(PATH).header("Authorization", "Bearer " + fresh.path("accessToken").asText())).andExpect(status().isOk());
    }

    @Test
    void absentLegacySecurityEpochIsZeroAndCannotReviveAfterRevoke() throws Exception {
        User user = fixture("Legacy token identity", true, false, "PATIENT");
        Instant now = Instant.now();
        String legacy = Jwts.builder().subject(user.getId().toString()).claim("email", user.getEmail())
            .claim("type", "access").id(UUID.randomUUID().toString()).issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(600))).signWith(Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(tokens.parseClaims(legacy)).doesNotContainKey("securityVersion");
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + legacy)).andExpect(status().isOk());
        action(user.getId(), "revoke-sessions", detail(user.getId()), 200);
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + legacy)).andExpect(status().isUnauthorized());
    }

    @Test
    void doctorGrantRequiresExistingActiveUnoccupiedProfileAndMatchingName() throws Exception {
        User user = fixture("Doctor authority", true, false, "PATIENT");
        JsonNode before = detail(user.getId());
        ObjectNode grant = updateBody(before); grant.putArray("roles").add("DOCTOR");
        update(user.getId(), grant, 400);
        update(user.getId(), grant.deepCopy().put("doctorProfileId", UUID.randomUUID().toString()), 404);
        Doctor inactive = doctor("Doctor authority", false, null);
        update(user.getId(), grant.deepCopy().put("doctorProfileId", inactive.getId().toString()), 400);
        User other = fixture("Occupied doctor", true, false, "DOCTOR");
        Doctor occupied = doctor("Occupied doctor", true, other.getId());
        update(user.getId(), grant.deepCopy().put("doctorProfileId", occupied.getId().toString()).put("displayName", "Occupied doctor"), 409);
        Doctor mismatch = doctor("Other factual name", true, null);
        update(user.getId(), grant.deepCopy().put("doctorProfileId", mismatch.getId().toString()), 409);
        assertThat(detail(user.getId())).isEqualTo(before);
        Doctor valid = doctor("Doctor authority", true, null);
        JsonNode linked = update(user.getId(), grant.deepCopy().put("doctorProfileId", valid.getId().toString()), 200);
        assertThat(linked.path("doctorProfile").path("id").asText()).isEqualTo(valid.getId().toString());
        assertThat(linked.path("version").asLong()).isEqualTo(before.path("version").asLong() + 1);
        assertThat(doctorRepository.findById(valid.getId()).orElseThrow().getUserId()).isEqualTo(user.getId());
    }

    @Test
    void doctorCreateIsUnverifiedAndProfileNameCannotBeChangedThroughAccountInventory() throws Exception {
        Doctor profile = doctor("New clinician", true, null);
        ObjectNode create = createBody("doctor-new@healthcare.local", "New clinician", "DOCTOR").put("doctorProfileId", profile.getId().toString());
        JsonNode result = read(post(PATH).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(create.toString()), 201);
        UUID id = UUID.fromString(result.path("account").path("id").asText());
        JsonNode current = detail(id);
        assertThat(current.path("emailVerified").asBoolean()).isFalse();
        assertThat(current.path("doctorProfile").path("fullName").asText()).isEqualTo("New clinician");
        update(id, updateBody(current).put("displayName", "Fabricated doctor name"), 409);
        assertThat(detail(id)).isEqualTo(current);
    }

    @Test
    void doctorReplacementAndRemovalRequireExplicitUnlinkAndPreserveProfileAuthority() throws Exception {
        User user = fixture("Same doctor name", true, false, "DOCTOR");
        Doctor first = doctor("Same doctor name", true, user.getId());
        Doctor replacement = doctor("Same doctor name", true, null);
        JsonNode before = detail(user.getId());
        update(user.getId(), updateBody(before).put("unlinkDoctorProfile", true), 400);
        ObjectNode remove = updateBody(before); remove.putArray("roles").add("PATIENT");
        update(user.getId(), remove, 409);
        JsonNode changed = update(user.getId(), updateBody(before).put("doctorProfileId", replacement.getId().toString())
            .put("unlinkDoctorProfile", true), 200);
        assertThat(doctorRepository.findById(first.getId()).orElseThrow().getUserId()).isNull();
        assertThat(doctorRepository.findById(replacement.getId()).orElseThrow().getUserId()).isEqualTo(user.getId());
        ObjectNode confirmed = updateBody(changed).put("unlinkDoctorProfile", true); confirmed.putArray("roles").add("PATIENT");
        JsonNode removed = update(user.getId(), confirmed, 200);
        assertThat(removed.path("doctorProfile").isNull()).isTrue();
        assertThat(doctorRepository.findById(replacement.getId()).orElseThrow().getUserId()).isNull();
    }

    @Test
    void anonymousPatientDoctorAndIneligibleAdminCannotAccessAccountMutations() throws Exception {
        User target = fixture("RBAC target", true, false, "PATIENT");
        JsonNode before = detail(target.getId());
        for (String authorization : List.of("", bearer(target), bearer(fixture("RBAC doctor", true, false, "DOCTOR")))) {
            int expected = authorization.isEmpty() ? 401 : 403;
            List<MockHttpServletRequestBuilder> requests = List.of(get(PATH), get(PATH + "/" + target.getId()),
                post(PATH).contentType(MediaType.APPLICATION_JSON).content(createBody("rbac-new@healthcare.local", "Forbidden", "PATIENT").toString()),
                put(PATH + "/" + target.getId()).contentType(MediaType.APPLICATION_JSON).content(updateBody(before).toString()),
                post(PATH + "/" + target.getId() + "/revoke-sessions").contentType(MediaType.APPLICATION_JSON).content(expectedBody(before).toString()),
                post(PATH + "/" + target.getId() + "/password-reset").contentType(MediaType.APPLICATION_JSON).content(expectedBody(before).toString()),
                post(PATH + "/" + target.getId() + "/verification").contentType(MediaType.APPLICATION_JSON).content(expectedBody(before).toString()));
            for (MockHttpServletRequestBuilder req : requests) {
                if (!authorization.isEmpty()) req.header("Authorization", authorization);
                mockMvc.perform(req).andExpect(status().is(expected));
            }
        }
        for (User ineligible : List.of(fixture("Unverified admin", false, false, "ADMIN"), fixture("Demo admin", true, true, "ADMIN"))) {
            mockMvc.perform(put(PATH + "/" + target.getId()).header("Authorization", bearer(ineligible))
                .contentType(MediaType.APPLICATION_JSON).content(updateBody(before).toString())).andExpect(status().isForbidden());
        }
        assertThat(detail(target.getId())).isEqualTo(before);
    }

    @Test
    void adminDirectPasswordChangesPatientAndDoctorAndRevokesAllOldCredentials() throws Exception {
        for (String role : List.of("PATIENT", "DOCTOR")) {
            User target = fixture("Password " + role, true, false, role);
            JsonNode auth = read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(target.getEmail())), 200);
            String browser = sessions.issue(target.getId()).rawSessionSecret();
            JsonNode before = detail(target.getId());
            action(target.getId(), "password-reset", before, 200);
            String next = "ChangedFixturePassword42!";
            JsonNode after = directPassword(target.getId(), expectedBody(before).put("newPassword", next), admin, 200);
            assertThat(after.path("version").asLong()).isEqualTo(before.path("version").asLong() + 1);
            assertThat(after.path("roles")).isEqualTo(before.path("roles"));
            assertThat(after.path("emailVerified")).isEqualTo(before.path("emailVerified"));
            assertThat(after.toString()).doesNotContain(next, "passwordHash", "newPassword");
            assertThat(passwords.matches(next, userRepository.findById(target.getId()).orElseThrow().getPasswordHash())).isTrue();
            rejectedCredentials("Bearer " + auth.path("accessToken").asText(), auth.path("refreshToken").asText(), browser);
            assertThat(jdbcTemplate.queryForObject("select count(*) from auth_otp_challenges where user_id=? and consumed_at is null", Integer.class, target.getId())).isZero();
            read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(target.getEmail())), 401);
            read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.createObjectNode().put("email", target.getEmail()).put("password", next).toString()), 200);
            assertThat(jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_id=? and action='ADMIN_UPDATE_USER_PASSWORD'", Integer.class, target.getId().toString())).isEqualTo(1);
            JsonNode persistedAfter = detail(target.getId());
            assertThat(OffsetDateTime.parse(persistedAfter.path("updatedAt").asText()).toInstant())
                .isEqualTo(OffsetDateTime.parse(after.path("updatedAt").asText()).toInstant());
            directPassword(target.getId(), expectedBody(before).put("newPassword", "RepeatedFixture42!"), admin, 409);
            assertThat(detail(target.getId())).isEqualTo(persistedAfter);
        }
    }

    @Test
    void directPasswordRejectsPrivilegedDemoSelfAndNonAdminActorsWithoutMutation() throws Exception {
        User patient = fixture("Actor patient", true, false, "PATIENT");
        for (User target : List.of(actor, fixture("Other admin", true, false, "ADMIN"),
            fixture("Mixed admin", true, false, "PATIENT", "ADMIN"), fixture("Demo patient", true, true, "PATIENT"))) {
            String hash = target.getPasswordHash();
            JsonNode before = detail(target.getId());
            directPassword(target.getId(), expectedBody(before).put("newPassword", "RejectedFixture42!"), admin, 403);
            assertThat(detail(target.getId())).isEqualTo(before);
            assertThat(userRepository.findById(target.getId()).orElseThrow().getPasswordHash()).isEqualTo(hash);
        }
        JsonNode before = detail(patient.getId());
        directPassword(patient.getId(), expectedBody(before).put("newPassword", "RejectedFixture42!"), bearer(patient), 403);
        assertThat(detail(patient.getId())).isEqualTo(before);
    }

    @Test
    void directPasswordValidatesBcryptBytesAndDoesNotActivateOrVerifyAccounts() throws Exception {
        User target = fixture("Inactive unverified", false, false, "PATIENT");
        target.setStatus("DISABLED"); userRepository.saveAndFlush(target);
        JsonNode before = detail(target.getId());
        for (String value : List.of("short1", "no-digits", "漢".repeat(25) + "a1", "Password42\n")) {
            directPassword(target.getId(), expectedBody(before).put("newPassword", value), admin, 400);
            assertThat(detail(target.getId())).isEqualTo(before);
        }
        JsonNode after = directPassword(target.getId(), expectedBody(before).put("newPassword", "ChangedFixture42!"), admin, 200);
        assertThat(after.path("status").asText()).isEqualTo("DISABLED");
        assertThat(after.path("emailVerified").asBoolean()).isFalse();
    }

    @Test
    void passwordBoundaryAndRequiredPreimagesAreEnforcedAndProfileIdentityIsPreserved() throws Exception {
        User target = fixture("Mixed doctor patient", true, false, "DOCTOR", "PATIENT");
        target.setGoogleSubject("fixture-linked-google-subject"); userRepository.saveAndFlush(target);
        Doctor profile = doctor(target.getDisplayName(), true, target.getId());
        JsonNode before = detail(target.getId());
        directPassword(target.getId(), expectedBody(before).put("newPassword", "a" + "1".repeat(72)), admin, 400);
        directPassword(target.getId(), mapper.createObjectNode().put("newPassword", "ValidFixture42!"), admin, 400);
        directPassword(target.getId(), expectedBody(before).put("expectedUpdatedAt", "2000-01-01T00:00:00Z").put("newPassword", "ValidFixture42!"), admin, 409);
        directPassword(UUID.randomUUID(), expectedBody(before).put("newPassword", "ValidFixture42!"), admin, 404);
        assertThat(detail(target.getId())).isEqualTo(before);
        String next = "漢".repeat(23) + "a12";
        JsonNode after = directPassword(target.getId(), expectedBody(before).put("newPassword", next), admin, 200);
        assertThat(after.path("roles")).isEqualTo(before.path("roles"));
        assertThat(after.path("doctorProfile")).isEqualTo(before.path("doctorProfile"));
        assertThat(after.path("patientProfileId")).isEqualTo(before.path("patientProfileId"));
        assertThat(after.path("googleLinked").asBoolean()).isTrue();
        assertThat(userRepository.findById(target.getId()).orElseThrow().getGoogleSubject()).isEqualTo("fixture-linked-google-subject");
        assertThat(doctorRepository.findById(profile.getId()).orElseThrow().getUserId()).isEqualTo(target.getId());
        assertThat(passwords.matches(next, userRepository.findById(target.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test
    void passwordAuditMigrationPreservesHistoricalRowsAndRejectsUnknownActions() throws Exception {
        jdbcTemplate.update("insert into clinical_access_audit(id,actor_user_id,actor_email,actor_role,target_type,target_id,action,decision) values(?,?,?,'ADMIN','USER',?,'ADMIN_UPDATE_USER_ROLES','ALLOW')",
            UUID.randomUUID(), actor.getId(), actor.getEmail(), actor.getId().toString());
        var before = jdbcTemplate.queryForList("select * from clinical_access_audit order by id");
        assertThat(before).hasSize(1);
        jdbcTemplate.execute("alter table clinical_access_audit drop constraint ck_clinical_access_audit_action");
        jdbcTemplate.execute("alter table clinical_access_audit add constraint ck_clinical_access_audit_action check(action in ('READ','DOWNLOAD','PRESCRIBE','ADMIN_CANCEL_APPOINTMENT','GENERATE','REVOKE','ADMIN_UPDATE_USER_STATUS','ADMIN_UPDATE_USER_ROLES'))");
        try (var connection = jdbcTemplate.getDataSource().getConnection()) {
            org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection,
                new org.springframework.core.io.ClassPathResource("db/migration/V123__admin_direct_password_audit.sql"));
        }
        assertThat(jdbcTemplate.queryForList("select * from clinical_access_audit order by id")).isEqualTo(before);
        for (String action : List.of("READ", "DOWNLOAD", "PRESCRIBE", "ADMIN_CANCEL_APPOINTMENT", "GENERATE", "REVOKE", "ADMIN_UPDATE_USER_STATUS", "ADMIN_UPDATE_USER_ROLES", "ADMIN_UPDATE_USER_PASSWORD")) {
            jdbcTemplate.update("insert into clinical_access_audit(id,actor_user_id,actor_email,actor_role,target_type,target_id,action,decision) values(?,?,?,'ADMIN','USER',?,?,'ALLOW')",
                UUID.randomUUID(), actor.getId(), actor.getEmail(), actor.getId().toString(), action);
        }
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbcTemplate.update("insert into clinical_access_audit(id,actor_user_id,actor_email,actor_role,target_type,target_id,action,decision) values(?,?,?,'ADMIN','USER',?,'UNKNOWN_FIXTURE','ALLOW')",
            UUID.randomUUID(), actor.getId(), actor.getEmail(), actor.getId().toString())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void passwordAuditFailureRollsBackPasswordEpochAndCredentials() throws Exception {
        User target = fixture("Password atomic rollback", true, false, "PATIENT");
        JsonNode auth = read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(target.getEmail())), 200);
        String browser = sessions.issue(target.getId()).rawSessionSecret();
        JsonNode before = detail(target.getId());
        String hash = target.getPasswordHash();
        action(target.getId(), "password-reset", before, 200);
        Integer activeOtp = jdbcTemplate.queryForObject("select count(*) from auth_otp_challenges where user_id=? and consumed_at is null", Integer.class, target.getId());
        assertThat(activeOtp).isEqualTo(1);
        jdbcTemplate.execute("create function reject_test_password_audit() returns trigger language plpgsql as $$ begin if NEW.action='ADMIN_UPDATE_USER_PASSWORD' then raise exception using errcode='23514',message='test audit fault'; end if; return NEW; end $$");
        jdbcTemplate.execute("create trigger reject_test_password_audit before insert on clinical_access_audit for each row execute function reject_test_password_audit()");
        try {
            directPassword(target.getId(), expectedBody(before).put("newPassword", "RejectedFixture42!"), admin, 409);
            assertThat(detail(target.getId())).isEqualTo(before);
            assertThat(userRepository.findById(target.getId()).orElseThrow().getPasswordHash()).isEqualTo(hash);
            assertThat(jdbcTemplate.queryForObject("select count(*) from auth_otp_challenges where user_id=? and consumed_at is null", Integer.class, target.getId())).isEqualTo(activeOtp);
            mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + auth.path("accessToken").asText())).andExpect(status().isOk());
            mockMvc.perform(get("/api/v1/users/me").cookie(new Cookie("__Host-healthcare_session", browser))).andExpect(status().isOk());
            read(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(mapper.createObjectNode().put("refreshToken", auth.path("refreshToken").asText()).toString()), 200);
        } finally {
            jdbcTemplate.execute("drop trigger reject_test_password_audit on clinical_access_audit");
            jdbcTemplate.execute("drop function reject_test_password_audit()");
        }
    }

    private JsonNode directPassword(UUID id, ObjectNode body, String authorization, int expected) throws Exception {
        return read(put(PATH + "/" + id + "/password").header("Authorization", authorization)
            .contentType(MediaType.APPLICATION_JSON).content(body.toString()), expected);
    }

    private JsonNode detail(UUID id) throws Exception { return read(get(PATH + "/" + id).header("Authorization", admin), 200); }
    private JsonNode update(UUID id, ObjectNode body, int expected) throws Exception {
        return read(put(PATH + "/" + id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(body.toString()), expected);
    }
    private JsonNode action(UUID id, String action, JsonNode baseline, int expected) throws Exception {
        return read(post(PATH + "/" + id + "/" + action).header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(expectedBody(baseline).toString()), expected);
    }
    private ObjectNode expectedBody(JsonNode baseline) {
        return mapper.createObjectNode().put("expectedVersion", baseline.path("version").asLong())
            .put("expectedUpdatedAt", baseline.path("updatedAt").asText());
    }
    private ObjectNode updateBody(JsonNode baseline) {
        ObjectNode body = expectedBody(baseline).put("email", baseline.path("email").asText())
            .put("displayName", baseline.path("displayName").asText()).put("status", baseline.path("status").asText());
        body.set("roles", baseline.path("roles").deepCopy()); return body;
    }
    private ObjectNode createBody(String email, String name, String role) {
        ObjectNode body = mapper.createObjectNode().put("email", email).put("displayName", name).put("password", PASSWORD);
        body.putArray("roles").add(role); return body;
    }
    private String loginBody(String email) { return mapper.createObjectNode().put("email", email).put("password", PASSWORD).toString(); }
    private JsonNode read(MockHttpServletRequestBuilder req, int expected) throws Exception {
        MvcResult result = mockMvc.perform(req).andExpect(status().is(expected)).andReturn();
        if (expected >= 200 && expected < 300 && result.getRequest().getRequestURI().startsWith(PATH)) {
            assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
        }
        return mapper.readTree(result.getResponse().getContentAsString());
    }
    private void rejectedCredentials(String access, String refresh, String browser) throws Exception {
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", access)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users/me").cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, browser))).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.createObjectNode().put("refreshToken", refresh).toString())).andExpect(status().isUnauthorized());
    }
    private void assertSafe(JsonNode account) {
        List<String> fields = new ArrayList<>(); account.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("id", "email", "displayName", "status", "roles", "emailVerified",
            "emailVerifiedAt", "demo", "createdAt", "updatedAt", "version", "doctorProfile", "patientProfileId", "googleLinked", "phone", "doctorProfileId");
        assertThat(account.toString()).doesNotContain("passwordHash", "password_hash", "googleSubject", "google_subject", "tokenHash", "accessToken", "refreshToken");
    }
    private User fixture(String name, boolean verified, boolean demo, String... roleCodes) {
        return new TransactionTemplate(transactions).execute(tx -> {
            User user = new User(); user.setEmail("account-test-" + UUID.randomUUID() + "@healthcare.local");
            user.setDisplayName(name); user.setPasswordHash(passwords.encode(PASSWORD)); user.setStatus("ACTIVE");
            user.setEmailVerified(verified); user.setDemo(demo);
            user.setCreatedAt(OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS)); user.setUpdatedAt(user.getCreatedAt());
            for (String role : roleCodes) user.addRole(roles.findByCode(role).orElseThrow());
            return userRepository.saveAndFlush(user);
        });
    }
    private String bearer(User user) { return "Bearer " + tokens.generateAccessToken(user.getId(), user.getEmail(), user.getSecurityVersion()); }
    private Doctor doctor(String name, boolean active, UUID user) {
        Doctor doctor = new Doctor(); doctor.setFullName(name); doctor.setSlug("account-profile-" + UUID.randomUUID());
        doctor.setActive(active); doctor.setUserId(user); return doctorRepository.saveAndFlush(doctor);
    }
}
