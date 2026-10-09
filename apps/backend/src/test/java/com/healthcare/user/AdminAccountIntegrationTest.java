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
