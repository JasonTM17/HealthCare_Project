package com.healthcare.cms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.cms.entity.CmsContentChange;
import com.healthcare.cms.service.CmsContentChangedEvent;
import com.healthcare.cms.service.CmsPageLayoutManifest;
import com.healthcare.cms.service.CmsPublishedContentCache;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real HTTP/security/transaction boundaries; cleanup is owned by the disposable-database base. */
@RecordApplicationEvents
class CmsDraftIntegrationTest extends AbstractIntegrationTest {
    private static final String ADMIN = "/api/v1/admin/cms/content/";
    private static final String PUBLIC = "/api/v1/cms/content/";

    @Autowired private ObjectMapper mapper;
    @Autowired private CmsPageLayoutManifest manifest;
    @Autowired private CmsPublishedContentCache cache;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwords;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private PlatformTransactionManager transactions;
    @Autowired private ApplicationEvents events;
    private String admin;

    @BeforeEach
    void prepareAdminAndCache() {
        cache.clear();
        admin = bearer("ADMIN");
        events.clear();
    }

    @Test
    void firstDraftIsPrivateInGetInventoryHistoryAndPublicReplay() throws Exception {
        String slot = "homepage.hero";
        JsonNode draft = save(slot, "HERO", title("Private first draft"), 0);
        assertThat(draft.path("hasDraft").asBoolean()).isTrue();
        assertThat(draft.path("expectedVersion").asLong()).isPositive();
        assertThat(draft.path("publicContent").isNull()).isTrue();
        assertThat(draft.path("draftUpdatedAt").isTextual()).isTrue();
        mockMvc.perform(get(PUBLIC + slot)).andExpect(status().isNotFound());
        JsonNode inventory = read(get("/api/v1/cms/content"), 200);
        assertThat(inventory).isEmpty();
        JsonNode history = history(slot);
        assertThat(history).hasSize(1);
        assertThat(history.get(0).path("status").asText()).isEqualTo("DRAFT");
        assertThat(history.get(0).path("payload")).isEqualTo(draft.path("payload"));
        assertThat(history.get(0).path("rollbackAvailable").asBoolean()).isTrue();
        assertPrivateChanges(slot, 1);
        assertThat(publishedEvents(slot)).isEmpty();
        assertThat(replay(0)).doesNotContain("event:cms-content-changed", "Private first draft", slot);
    }

    @Test
    void draftSaveAndRestoreKeepFrozenPublicPayloadRevisionAndTimestamp() throws Exception {
        String slot = "about.body";
        JsonNode original = legacy(slot, "NOTICE", notice("Public original"), "PUBLISHED", 0);
        JsonNode frozen = publicSnapshot(slot, false); // prime the real published cache
        long publicCursor = lastPublicEvent();
        JsonNode first = save(slot, "NOTICE", notice("Private A"), original.path("version").asLong());
        long privateHistoryId = history(slot).get(0).path("eventId").asLong();
        JsonNode second = save(slot, "NOTICE", notice("Private B"), version(first));
        JsonNode restored = read(post(ADMIN + slot + "/restore-draft").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(restoreBody(privateHistoryId, version(second))), 200);
        assertThat(restored.path("payload").path("title").asText()).isEqualTo("Private A");
        assertThat(version(restored)).isGreaterThan(version(second));
        assertThat(restored.path("publicContent")).isEqualTo(frozen);
        assertThat(publicSnapshot(slot, false)).isEqualTo(frozen);
        assertThat(publicSnapshot(slot, true)).isEqualTo(frozen);
        assertThat(read(get("/api/v1/cms/content"), 200).get(0)).isEqualTo(frozen);
        assertThat(lastPublicEvent()).isEqualTo(publicCursor);
        assertPrivateChanges(slot, 3);
        assertThat(publishedEvents(slot)).hasSize(1);
        assertThat(replay(publicCursor)).doesNotContain("event:cms-content-changed", "Private A", "Private B");
    }

    @Test
    void staleSavePublishAndRestoreCannotOverwriteWinningDraftOrProduceEvents() throws Exception {
        String slot = "branches.body";
        JsonNode first = save(slot, "NOTICE", notice("Original private work"), 0);
        long changeId = history(slot).get(0).path("eventId").asLong();
        long stale = version(first);
        // Deterministic competing-editor schedule: both observed the same token; editor A commits first.
        JsonNode winner = save(slot, "NOTICE", notice("Editor A wins"), stale);
        JsonNode persistedWinner = read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200);
        long changesBefore = cmsContentChangeRepository.count();
        read(draftRequest(slot, "NOTICE", notice("Editor B must not win"), stale), 409);
        read(post(ADMIN + slot + "/publish").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(versionBody(stale)), 409);
        read(post(ADMIN + slot + "/restore-draft").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(restoreBody(changeId, stale)), 409);
        assertThat(persistedWinner.path("payload")).isEqualTo(winner.path("payload"));
        assertThat(read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200)).isEqualTo(persistedWinner);
        assertThat(cmsContentChangeRepository.count()).isEqualTo(changesBefore);
        assertThat(publishedEvents(slot)).isEmpty();
        mockMvc.perform(get(PUBLIC + slot)).andExpect(status().isNotFound());
    }

    @Test
    void explicitPublishPromotesExactlyOneFrozenRevisionAndClearsDraft() throws Exception {
        String slot = "homepage.layout";
        JsonNode first = save(slot, "PAGE_LAYOUT", layoutTitle(slot, "Initial public layout"), 0);
        JsonNode published = publish(slot, version(first));
        JsonNode frozen = publicSnapshot(slot, false);
        long cursor = lastPublicEvent();
        JsonNode draft = save(slot, "PAGE_LAYOUT", layoutTitle(slot, "Working layout"), version(published));
        JsonNode latest = save(slot, "PAGE_LAYOUT", layoutTitle(slot, "Final public layout"), version(draft));
        assertThat(publicSnapshot(slot, true)).isEqualTo(frozen);
        events.clear();
        MvcResult live = mockMvc.perform(get("/api/v1/cms/content/events").param("after", Long.toString(cursor)))
            .andExpect(request().asyncStarted()).andReturn();
        try {
            JsonNode result = publish(slot, version(latest));
            assertThat(result.path("hasDraft").asBoolean()).isFalse();
            assertThat(result.path("draftUpdatedAt").isNull()).isTrue();
            assertThat(result.path("payload")).isEqualTo(latest.path("payload"));
            JsonNode current = publicSnapshot(slot, false);
            assertThat(current.path("payload")).isEqualTo(latest.path("payload"));
            assertPublishedResponse(current, result.path("publicContent"));
            assertThat(current).isEqualTo(publicSnapshot(slot, true));
            long publicRevision = current.path("version").asLong();
            assertThat(publicRevision).isEqualTo(version(latest) + 1).isEqualTo(version(result));
            assertThat(publicRevision).isGreaterThan(frozen.path("version").asLong());
            List<CmsContentChange> changes = cmsContentChangeRepository.findAfterId(cursor, PageRequest.of(0, 10));
            assertThat(changes).hasSize(1);
            CmsContentChange change = changes.get(0);
            assertThat(change.getSlotKey()).isEqualTo(slot);
            assertThat(change.getContentVersion()).isEqualTo(publicRevision);
            assertThat(change.isPublished()).isTrue();
            assertThat(change.isPublicEvent()).isTrue();
            assertThat(change.getPayload()).isEqualTo(current.path("payload"));
            assertThat(publishedEvents(slot)).singleElement().satisfies(event -> {
                assertThat(event.eventId()).isEqualTo(change.getId());
                assertThat(event.version()).isEqualTo(publicRevision);
                assertThat(event.published()).isTrue();
            });
            assertOneSseChange(live.getResponse().getContentAsString(), slot, publicRevision);
            assertOneSseChange(replay(cursor), slot, publicRevision);
            assertThat(cmsContentRepository.findBySlotKey(slot).orElseThrow().getDraftPayload()).isNull();
            long count = cmsContentChangeRepository.count();
            read(post(ADMIN + slot + "/publish").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON).content(versionBody(version(result))), 409);
            assertThat(cmsContentChangeRepository.count()).isEqualTo(count);
            assertThat(publishedEvents(slot)).hasSize(1);
        } finally {
            closeStream(live);
        }
    }

    @Test
    void restoringPublishedHistoryCreatesOnlyPrivateDraftUntilExplicitPublish() throws Exception {
        String slot = "specialties.body";
        JsonNode first = legacy(slot, "RICH_TEXT", notice("First publication"), "PUBLISHED", 0);
        long firstId = history(slot).get(0).path("eventId").asLong();
        JsonNode second = legacy(slot, "RICH_TEXT", notice("Current publication"), "PUBLISHED", first.path("version").asLong());
        JsonNode frozen = publicSnapshot(slot, true);
        long cursor = lastPublicEvent();
        events.clear();
        JsonNode restored = read(post(ADMIN + slot + "/restore-draft").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(restoreBody(firstId, second.path("version").asLong())), 200);
        assertThat(restored.path("payload").path("title").asText()).isEqualTo("First publication");
        assertThat(restored.path("hasDraft").asBoolean()).isTrue();
        assertThat(restored.path("publicContent")).isEqualTo(frozen);
        assertThat(publicSnapshot(slot, true)).isEqualTo(frozen);
        assertPrivateChanges(slot, 1);
        assertThat(lastPublicEvent()).isEqualTo(cursor);
        assertThat(publishedEvents(slot)).isEmpty();
        assertThat(replay(cursor)).doesNotContain("event:cms-content-changed");
    }

    @Test
    void legacyDraftPutStillUnpublishesAndClearsPrivateDraft() throws Exception {
        String slot = "contact.body";
        JsonNode first = legacy(slot, "NOTICE", notice("Original public"), "PUBLISHED", 0);
        JsonNode draft = save(slot, "NOTICE", notice("Pending private"), first.path("version").asLong());
        long cursor = lastPublicEvent();
        events.clear();
        JsonNode result = legacy(slot, "NOTICE", notice("Legacy unpublish"), "DRAFT", version(draft));
        assertThat(result.path("status").asText()).isEqualTo("DRAFT");
        mockMvc.perform(get(PUBLIC + slot)).andExpect(status().isNotFound());
        mockMvc.perform(get(PUBLIC + slot).param("afterEventId", Long.toString(cursor))).andExpect(status().isNotFound());
        JsonNode working = read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200);
        assertThat(working.path("hasDraft").asBoolean()).isFalse();
        assertThat(working.path("publicContent").isNull()).isTrue();
        List<CmsContentChange> changes = cmsContentChangeRepository.findAfterId(cursor, PageRequest.of(0, 10));
        assertThat(changes).singleElement().satisfies(change -> {
            assertThat(change.isPublished()).isFalse();
            assertThat(change.isPublicEvent()).isTrue();
        });
        assertThat(publishedEvents(slot)).singleElement().satisfies(event -> assertThat(event.published()).isFalse());
    }

    @Test
    void legacyPublishedPutClearsDraftAndRetainsAllFiveLegacyComponentTypes() throws Exception {
        String[] types = {"HERO", "RICH_TEXT", "CTA_BANNER", "NOTICE", "IMAGE_CARD"};
        String[] slots = {"homepage.hero", "about.body", "branches.body", "contact.body", "doctors.sidebar"};
        for (int i = 0; i < types.length; i++) {
            ObjectNode payload = types[i].equals("HERO") ? title("Legacy hero") : notice("Legacy content");
            if (types[i].equals("CTA_BANNER")) payload.put("ctaLabel", "Call").put("ctaHref", "tel:115");
            if (types[i].equals("IMAGE_CARD")) payload.put("imageUrl", "https://images.unsplash.com/test.jpg");
            JsonNode initial = legacy(slots[i], types[i], payload, "PUBLISHED", 0);
            JsonNode draft = save(slots[i], types[i], payload.deepCopy().put("title", "Private work"), initial.path("version").asLong());
            JsonNode result = legacy(slots[i], types[i], payload, "PUBLISHED", version(draft));
            assertPublishedResponse(publicSnapshot(slots[i], true), result);
            JsonNode working = read(get(ADMIN + slots[i] + "/draft").header("Authorization", admin), 200);
            assertThat(working.path("hasDraft").asBoolean()).isFalse();
            assertThat(working.path("payload")).isEqualTo(payload);
        }
    }

    @Test
    void layoutBoundaryRejectsUnknownFieldsKindsUnsafeMarkupAndForgedRouteIdentity() throws Exception {
        String slot = "homepage.layout";
        ObjectNode unknown = layout(slot);
        field(unknown, "hero.unknown", "text", "Forged field");
        ObjectNode wrongKind = layout(slot);
        field(wrongKind, "hero.title", "rich", "Wrong kind").put("format", "markdown");
        ObjectNode rawHtml = layout(slot);
        field(rawHtml, "hero.body", "rich", "<script>alert(1)</script>").put("format", "markdown");
        ObjectNode unsafeUrl = layout(slot);
        ((ObjectNode) unsafeUrl.get("fields")).putObject("hero.image").put("kind", "image")
            .put("src", "https://images.unsplash.com.evil.example/image.jpg").put("alt", "Unsafe");
        ObjectNode badVersion = layout(slot).put("schemaVersion", 2);
        ObjectNode duplicate = layout(slot);
        ((com.fasterxml.jackson.databind.node.ArrayNode) duplicate.get("sectionOrder")).set(1,
            mapper.getNodeFactory().textNode("hero"));
        ObjectNode extraKey = layout(slot).put("html", "Forged document");
        for (ObjectNode payload : List.of(unknown, wrongKind, rawHtml, unsafeUrl, badVersion, duplicate, extraKey)) {
            read(draftRequest(slot, "PAGE_LAYOUT", payload, 0), 400);
        }
        for (String forbidden : List.of("admin.layout", "patient.layout", "unknown.layout", "doctors.detail-not-a-uuid.layout")) {
            read(draftRequest(forbidden, "PAGE_LAYOUT", layout(slot), 0), 400);
        }
        read(draftRequest(slot, "NOTICE", notice("Wrong slot kind"), 0), 400);
        read(draftRequest("homepage.hero", "PAGE_LAYOUT", layout(slot), 0), 400);
        assertThat(cmsContentRepository.count()).isZero();
        assertThat(cmsContentChangeRepository.count()).isZero();
    }

    @Test
    void uuidDetailRequiresVisibleEntityAndCannotOverrideProtectedCatalogFacts() throws Exception {
        Branch branch = branch(false);
        String missing = "branches.detail-" + UUID.randomUUID() + ".layout";
        read(draftRequest(missing, "PAGE_LAYOUT", layout(missing), 0), 404);
        String slot = "branches.detail-" + branch.getId() + ".layout";
        read(draftRequest(slot, "PAGE_LAYOUT", layout(slot), 0), 404);
        branch.setActive(true);
        branchRepository.saveAndFlush(branch);
        ObjectNode forged = layout(slot);
        field(forged, "profile.address", "text", "Fabricated clinical location");
        read(draftRequest(slot, "PAGE_LAYOUT", forged, 0), 400);
        JsonNode draft = save(slot, "PAGE_LAYOUT", layout(slot), 0);
        JsonNode persistedDraft = read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200);
        assertThat(draft.path("hasDraft").asBoolean()).isTrue();
        Branch unchanged = branchRepository.findById(branch.getId()).orElseThrow();
        assertThat(unchanged.getName()).isEqualTo("Test branch factual name");
        assertThat(unchanged.getAddress()).isEqualTo("Test branch factual address");
        branch.setActive(false);
        branchRepository.saveAndFlush(branch);
        read(post(ADMIN + slot + "/publish").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(versionBody(version(draft))), 404);
        assertThat(read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200)).isEqualTo(persistedDraft);
        mockMvc.perform(get(PUBLIC + slot)).andExpect(status().isNotFound());
        assertThat(publishedEvents(slot)).isEmpty();
    }

    @Test
    void historyRestoreCannotCrossSlotsOrInventHistoryAndRequiresWriteToken() throws Exception {
        JsonNode first = save("about.body", "NOTICE", notice("About private"), 0);
        long id = history("about.body").get(0).path("eventId").asLong();
        JsonNode contact = save("contact.body", "NOTICE", notice("Contact private"), 0);
        JsonNode persistedFirst = read(get(ADMIN + "about.body/draft").header("Authorization", admin), 200);
        JsonNode persistedContact = read(get(ADMIN + "contact.body/draft").header("Authorization", admin), 200);
        read(post(ADMIN + "contact.body/restore-draft").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(restoreBody(id, version(contact))), 404);
        read(post(ADMIN + "about.body/restore-draft").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(restoreBody(Long.MAX_VALUE, version(first))), 404);
        ObjectNode invalid = mapper.createObjectNode().put("componentType", "NOTICE");
        invalid.set("payload", notice("Missing expectedVersion"));
        read(put(ADMIN + "about.body/draft").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(invalid.toString()), 400);
        read(post(ADMIN + "about.body/publish").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(versionBody(0)), 400);
        assertThat(read(get(ADMIN + "about.body/draft").header("Authorization", admin), 200)).isEqualTo(persistedFirst);
        assertThat(read(get(ADMIN + "contact.body/draft").header("Authorization", admin), 200)).isEqualTo(persistedContact);
    }

    @Test
    void anonymousPatientAndDoctorCannotReadWritePublishRestoreOrReadDraftHistory() throws Exception {
        String slot = "about.body";
        JsonNode draft = save(slot, "NOTICE", notice("Admin private"), 0);
        JsonNode persistedDraft = read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200);
        long id = history(slot).get(0).path("eventId").asLong();
        for (String authorization : List.of("", bearer("PATIENT"), bearer("DOCTOR"))) {
            int expected = authorization.isEmpty() ? 401 : 403;
            List<MockHttpServletRequestBuilder> requests = List.of(
                get(ADMIN + slot + "/draft"), get(ADMIN + slot + "/history"),
                put(ADMIN + slot + "/draft").contentType(MediaType.APPLICATION_JSON)
                    .content(draftBody("NOTICE", notice("Forbidden overwrite"), version(draft)).toString()),
                post(ADMIN + slot + "/publish").contentType(MediaType.APPLICATION_JSON).content(versionBody(version(draft))),
                post(ADMIN + slot + "/restore-draft").contentType(MediaType.APPLICATION_JSON).content(restoreBody(id, version(draft))));
            for (MockHttpServletRequestBuilder req : requests) {
                if (!authorization.isEmpty()) req.header("Authorization", authorization);
                mockMvc.perform(req).andExpect(status().is(expected));
            }
        }
        assertThat(read(get(ADMIN + slot + "/draft").header("Authorization", admin), 200)).isEqualTo(persistedDraft);
        assertThat(cmsContentChangeRepository.count()).isEqualTo(1);
    }

    private JsonNode save(String slot, String type, JsonNode payload, long expected) throws Exception {
        return read(draftRequest(slot, type, payload, expected), 200);
    }

    private MockHttpServletRequestBuilder draftRequest(String slot, String type, JsonNode payload, long expected) {
        return put(ADMIN + slot + "/draft").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
            .content(draftBody(type, payload, expected).toString());
    }

    private ObjectNode draftBody(String type, JsonNode payload, long expected) {
        ObjectNode body = mapper.createObjectNode().put("componentType", type).put("expectedVersion", expected);
        body.set("payload", payload);
        return body;
    }

    private JsonNode legacy(String slot, String type, JsonNode payload, String publication, long expected) throws Exception {
        ObjectNode body = draftBody(type, payload, expected).put("status", publication);
        return read(put(ADMIN + slot).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
            .content(body.toString()), 200);
    }

    private JsonNode publish(String slot, long expected) throws Exception {
        return read(post(ADMIN + slot + "/publish").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(versionBody(expected)), 200);
    }

    private JsonNode history(String slot) throws Exception {
        return read(get(ADMIN + slot + "/history").header("Authorization", admin), 200);
    }

    private JsonNode publicSnapshot(String slot, boolean bypassCache) throws Exception {
        MockHttpServletRequestBuilder req = get(PUBLIC + slot);
        if (bypassCache) req.param("afterEventId", Long.toString(lastPublicEvent()));
        return read(req, 200);
    }

    private JsonNode read(MockHttpServletRequestBuilder req, int expectedStatus) throws Exception {
        MvcResult result = mockMvc.perform(req).andExpect(status().is(expectedStatus)).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    private String versionBody(long expected) {
        return mapper.createObjectNode().put("expectedVersion", expected).toString();
    }

    private String restoreBody(long changeId, long expected) {
        return mapper.createObjectNode().put("changeId", changeId).put("expectedVersion", expected).toString();
    }

    private long version(JsonNode response) {
        assertThat(response.has("expectedVersion")).isTrue();
        return response.path("expectedVersion").asLong();
    }

    private ObjectNode title(String title) { return mapper.createObjectNode().put("title", title); }
    private ObjectNode notice(String title) { return title(title).put("body", "Synthetic test content"); }

    private ObjectNode layout(String slot) {
        ObjectNode payload = mapper.createObjectNode().put("schemaVersion", 1);
        var order = payload.putArray("sectionOrder");
        manifest.resolve(slot).sections().forEach(section -> order.add(section.id()));
        payload.putObject("fields");
        return payload;
    }

    private ObjectNode layoutTitle(String slot, String title) {
        ObjectNode payload = layout(slot);
        field(payload, "hero.title", "text", title);
        return payload;
    }

    private ObjectNode field(ObjectNode payload, String id, String kind, String value) {
        return ((ObjectNode) payload.get("fields")).putObject(id).put("kind", kind).put("value", value);
    }

    private void assertPrivateChanges(String slot, int count) {
        List<CmsContentChange> privateChanges = cmsContentChangeRepository.findBySlotKeyOrderByIdDesc(slot, PageRequest.of(0, 50))
            .stream().filter(change -> !change.isPublicEvent()).toList();
        assertThat(privateChanges).hasSize(count).allSatisfy(change -> {
            assertThat(change.isPublished()).isFalse();
            assertThat(change.isPublicEvent()).isFalse();
            assertThat(change.getStatus().name()).isEqualTo("DRAFT");
        });
    }

    private List<CmsContentChangedEvent> publishedEvents(String slot) {
        return events.stream(CmsContentChangedEvent.class).filter(event -> event.slotKey().equals(slot)).toList();
    }

    private long lastPublicEvent() {
        return cmsContentChangeRepository.findTopByPublicEventTrueOrderByIdDesc().map(CmsContentChange::getId).orElse(0L);
    }

    private String replay(long cursor) throws Exception {
        MvcResult stream = mockMvc.perform(get("/api/v1/cms/content/events").param("after", Long.toString(cursor)))
            .andExpect(request().asyncStarted()).andReturn();
        try { return stream.getResponse().getContentAsString(); }
        finally { closeStream(stream); }
    }

    private void closeStream(MvcResult stream) {
        if (stream.getRequest().isAsyncStarted()) {
            stream.getRequest().getAsyncContext().complete();
        }
    }

    private void assertPublishedResponse(JsonNode persisted, JsonNode response) {
        for (String key : List.of("slotKey", "componentType", "payload", "status", "version")) {
            assertThat(persisted.path(key)).as(key).isEqualTo(response.path(key));
        }
        // PostgreSQL timestamps retain microseconds; the in-transaction DTO may still contain JVM nanoseconds.
        long nanos = Duration.between(OffsetDateTime.parse(response.path("updatedAt").asText()),
            OffsetDateTime.parse(persisted.path("updatedAt").asText())).abs().toNanos();
        assertThat(nanos).isLessThanOrEqualTo(1_000L);
    }

    private void assertOneSseChange(String stream, String slot, long revision) throws Exception {
        assertThat(stream.split("event:cms-content-changed", -1)).hasSize(2);
        String event = stream.substring(stream.indexOf("event:cms-content-changed"));
        String data = event.lines().filter(line -> line.startsWith("data:")).findFirst().orElseThrow().substring(5);
        JsonNode payload = mapper.readTree(data);
        assertThat(payload.path("slotKey").asText()).isEqualTo(slot);
        assertThat(payload.path("version").asLong()).isEqualTo(revision);
        assertThat(payload.path("published").asBoolean()).isTrue();
    }

    private Branch branch(boolean active) {
        Branch candidate = new Branch();
        candidate.setName("Test branch factual name");
        candidate.setSlug("draft-test-" + UUID.randomUUID());
        candidate.setAddress("Test branch factual address");
        candidate.setActive(active);
        return branchRepository.saveAndFlush(candidate);
    }

    private String bearer(String role) {
        User user = new TransactionTemplate(transactions).execute(transaction -> {
            User candidate = new User();
            candidate.setEmail("cms-draft-" + UUID.randomUUID() + "@healthcare.local");
            candidate.setPasswordHash(passwords.encode("NotUsed!123"));
            candidate.setDisplayName("Synthetic CMS draft test user");
            candidate.setStatus("ACTIVE");
            candidate.setEmailVerified(true);
            candidate.setCreatedAt(OffsetDateTime.now());
            candidate.setUpdatedAt(OffsetDateTime.now());
            candidate.addRole(roles.findByCode(role).orElseThrow());
            return userRepository.saveAndFlush(candidate);
        });
        if (user == null) throw new IllegalStateException("Test user transaction did not commit");
        return "Bearer " + tokens.generateAccessToken(user.getId(), user.getEmail());
    }
}
