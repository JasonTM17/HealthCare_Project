package com.healthcare.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP contracts and real PostgreSQL transactions; only mail delivery is substituted. */
class AdminAccountLegacyCompatibilityIntegrationTest extends AbstractIntegrationTest {
    private static final String PATH = "/api/v1/admin/users";
    private static final String PASSWORD = "Synthetic!Pass123";
    @Autowired private ObjectMapper mapper;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwords;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private BrowserSessionService sessions;
    @Autowired private PlatformTransactionManager transactions;
    @MockitoBean private EmailSender emailSender;
    private User actor;
    private String admin;

    @BeforeEach void administrator() { actor = fixture("Compatibility administrator", true, false, "ADMIN"); admin = bearer(actor); }

    @Test void oneInventoryMappingRetainsRealFlatProfilesAndProfessionalSafeMetadata() throws Exception {
        User patient = fixture("Patient profile source", true, false, "PATIENT");
        PatientProfile profile = new PatientProfile(); profile.setFullName(patient.getDisplayName());
        profile.setPhone("0901234567"); profile.setUserId(patient.getId()); profile = patientProfileRepository.saveAndFlush(profile);
        User clinician = fixture("Doctor profile source", true, false, "DOCTOR");
        Doctor doctor = doctor(clinician.getDisplayName(), true, clinician.getId());
        JsonNode inventory = read(get(PATH).header("Authorization", admin), 200);
        assertThat(inventory.path("totalElements").asLong()).isEqualTo(3);
        for (JsonNode row : inventory.path("content")) assertSafe(row);
        JsonNode patientRow = detail(patient.getId());
        assertThat(patientRow.path("phone").asText()).isEqualTo(profile.getPhone());
        assertThat(patientRow.path("patientProfileId").asText()).isEqualTo(profile.getId().toString());
        assertThat(patientRow.path("doctorProfileId").isNull()).isTrue();
        JsonNode doctorRow = detail(clinician.getId());
        assertThat(doctorRow.path("doctorProfileId").asText()).isEqualTo(doctor.getId().toString());
        assertThat(doctorRow.path("doctorProfile").path("id").asText()).isEqualTo(doctor.getId().toString());
        assertThat(doctorRow.path("phone").isNull()).isTrue();
        assertThat(patientRow.path("createdAt").isNull()).isFalse();
        assertThat(patientRow.path("updatedAt").isNull()).isFalse();
        assertThat(patientRow.path("version").asLong()).isZero();
    }

    @Test void legacyMultisortIdAndProfessionalBareSortAreDeterministicAndBadFiltersFail() throws Exception {
        User a = fixture("compat-sort A", true, false, "PATIENT");
        User b = fixture("compat-sort B", true, false, "PATIENT");
        User c = fixture("compat-sort B", true, false, "PATIENT");
        jdbcTemplate.update("update users set email=? where id=?", "compat-a@healthcare.local", a.getId());
        jdbcTemplate.update("update users set email=? where id=?", "compat-b@healthcare.local", b.getId());
        jdbcTemplate.update("update users set email=? where id=?", "compat-c@healthcare.local", c.getId());
        assertThat(ids(read(get(PATH).header("Authorization", admin).param("q", "compat-sort")
            .param("role", " patient ").param("status", " active ").param("sort", "displayName,desc", "email,asc"), 200)))
            .containsExactly(b.getId().toString(), c.getId().toString(), a.getId().toString());
        List<String> descendingIds = List.of(a.getId(), b.getId(), c.getId()).stream().map(UUID::toString).sorted(java.util.Comparator.reverseOrder()).toList();
        assertThat(ids(read(get(PATH).header("Authorization", admin).param("q", "compat-sort").param("sort", "id,desc"), 200))).isEqualTo(descendingIds);
        List<String> tied = List.of(b.getId().toString(), c.getId().toString()).stream().sorted().toList();
        List<String> expected = new ArrayList<>(); expected.add(a.getId().toString()); expected.addAll(tied);
        assertThat(ids(read(get(PATH).header("Authorization", admin).param("q", "compat-sort").param("sort", "displayName").param("direction", "asc"), 200))).isEqualTo(expected);
        for (String[] invalid : List.of(new String[]{"sort", "passwordHash,desc"}, new String[]{"sort", "id,sideways"},
            new String[]{"role", "SUPER"}, new String[]{"status", "LOCKED"}, new String[]{"page", "-1"}, new String[]{"size", "101"})) {
            read(get(PATH).header("Authorization", admin).param(invalid[0], invalid[1]), 400);
        }
        read(get(PATH).header("Authorization", admin).param("sort", "id,asc", "googleSubject,desc"), 400);
    }

    @Test void bothLegacyBodiesNeedNoOptimisticTokenRetainOtherFieldsAndAuditOnlyActualChanges() throws Exception {
        User patient = fixture("Legacy patch target", true, false, "PATIENT");
        JsonNode before = detail(patient.getId());
        JsonNode heldLegacy = legacy(patient.getId(), "status", statusBody("DISABLED"), admin, 200); assertLegacySafe(heldLegacy);
        JsonNode held = detail(patient.getId());
        assertThat(held.path("email")).isEqualTo(before.path("email")); assertThat(held.path("roles")).isEqualTo(before.path("roles"));
        assertThat(held.path("version").asLong()).isEqualTo(1);
        assertThat(canonicalInstants(legacy(patient.getId(), "status", statusBody("DISABLED"), admin, 200))).isEqualTo(canonicalInstants(heldLegacy));
        assertThat(detail(patient.getId())).isEqualTo(held);
        JsonNode restored = legacy(patient.getId(), "status", statusBody("ACTIVE"), admin, 200);
        JsonNode changedLegacy = legacy(patient.getId(), "roles", rolesBody("PATIENT", "ADMIN"), admin, 200); assertLegacySafe(changedLegacy);
        JsonNode changed = detail(patient.getId());
        assertThat(changed.path("status")).isEqualTo(restored.path("status")); assertThat(changed.path("version").asLong()).isEqualTo(3);
        assertThat(canonicalInstants(legacy(patient.getId(), "roles", rolesBody("ADMIN", "PATIENT"), admin, 200))).isEqualTo(canonicalInstants(changedLegacy));
        assertThat(detail(patient.getId())).isEqualTo(changed);
        assertThat(auditCount(patient.getId(), "ADMIN_UPDATE_USER_STATUS")).isEqualTo(2);
        assertThat(auditCount(patient.getId(), "ADMIN_UPDATE_USER_ROLES")).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_id=? and actor_user_id=? and actor_role='ADMIN' and target_type='USER' and decision='ALLOW'", Long.class, patient.getId().toString(), actor.getId())).isEqualTo(3);
    }

    @Test void bothPatchLanesRejectSelfDemoIneligibleActorsAndInvalidBodiesWithoutStateOrAudit() throws Exception {
        User target = fixture("Protected target", true, false, "PATIENT"); JsonNode baseline = detail(target.getId());
        User demo = fixture("Protected shared demo", true, true, "PATIENT");
        for (String lane : List.of("status", "roles")) {
            ObjectNode body = lane.equals("status") ? statusBody("DISABLED") : rolesBody("ADMIN");
            legacy(actor.getId(), lane, body, admin, 409); legacy(demo.getId(), lane, body, admin, 403);
            for (User denied : List.of(fixture("Unverified operator", false, false, "ADMIN"), fixture("Demo operator", true, true, "ADMIN"), fixture("Patient operator", true, false, "PATIENT"))) {
                legacy(target.getId(), lane, body, bearer(denied), 403);
            }
        }
        legacy(target.getId(), "status", statusBody("LOCKED"), admin, 400);
        legacy(target.getId(), "roles", rolesBody(), admin, 400); legacy(target.getId(), "roles", rolesBody("SUPER"), admin, 400);
        assertThat(detail(target.getId())).isEqualTo(baseline); assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_type='USER'", Long.class)).isZero();
    }

    @Test void professionalPutChangingStatusAndRolesWritesOneAuditPerFieldAndOneEpoch() throws Exception {
        User target = fixture("Two audited professional changes", true, false, "PATIENT");
        ObjectNode body = updateBody(detail(target.getId())).put("status", "DISABLED"); body.putArray("roles").add("PATIENT").add("ADMIN");
        JsonNode changed = read(put(PATH + "/" + target.getId()).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(body.toString()), 200);
        assertThat(changed.path("version").asLong()).isEqualTo(1);
        assertThat(auditCount(target.getId(), "ADMIN_UPDATE_USER_STATUS")).isEqualTo(1);
        assertThat(auditCount(target.getId(), "ADMIN_UPDATE_USER_ROLES")).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_type='USER' and target_id=?", Long.class, target.getId().toString())).isEqualTo(2);
    }

    @Test void legacyDoctorRolePatchRequiresBoundActiveProfileAndRemovalRequiresProfessionalExplicitUnlink() throws Exception {
        User target = fixture("Bound clinician", true, false, "PATIENT");
        legacy(target.getId(), "roles", rolesBody("DOCTOR"), admin, 400);
        Doctor bound = doctor(target.getDisplayName(), false, target.getId());
        legacy(target.getId(), "roles", rolesBody("DOCTOR"), admin, 400);
        jdbcTemplate.update("update doctors set active=true where id=?", bound.getId());
        JsonNode grantedLegacy = legacy(target.getId(), "roles", rolesBody("DOCTOR"), admin, 200); assertLegacySafe(grantedLegacy);
        JsonNode granted = detail(target.getId());
        assertThat(granted.path("doctorProfileId").asText()).isEqualTo(bound.getId().toString());
        legacy(target.getId(), "roles", rolesBody("PATIENT"), admin, 409); assertThat(detail(target.getId())).isEqualTo(granted);
        ObjectNode unlink = updateBody(granted).put("unlinkDoctorProfile", true); unlink.putArray("roles").add("PATIENT");
        JsonNode removed = read(put(PATH + "/" + target.getId()).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(unlink.toString()), 200);
        assertThat(removed.path("doctorProfileId").isNull()).isTrue(); assertThat(doctorRepository.findById(bound.getId()).orElseThrow().getUserId()).isNull();
    }

    @Test void patchStatusCycleNeverRestoresOldJwtRefreshBrowserOrOtp() throws Exception {
        User target = fixture("Legacy status credentials", true, false, "PATIENT"); Credentials old = issue(target);
        UUID otp = otp(target);
        legacy(target.getId(), "status", statusBody("DISABLED"), admin, 200); rejected(old);
        assertThat(jdbcTemplate.queryForObject("select consumed_at is not null from auth_otp_challenges where id=?", Boolean.class, otp)).isTrue();
        legacy(target.getId(), "status", statusBody("ACTIVE"), admin, 200); rejected(old);
        assertThat(detail(target.getId()).path("version").asLong()).isEqualTo(2);
        JsonNode fresh = login(target); assertThat(tokens.extractSecurityVersion(fresh.path("accessToken").asText())).isEqualTo(2);
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + fresh.path("accessToken").asText())).andExpect(status().isOk());
    }

    @Test void patchRoleCycleNeverRestoresOldAdministratorCredentials() throws Exception {
        User target = fixture("Legacy role credentials", true, false, "ADMIN"); Credentials old = issue(target);
        legacy(target.getId(), "roles", rolesBody("PATIENT"), admin, 200); rejected(old);
        legacy(target.getId(), "roles", rolesBody("ADMIN"), admin, 200); rejected(old);
        assertThat(detail(target.getId()).path("version").asLong()).isEqualTo(2);
        mockMvc.perform(get(PATH).header("Authorization", "Bearer " + login(target).path("accessToken").asText())).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"status", "roles", "put"})
    void allowAuditJoinsActualMutationTransactionAndCannotSurviveOuterRollback(String lane) throws Exception {
        User target = fixture("Outer rollback", true, false, "PATIENT"); JsonNode before = detail(target.getId()); Credentials old = issue(target);
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            try {
                read(auditedMutation(target.getId(), lane, before), 200);
                assertThat(auditCount(target.getId(), auditAction(lane))).isEqualTo(1);
                assertThat(jdbcTemplate.queryForObject("select security_version from users where id=?", Long.class, target.getId())).isEqualTo(1);
                tx.setRollbackOnly();
            } catch (Exception exception) { throw new AssertionError(exception); }
        });
        assertThat(detail(target.getId())).isEqualTo(before); assertThat(auditCount(target.getId(), auditAction(lane))).isZero(); accepted(old);
    }

    @ParameterizedTest
    @ValueSource(strings = {"status", "roles", "put"})
    void injectedAuditInsertFailureRollsBackStateEpochSessionsOtpAndAudit(String lane) throws Exception {
        User target = fixture("Audit failure rollback", true, false, "PATIENT"); JsonNode before = detail(target.getId()); Credentials old = issue(target); UUID otp = otp(target);
        // Real database fault, narrowly scoped to one synthetic account; no service mock.
        jdbcTemplate.execute("create function test_fail_account_audit() returns trigger language plpgsql as $$ begin if NEW.target_type='USER' and NEW.target_id='" + target.getId() + "' then raise exception 'synthetic governance audit insertion fault'; end if; return NEW; end; $$");
        jdbcTemplate.execute("create trigger test_fail_account_audit before insert on clinical_access_audit for each row execute function test_fail_account_audit()");
        try { read(auditedMutation(target.getId(), lane, before), 500); }
        finally { jdbcTemplate.execute("drop trigger test_fail_account_audit on clinical_access_audit"); jdbcTemplate.execute("drop function test_fail_account_audit()"); }
        assertThat(detail(target.getId())).isEqualTo(before); assertThat(auditCount(target.getId(), auditAction(lane))).isZero();
        assertThat(jdbcTemplate.queryForObject("select count(*) from refresh_tokens where user_id=? and revoked_at is null", Long.class, target.getId())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from browser_sessions where user_id=? and revoked_at is null", Long.class, target.getId())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select consumed_at is null from auth_otp_challenges where id=?", Boolean.class, otp)).isTrue(); accepted(old);
    }

    private JsonNode legacy(UUID id, String lane, ObjectNode body, String authorization, int code) throws Exception {
        return read(patch(PATH + "/" + id + "/" + lane).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON).content(body.toString()), code);
    }
    private MockHttpServletRequestBuilder auditedMutation(UUID id, String lane, JsonNode before) {
        if (lane.equals("put")) return put(PATH + "/" + id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(updateBody(before).put("status", "DISABLED").toString());
        ObjectNode body = lane.equals("roles") ? rolesBody("PATIENT", "ADMIN") : statusBody("DISABLED");
        return patch(PATH + "/" + id + "/" + lane).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(body.toString());
    }
    private String auditAction(String lane) { return lane.equals("roles") ? "ADMIN_UPDATE_USER_ROLES" : "ADMIN_UPDATE_USER_STATUS"; }
    private ObjectNode statusBody(String value) { return mapper.createObjectNode().put("status", value); }
    private ObjectNode rolesBody(String... values) { ObjectNode body = mapper.createObjectNode(); var array = body.putArray("roles"); for (String value : values) array.add(value); return body; }
    private ObjectNode updateBody(JsonNode before) {
        ObjectNode body = mapper.createObjectNode().put("email", before.path("email").asText()).put("displayName", before.path("displayName").asText())
            .put("status", before.path("status").asText()).put("expectedVersion", before.path("version").asLong()).put("expectedUpdatedAt", before.path("updatedAt").asText());
        body.set("roles", before.path("roles").deepCopy()); return body;
    }
    private JsonNode detail(UUID id) throws Exception { return read(get(PATH + "/" + id).header("Authorization", admin), 200); }
    private JsonNode read(MockHttpServletRequestBuilder request, int code) throws Exception {
        var result = mockMvc.perform(request).andExpect(status().is(code)).andReturn();
        if (code >= 200 && code < 300 && result.getRequest().getRequestURI().startsWith(PATH)) assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
        return mapper.readTree(result.getResponse().getContentAsString());
    }
    private void assertSafe(JsonNode row) {
        List<String> fields = new ArrayList<>(); row.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("id", "email", "displayName", "status", "roles", "emailVerified", "emailVerifiedAt", "demo", "createdAt", "updatedAt", "version", "doctorProfile", "patientProfileId", "googleLinked", "phone", "doctorProfileId");
        assertThat(row.toString()).doesNotContain("passwordHash", "googleSubject", "tokenHash", "accessToken", "refreshToken");
    }
    private JsonNode canonicalInstants(JsonNode row) {
        ObjectNode canonical = row.deepCopy();
        for (String field : List.of("createdAt", "updatedAt")) {
            if (!canonical.path(field).isNull()) canonical.put(field, OffsetDateTime.parse(canonical.path(field).asText()).toInstant().toString());
        }
        return canonical;
    }
    private void assertLegacySafe(JsonNode row) {
        List<String> fields = new ArrayList<>(); row.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("id", "email", "displayName", "status", "roles", "emailVerified", "demo", "phone", "patientProfileId", "doctorProfileId", "createdAt", "updatedAt");
        assertThat(row.toString()).doesNotContain("passwordHash", "googleSubject", "tokenHash", "accessToken", "refreshToken");
    }
    private List<String> ids(JsonNode page) { List<String> result = new ArrayList<>(); page.path("content").forEach(row -> result.add(row.path("id").asText())); return result; }
    private long auditCount(UUID target, String action) { return jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_type='USER' and target_id=? and action=?", Long.class, target.toString(), action); }
    private User fixture(String name, boolean verified, boolean demo, String... codes) {
        return new TransactionTemplate(transactions).execute(tx -> {
            User user = new User(); user.setEmail("legacy-account-" + UUID.randomUUID() + "@healthcare.local"); user.setDisplayName(name);
            user.setPasswordHash(passwords.encode(PASSWORD)); user.setStatus("ACTIVE"); user.setEmailVerified(verified); user.setDemo(demo);
            user.setCreatedAt(OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS)); user.setUpdatedAt(user.getCreatedAt());
            for (String code : codes) user.addRole(roles.findByCode(code).orElseThrow()); return userRepository.saveAndFlush(user);
        });
    }
    private Doctor doctor(String name, boolean active, UUID user) { Doctor result = new Doctor(); result.setFullName(name); result.setSlug("legacy-profile-" + UUID.randomUUID()); result.setActive(active); result.setUserId(user); return doctorRepository.saveAndFlush(result); }
    private String bearer(User user) { return "Bearer " + tokens.generateAccessToken(user.getId(), user.getEmail(), user.getSecurityVersion()); }
    private JsonNode login(User user) throws Exception { return read(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(mapper.createObjectNode().put("email", user.getEmail()).put("password", PASSWORD).toString()), 200); }
    private Credentials issue(User user) throws Exception { JsonNode auth = login(user); return new Credentials("Bearer " + auth.path("accessToken").asText(), auth.path("refreshToken").asText(), sessions.issue(user.getId()).rawSessionSecret()); }
    private UUID otp(User user) { UUID id = UUID.randomUUID(); jdbcTemplate.update("insert into auth_otp_challenges(id,user_id,otp_hash,purpose,expires_at) values(?,?,?,'PASSWORD_RESET',?)", id, user.getId(), passwords.encode("SyntheticOtp1"), OffsetDateTime.now().plusMinutes(10)); return id; }
    private void rejected(Credentials value) throws Exception {
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", value.access())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users/me").cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, value.browser()))).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(mapper.createObjectNode().put("refreshToken", value.refresh()).toString())).andExpect(status().isUnauthorized());
    }
    private void accepted(Credentials value) throws Exception {
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", value.access())).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me").cookie(new Cookie(BrowserSessionService.SESSION_COOKIE_NAME, value.browser()))).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(mapper.createObjectNode().put("refreshToken", value.refresh()).toString())).andExpect(status().isOk());
    }
    private record Credentials(String access, String refresh, String browser) { }
}
