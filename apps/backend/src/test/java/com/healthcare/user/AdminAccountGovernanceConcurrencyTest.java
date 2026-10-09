package com.healthcare.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.auth.mail.EmailSender;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.service.AccountGovernance;
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

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real transactions and HTTP principals; the holder drives ordering via the same PostgreSQL lock as production. */
class AdminAccountGovernanceConcurrencyTest extends AbstractIntegrationTest {
    private static final String ACCOUNTS = "/api/v1/admin/users/";
    private static final String DOCTORS = "/api/v1/admin/doctors/";
    @Autowired private ObjectMapper mapper;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwords;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private PlatformTransactionManager transactions;
    @Autowired private AccountGovernance governance;
    @MockitoBean private EmailSender emailSender;
    private User actor;
    private String admin;

    @BeforeEach
    void administrator() { actor = fixture("Primary race administrator", "ADMIN"); admin = bearer(actor); }

    @Test
    void twoAdministratorsCannotConcurrentlyDemoteEachOtherPastTheLastEligibleAdministrator() throws Exception {
        User other = fixture("Second race administrator", "ADMIN");
        ObjectNode demoteOther = updateBody(detail(other.getId())); demoteOther.putArray("roles").add("PATIENT");
        ObjectNode demoteActor = updateBody(detail(actor.getId())); demoteActor.putArray("roles").add("PATIENT");
        ExecutorService workers = Executors.newFixedThreadPool(2);
        AtomicReference<Future<MvcResult>> one = new AtomicReference<>();
        AtomicReference<Future<MvcResult>> two = new AtomicReference<>();
        CountDownLatch started = new CountDownLatch(2);
        try {
            new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                governance.acquire();
                one.set(workers.submit(() -> { started.countDown(); return perform(accountRequest(other.getId(), demoteOther, admin)); }));
                two.set(workers.submit(() -> { started.countDown(); return perform(accountRequest(actor.getId(), demoteActor, bearer(other))); }));
                await(started); awaitBlocked(2);
            });
            assertThat(List.of(one.get().get(15, TimeUnit.SECONDS).getResponse().getStatus(),
                two.get().get(15, TimeUnit.SECONDS).getResponse().getStatus())).containsExactlyInAnyOrder(200, 403);
            assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject("select sum(security_version) from users", Long.class)).isEqualTo(1);
        } finally { stopWorkers(workers); }
    }

    @Test
    void queuedActorIsRevalidatedAfterAnotherAdministratorCommitsItsDemotion() throws Exception {
        User staleActor = fixture("Queued stale administrator", "ADMIN");
        User patient = fixture("Unchanged patient", "PATIENT");
        JsonNode baseline = detail(patient.getId());
        ObjectNode staleWrite = updateBody(baseline).put("displayName", "Must not commit");
        ObjectNode demotion = updateBody(detail(staleActor.getId())); demotion.putArray("roles").add("PATIENT");
        MvcResult denied = queueBehind(accountRequest(patient.getId(), staleWrite, bearer(staleActor)),
            () -> expect(accountRequest(staleActor.getId(), demotion, admin), 200));
        assertThat(denied.getResponse().getStatus()).isEqualTo(403);
        assertThat(detail(patient.getId())).isEqualTo(baseline);
        assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
    }

    @Test
    void legacyRolePatchAndProfessionalHoldCannotRemoveBothEligibleAdministrators() throws Exception {
        mixedAdministratorRace(true, false);
    }

    @Test
    void legacyStatusPatchAndProfessionalDemotionCannotRemoveBothEligibleAdministrators() throws Exception {
        mixedAdministratorRace(false, false);
    }

    @Test
    void legacyRoleAndStatusPatchesShareOneEligibleAdministratorSentinel() throws Exception {
        mixedAdministratorRace(true, true);
    }

    private void mixedAdministratorRace(boolean firstIsRoles, boolean secondIsPatch) throws Exception {
        User other = fixture("Mixed-writer second administrator", "ADMIN");
        User demo = fixture("Ineligible demo roster entry", "ADMIN");
        User unverified = fixture("Ineligible unverified roster entry", "ADMIN");
        jdbcTemplate.update("update users set is_demo=true where id=?", demo.getId());
        jdbcTemplate.update("update users set email_verified=false where id=?", unverified.getId());
        ObjectNode first = firstIsRoles ? legacyRoles("PATIENT") : mapper.createObjectNode().put("status", "DISABLED");
        ObjectNode second = updateBody(detail(actor.getId()));
        if (firstIsRoles) second.put("status", "DISABLED"); else second.putArray("roles").add("PATIENT");
        MockHttpServletRequestBuilder requestOne = legacyRequest(other.getId(), firstIsRoles ? "roles" : "status", first, admin);
        MockHttpServletRequestBuilder requestTwo = secondIsPatch
            ? legacyRequest(actor.getId(), "status", mapper.createObjectNode().put("status", "DISABLED"), bearer(other))
            : accountRequest(actor.getId(), second, bearer(other));
        ExecutorService workers = Executors.newFixedThreadPool(2);
        AtomicReference<Future<MvcResult>> one = new AtomicReference<>(); AtomicReference<Future<MvcResult>> two = new AtomicReference<>();
        CountDownLatch started = new CountDownLatch(2);
        try {
            new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                governance.acquire();
                one.set(workers.submit(() -> { started.countDown(); return perform(requestOne); }));
                two.set(workers.submit(() -> { started.countDown(); return perform(requestTwo); }));
                await(started); awaitBlocked(2);
            });
            assertThat(List.of(one.get().get(15, TimeUnit.SECONDS).getResponse().getStatus(), two.get().get(15, TimeUnit.SECONDS).getResponse().getStatus())).containsExactlyInAnyOrder(200, 403);
            assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject("select sum(security_version) from users", Long.class)).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_type='USER' and decision='ALLOW'", Long.class)).isEqualTo(1);
            assertThat(userRepository.findById(demo.getId()).orElseThrow().getSecurityVersion()).isZero();
            assertThat(userRepository.findById(unverified.getId()).orElseThrow().getSecurityVersion()).isZero();
        } finally { stopWorkers(workers); }
    }

    @Test
    void queuedLegacyStatusPatchRechecksActorAfterProfessionalDemotion() throws Exception {
        queuedLegacyActor(false);
    }

    @Test
    void queuedLegacyRolePatchRechecksActorAfterLegacyDemotion() throws Exception {
        queuedLegacyActor(true);
    }

    private void queuedLegacyActor(boolean rolesPatch) throws Exception {
        User staleActor = fixture("Queued legacy administrator", "ADMIN"); User patient = fixture("Unchanged mixed-writer patient", "PATIENT");
        JsonNode baseline = detail(patient.getId());
        ObjectNode body = rolesPatch ? legacyRoles("PATIENT", "ADMIN") : mapper.createObjectNode().put("status", "DISABLED");
        ObjectNode demotion = updateBody(detail(staleActor.getId())); demotion.putArray("roles").add("PATIENT");
        MvcResult denied = queueBehind(legacyRequest(patient.getId(), rolesPatch ? "roles" : "status", body, bearer(staleActor)), () -> {
            if (rolesPatch) expect(legacyRequest(staleActor.getId(), "roles", legacyRoles("PATIENT"), admin), 200);
            else expect(accountRequest(staleActor.getId(), demotion, admin), 200);
        });
        assertThat(denied.getResponse().getStatus()).isEqualTo(403); assertThat(detail(patient.getId())).isEqualTo(baseline);
        assertThat(userRepository.countEligibleAdministrators()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from clinical_access_audit where target_id=?", Long.class, patient.getId().toString())).isZero();
    }

    @Test
    void queuedLegacyPatchPreservesFieldsChangedByCommittedProfessionalUpdate() throws Exception {
        User patient = fixture("Before professional rename", "PATIENT"); JsonNode baseline = detail(patient.getId());
        MvcResult held = queueBehind(legacyRequest(patient.getId(), "status", mapper.createObjectNode().put("status", "DISABLED"), admin),
            () -> expect(accountRequest(patient.getId(), updateBody(baseline).put("displayName", "Committed professional rename"), admin), 200));
        assertThat(held.getResponse().getStatus()).isEqualTo(200);
        JsonNode after = detail(patient.getId()); assertThat(after.path("displayName").asText()).isEqualTo("Committed professional rename");
        assertThat(after.path("status").asText()).isEqualTo("DISABLED"); assertThat(after.path("roles")).isEqualTo(baseline.path("roles"));
        assertThat(after.path("version").asLong()).isEqualTo(1);
    }

    @Test
    void queuedLegacyRolePatchRejectsProfileDeactivatedByDoctorWriter() throws Exception {
        User patient = fixture("Legacy bound profile", "PATIENT"); Doctor profile = doctor(patient.getDisplayName(), patient.getId());
        JsonNode baseline = detail(patient.getId());
        MvcResult denied = queueBehind(legacyRequest(patient.getId(), "roles", legacyRoles("DOCTOR"), admin),
            () -> expect(doctorRequest(profile, profile.getFullName(), false, null), 200));
        assertThat(denied.getResponse().getStatus()).isEqualTo(400);
        assertThat(detail(patient.getId()).path("roles")).isEqualTo(baseline.path("roles"));
        assertThat(doctorRepository.findById(profile.getId()).orElseThrow().isActive()).isFalse();
    }

    @Test
    void queuedGrantCannotStealProfileCommittedThroughLegacyDoctorBinding() throws Exception {
        User patient = fixture("Shared clinician name", "PATIENT");
        User existingDoctor = fixture("Shared clinician name", "DOCTOR");
        Doctor profile = doctor("Shared clinician name", null);
        ObjectNode grant = grant(detail(patient.getId()), profile);
        MvcResult denied = queueBehind(accountRequest(patient.getId(), grant, admin),
            () -> expect(doctorRequest(profile, "Shared clinician name", true, existingDoctor.getId()), 200));
        assertThat(denied.getResponse().getStatus()).isEqualTo(409);
        assertThat(doctorRepository.findById(profile.getId()).orElseThrow().getUserId()).isEqualTo(existingDoctor.getId());
        assertThat(detail(patient.getId()).path("version").asLong()).isZero();
        assertThat(detail(patient.getId()).path("roles").get(0).asText()).isEqualTo("PATIENT");
        assertThat(detail(existingDoctor.getId()).path("version").asLong()).isEqualTo(1);
    }

    @Test
    void queuedGrantRejectsProfileDeactivatedByCommittedLegacyUpdate() throws Exception {
        User patient = fixture("Deactivated clinician", "PATIENT");
        Doctor profile = doctor("Deactivated clinician", null);
        MvcResult denied = queueBehind(accountRequest(patient.getId(), grant(detail(patient.getId()), profile), admin),
            () -> expect(doctorRequest(profile, profile.getFullName(), false, null), 200));
        assertThat(denied.getResponse().getStatus()).isEqualTo(400);
        assertThat(doctorRepository.findById(profile.getId()).orElseThrow().isActive()).isFalse();
        assertThat(detail(patient.getId()).path("version").asLong()).isZero();
    }

    @Test
    void queuedGrantRejectsProfileDeletedByCommittedLegacyDelete() throws Exception {
        User patient = fixture("Deleted clinician", "PATIENT");
        Doctor profile = doctor("Deleted clinician", null);
        MvcResult denied = queueBehind(accountRequest(patient.getId(), grant(detail(patient.getId()), profile), admin),
            () -> expect(delete(DOCTORS + profile.getSlug()).header("Authorization", admin), 204));
        assertThat(denied.getResponse().getStatus()).isEqualTo(404);
        assertThat(doctorRepository.findById(profile.getId())).isEmpty();
        assertThat(detail(patient.getId()).path("version").asLong()).isZero();
    }

    @Test
    void legacyDeleteAfterCommittedGrantRetainsTruthfulRoleAndRevokesBindingEpoch() throws Exception {
        User patient = fixture("Granted clinician", "PATIENT");
        Doctor profile = doctor("Granted clinician", null);
        ObjectNode grant = grant(detail(patient.getId()), profile);
        AtomicReference<String> grantedToken = new AtomicReference<>();
        MvcResult deleted = queueBehind(delete(DOCTORS + profile.getSlug()).header("Authorization", admin), () -> {
            MvcResult granted = expect(accountRequest(patient.getId(), grant, admin), 200);
            JsonNode result = mapper.readTree(granted.getResponse().getContentAsString());
            grantedToken.set("Bearer " + tokens.generateAccessToken(patient.getId(), patient.getEmail(), result.path("version").asLong()));
        });
        assertThat(deleted.getResponse().getStatus()).isEqualTo(204);
        JsonNode finalAccount = detail(patient.getId());
        assertThat(finalAccount.path("roles").get(0).asText()).isEqualTo("DOCTOR");
        assertThat(finalAccount.path("doctorProfile").isNull()).isTrue();
        assertThat(finalAccount.path("version").asLong()).isEqualTo(2);
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", grantedToken.get())).andExpect(status().isUnauthorized());
    }

    @Test
    void queuedLegacyNameSyncCannotOverwriteCommittedRolesOrSecurityEpoch() throws Exception {
        User clinician = fixture("Original clinician", "DOCTOR");
        Doctor profile = doctor("Original clinician", clinician.getId());
        String oldCredential = bearer(clinician);
        ObjectNode roleUpdate = updateBody(detail(clinician.getId())); roleUpdate.putArray("roles").add("DOCTOR").add("PATIENT");
        MvcResult rename = queueBehind(doctorRequest(profile, "New factual clinician name", true, clinician.getId()),
            () -> expect(accountRequest(clinician.getId(), roleUpdate, admin), 200));
        assertThat(rename.getResponse().getStatus()).isEqualTo(200);
        JsonNode after = detail(clinician.getId());
        assertThat(after.path("version").asLong()).isEqualTo(1);
        assertThat(after.path("roles").get(0).asText()).isEqualTo("DOCTOR");
        assertThat(after.path("roles").get(1).asText()).isEqualTo("PATIENT");
        assertThat(after.path("displayName").asText()).isEqualTo("New factual clinician name");
        assertThat(after.path("doctorProfile").path("fullName").asText()).isEqualTo("New factual clinician name");
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", oldCredential)).andExpect(status().isUnauthorized());
    }

    private MvcResult queueBehind(MockHttpServletRequestBuilder queued, CheckedAction first) throws Exception {
        ExecutorService worker = Executors.newSingleThreadExecutor();
        AtomicReference<Future<MvcResult>> future = new AtomicReference<>();
        CountDownLatch started = new CountDownLatch(1);
        try {
            new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                governance.acquire();
                future.set(worker.submit(() -> { started.countDown(); return perform(queued); }));
                await(started); awaitBlocked(1);
                try { first.run(); } catch (Exception exception) { throw new AssertionError(exception); }
            });
            return future.get().get(15, TimeUnit.SECONDS);
        } finally { stopWorkers(worker); }
    }

    private void awaitBlocked(int expected) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            // Dynamic activity data is cached for a transaction too; each sample must observe new backend state.
            jdbcTemplate.execute("select pg_stat_clear_snapshot()");
            Long count = jdbcTemplate.queryForObject("select count(*) from pg_stat_activity a join pg_locks l on l.pid=a.pid "
                + "where a.pid<>pg_backend_pid() and a.datname=current_database() and a.wait_event_type='Lock' "
                + "and a.query like '%pg_advisory_xact_lock%' and l.locktype='advisory' and l.granted=false "
                + "and l.classid::bigint=? and l.objid::bigint=? and l.objsubid=1", Long.class,
                AccountGovernance.LOCK_KEY >>> 32, AccountGovernance.LOCK_KEY & 0xffffffffL);
            if (count != null && count >= expected) return;
            try { Thread.sleep(10); } catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new AssertionError(exception); }
        }
        throw new AssertionError("Queued HTTP mutation never reached the real PostgreSQL account governance lock");
    }
    private void stopWorkers(ExecutorService workers) {
        workers.shutdown();
        try {
            if (!workers.awaitTermination(10, TimeUnit.SECONDS)) {
                workers.shutdownNow();
                assertThat(workers.awaitTermination(5, TimeUnit.SECONDS)).as("Every HTTP worker must finish before fixture cleanup").isTrue();
            }
        } catch (InterruptedException exception) {
            workers.shutdownNow(); Thread.currentThread().interrupt(); throw new AssertionError(exception);
        }
    }
    private void await(CountDownLatch latch) {
        try { assertThat(latch.await(5, TimeUnit.SECONDS)).isTrue(); }
        catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new AssertionError(exception); }
    }
    private JsonNode detail(UUID id) throws Exception {
        return mapper.readTree(expect(get(ACCOUNTS + id).header("Authorization", admin), 200).getResponse().getContentAsString());
    }
    private ObjectNode updateBody(JsonNode before) {
        ObjectNode body = mapper.createObjectNode().put("email", before.path("email").asText()).put("displayName", before.path("displayName").asText())
            .put("status", before.path("status").asText()).put("expectedVersion", before.path("version").asLong())
            .put("expectedUpdatedAt", before.path("updatedAt").asText());
        body.set("roles", before.path("roles").deepCopy()); return body;
    }
    private ObjectNode grant(JsonNode before, Doctor profile) {
        ObjectNode body = updateBody(before).put("doctorProfileId", profile.getId().toString()); body.putArray("roles").add("DOCTOR"); return body;
    }
    private MockHttpServletRequestBuilder accountRequest(UUID id, ObjectNode body, String authorization) {
        return put(ACCOUNTS + id).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON).content(body.toString());
    }
    private ObjectNode legacyRoles(String... codes) {
        ObjectNode body = mapper.createObjectNode(); var array = body.putArray("roles"); for (String code : codes) array.add(code); return body;
    }
    private MockHttpServletRequestBuilder legacyRequest(UUID id, String lane, ObjectNode body, String authorization) {
        return patch(ACCOUNTS + id + "/" + lane).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON).content(body.toString());
    }
    private MockHttpServletRequestBuilder doctorRequest(Doctor doctor, String name, boolean active, UUID user) {
        ObjectNode body = mapper.createObjectNode().put("fullName", name).put("slug", doctor.getSlug()).put("active", active);
        if (user != null) body.put("userId", user.toString());
        return put(DOCTORS + doctor.getSlug()).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(body.toString());
    }
    private MvcResult perform(MockHttpServletRequestBuilder request) throws Exception { return mockMvc.perform(request).andReturn(); }
    private MvcResult expect(MockHttpServletRequestBuilder request, int code) throws Exception { return mockMvc.perform(request).andExpect(status().is(code)).andReturn(); }
    private User fixture(String name, String role) {
        return new TransactionTemplate(transactions).execute(tx -> {
            User user = new User(); user.setEmail("account-race-" + UUID.randomUUID() + "@healthcare.local");
            user.setDisplayName(name); user.setStatus("ACTIVE"); user.setEmailVerified(true);
            user.setPasswordHash(passwords.encode("Synthetic!Pass123")); user.setCreatedAt(OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS));
            user.setUpdatedAt(user.getCreatedAt()); user.addRole(roles.findByCode(role).orElseThrow()); return userRepository.saveAndFlush(user);
        });
    }
    private String bearer(User user) { return "Bearer " + tokens.generateAccessToken(user.getId(), user.getEmail(), user.getSecurityVersion()); }
    private Doctor doctor(String name, UUID userId) {
        Doctor profile = new Doctor(); profile.setFullName(name); profile.setSlug("race-profile-" + UUID.randomUUID());
        profile.setActive(true); profile.setUserId(userId); return doctorRepository.saveAndFlush(profile);
    }
    @FunctionalInterface private interface CheckedAction { void run() throws Exception; }
}
