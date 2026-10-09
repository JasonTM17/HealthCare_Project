package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.cms.exception.CmsPayloadValidationException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CmsPageLayoutValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final CmsPageLayoutManifest manifest = new CmsPageLayoutManifest(mapper);
    private final CmsPageLayoutValidator validator = new CmsPageLayoutValidator(manifest);

    private ObjectNode payload(String slot) {
        ObjectNode result = mapper.createObjectNode().put("schemaVersion", 1);
        ArrayNode order = result.putArray("sectionOrder");
        manifest.resolve(slot).sections().forEach(section -> order.add(section.id()));
        result.putObject("fields");
        return result;
    }

    private ObjectNode field(ObjectNode payload, String id, String kind, String value) {
        return ((ObjectNode) payload.get("fields")).putObject(id).put("kind", kind).put("value", value);
    }

    private void rejects(String slot, ObjectNode payload) {
        assertThatThrownBy(() -> validator.validateAndSanitize(slot, payload))
            .isInstanceOf(CmsPayloadValidationException.class);
    }

    @Test
    void resolvesEveryCanonicalAndSupportedUuidDetailWithoutInventingPrivateOrAliasSlots() {
        for (String family : List.of("homepage", "about", "branches", "specialties", "doctors", "services", "packages",
            "articles", "careers", "search", "dat-lich", "contact", "faq", "huong-dan", "tra-cuu", "benh-pho-bien",
            "gop-y", "chinh-sach-bao-mat")) {
            assertThat(validator.validateAndSanitize(family + ".layout", payload(family + ".layout"))).isNotNull();
        }
        for (String family : List.of("branches", "specialties", "doctors", "services", "packages", "articles", "benh-pho-bien")) {
            String slot = family + ".detail-00000000-0000-4000-8000-000000000001.layout";
            assertThat(manifest.resolve(slot).entityId()).isNotNull();
            assertThat(validator.validateAndSanitize(slot, payload(slot))).isNotNull();
        }
        for (String slot : List.of("admin.layout", "bac-si.layout", "homepage.hero", "doctors.detail-invented.layout",
            "careers.detail-00000000-0000-4000-8000-000000000001.layout", "about.layout.extra")) {
            assertThatThrownBy(() -> manifest.resolve(slot)).isInstanceOf(CmsPayloadValidationException.class);
        }
    }

    @Test
    void sparseOverridesPreserveInputAndClearBackToNativeDefaults() {
        ObjectNode payload = payload("homepage.layout");
        field(payload, "hero.title", "text", "Đồng hành cùng sức khỏe");
        var result = validator.validateAndSanitize("homepage.layout", payload);
        assertThat(result).isEqualTo(payload).isNotSameAs(payload);
        ((ObjectNode) payload.get("fields")).remove("hero.title");
        assertThat(validator.validateAndSanitize("homepage.layout", payload).path("fields").isEmpty()).isTrue();
    }

    @Test
    void refusesUnknownKindsFieldsVersionsAndObjectKeys() {
        ObjectNode payload = payload("homepage.layout");
        payload.put("schemaVersion", 2); rejects("homepage.layout", payload);
        payload.put("schemaVersion", 1).put("html", "anything"); rejects("homepage.layout", payload);
        payload.remove("html"); field(payload, "hero.title", "rich", "Changed kind"); rejects("homepage.layout", payload);
        payload.putObject("fields").put("__proto__", "injection"); rejects("homepage.layout", payload);
        payload.putObject("fields"); field(payload, "hero.title", "text", "Title").put("onclick", "script"); rejects("homepage.layout", payload);
        String doctor = "doctors.detail-00000000-0000-4000-8000-000000000001.layout";
        ObjectNode facts = payload(doctor); field(facts, "profile.fullName", "text", "Fabricated fact"); rejects(doctor, facts);
    }

    @Test
    void permitsWithinGroupMovesButNotDuplicatesAnchorsOrCrossingInteractiveBoundaries() {
        ObjectNode home = payload("homepage.layout");
        ArrayNode order = (ArrayNode) home.get("sectionOrder");
        order.set(4, mapper.getNodeFactory().textNode("packages"));
        order.set(5, mapper.getNodeFactory().textNode("care"));
        assertThat(validator.validateAndSanitize("homepage.layout", home)).isNotNull();
        order.set(0, mapper.getNodeFactory().textNode("care")); rejects("homepage.layout", home);
        ObjectNode specialties = payload("specialties.layout");
        ArrayNode mixed = (ArrayNode) specialties.get("sectionOrder");
        mixed.set(1, mapper.getNodeFactory().textNode("closing"));
        mixed.set(4, mapper.getNodeFactory().textNode("overview"));
        rejects("specialties.layout", specialties);
        ObjectNode missing = payload("homepage.layout"); ((ArrayNode) missing.get("sectionOrder")).remove(1);
        rejects("homepage.layout", missing);
    }

    @Test
    void acceptsSafeMarkdownAndImagesAndRejectsRawMarkupSchemesAndImageHostBypasses() {
        ObjectNode payload = payload("homepage.layout");
        field(payload, "hero.body", "rich", "**Chăm sóc** <u>chủ động</u>\n> Chuẩn bị trước khi khám\n[Gọi](tel:115)\n![Ảnh](/media/a.jpg)")
            .put("format", "markdown");
        ((ObjectNode) payload.get("fields")).putObject("hero.image").put("kind", "image")
            .put("src", "https://images.unsplash.com/photo.jpg").put("alt", "");
        assertThat(validator.validateAndSanitize("homepage.layout", payload)).isNotNull();
        for (String value : List.of("<script>alert(1)</script>", "<u onclick='x'>bad</u>", "[bad](javascript:alert(1))",
            "[bad](//evil.example)", "[bad](tel:112)", "![bad](https://evil.example/a.jpg)",
            "![bad](tel:115)", "[bad](/\\evil.example)", "[bad](https://user:pass@example.com)", "<u>unclosed")) {
            field(payload, "hero.body", "rich", value).put("format", "markdown"); rejects("homepage.layout", payload);
        }
        ((ObjectNode) payload.get("fields")).remove("hero.body");
        for (String src : List.of("https://images.unsplash.com.evil.example/a.jpg", "https://images.unsplash.com:444/a.jpg",
            "data:image/png;base64,AAAA", "/media/a\nb.jpg", "tel:115")) {
            ((ObjectNode) payload.path("fields").path("hero.image")).put("src", src); rejects("homepage.layout", payload);
        }
    }

    @Test
    void enforcesUtf8ByteSizeAndPerFieldLimitsAndControlCharacters() {
        ObjectNode payload = payload("homepage.layout");
        field(payload, "hero.title", "text", "x".repeat(4_001)); rejects("homepage.layout", payload);
        field(payload, "hero.title", "text", "unsafe\u0000text"); rejects("homepage.layout", payload);
        field(payload, "hero.title", "text", "<b>raw</b>"); rejects("homepage.layout", payload);
        payload.putObject("fields");
        for (String id : List.of("hero.title", "hero.eyebrow", "assurance.doctorTitle", "care.title")) {
            field(payload, id, "text", "漢".repeat(3_000));
        }
        rejects("homepage.layout", payload);
    }
}
