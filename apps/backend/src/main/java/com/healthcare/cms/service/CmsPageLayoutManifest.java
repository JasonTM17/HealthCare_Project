package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.cms.exception.CmsPayloadValidationException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Derived from the native FE declarations by scripts/sync-cms-page-manifest.mjs. */
@Component
public final class CmsPageLayoutManifest {
    private static final Pattern SLOT = Pattern.compile(
        "([a-z][a-z-]{0,39})(?:\\.detail-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?\\.layout");
    private static final Pattern ID = Pattern.compile("[a-z][A-Za-z0-9-]{0,39}");
    private static final Pattern FIELD_PATH = Pattern.compile("[a-z][A-Za-z0-9-]{0,39}(?:\\.[a-z][A-Za-z0-9-]{0,39}){0,3}");
    private final Map<String, Page> pages;

    public CmsPageLayoutManifest(ObjectMapper mapper) {
        try (InputStream source = CmsPageLayoutManifest.class.getResourceAsStream("/cms-page-manifest.json")) {
            if (source == null) throw new IllegalStateException("CMS page manifest resource is missing");
            JsonNode root = mapper.readTree(source);
            if (!root.path("schemaVersion").isInt() || root.path("schemaVersion").intValue() != 1
                || !root.path("pages").isArray() || root.path("pages").isEmpty()) {
                throw new IllegalStateException("Invalid CMS page manifest schema");
            }
            Map<String, Page> entries = new LinkedHashMap<>();
            for (JsonNode node : root.path("pages")) {
                String family = requiredText(node, "family");
                if (!ID.matcher(family).matches() || !node.path("supportsDetail").isBoolean()) {
                    throw new IllegalStateException("Invalid CMS page family");
                }
                boolean supportsDetail = node.path("supportsDetail").booleanValue();
                Page page = new Page(family, supportsDetail, sections(node.path("sections")),
                    sections(node.path("detailSections")));
                if (page.sections().isEmpty() || supportsDetail != !page.detailSections().isEmpty()
                    || entries.putIfAbsent(family, page) != null) {
                    throw new IllegalStateException("Invalid or duplicate CMS page definition");
                }
            }
            pages = Map.copyOf(entries);
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot load CMS page manifest", ex);
        }
    }

    public Layout resolve(String slotKey) {
        if (slotKey == null) throw new CmsPayloadValidationException("layout slot is required");
        Matcher match = SLOT.matcher(slotKey);
        if (!match.matches()) throw new CmsPayloadValidationException("invalid layout slot");
        Page page = pages.get(match.group(1));
        boolean detail = match.group(2) != null;
        if (page == null || detail && !page.supportsDetail()) {
            throw new CmsPayloadValidationException("unsupported layout page");
        }
        return new Layout(page.family(), detail ? UUID.fromString(match.group(2)) : null,
            detail ? page.detailSections() : page.sections());
    }

    private static List<Section> sections(JsonNode nodes) {
        if (!nodes.isArray() || nodes.size() > 64) throw new IllegalStateException("Invalid CMS sections");
        Map<String, Section> sections = new LinkedHashMap<>();
        Map<String, String> fieldIds = new LinkedHashMap<>();
        for (JsonNode node : nodes) {
            String id = requiredText(node, "id");
            if (!ID.matcher(id).matches() || !node.path("reorderable").isBoolean() || !node.path("fields").isArray()) {
                throw new IllegalStateException("Invalid CMS section");
            }
            List<Field> fields = new ArrayList<>();
            for (JsonNode field : node.path("fields")) {
                String fieldId = requiredText(field, "id");
                String kind = requiredText(field, "kind");
                if (fieldId.length() > 120 || !fieldId.startsWith(id + ".") || !FIELD_PATH.matcher(fieldId.substring(id.length() + 1)).matches()
                    || !List.of("text", "rich", "image").contains(kind) || fieldIds.putIfAbsent(fieldId, kind) != null) {
                    throw new IllegalStateException("Invalid CMS field");
                }
                fields.add(new Field(fieldId, kind));
            }
            if (sections.putIfAbsent(id, new Section(id, node.path("reorderable").booleanValue(), List.copyOf(fields))) != null) {
                throw new IllegalStateException("Duplicate CMS section");
            }
        }
        if (fieldIds.size() > 128) throw new IllegalStateException("Too many CMS fields");
        return List.copyOf(sections.values());
    }

    private static String requiredText(JsonNode node, String key) {
        if (!node.path(key).isTextual() || node.path(key).textValue().isBlank()) {
            throw new IllegalStateException("Missing CMS manifest field");
        }
        return node.path(key).textValue();
    }

    private record Page(String family, boolean supportsDetail, List<Section> sections, List<Section> detailSections) {}
    public record Field(String id, String kind) {}
    public record Section(String id, boolean reorderable, List<Field> fields) {}
    public record Layout(String family, UUID entityId, List<Section> sections) {
        public Map<String, Field> fields() {
            Map<String, Field> result = new LinkedHashMap<>();
            sections.forEach(section -> section.fields().forEach(field -> result.put(field.id(), field)));
            return Map.copyOf(result);
        }
    }
}
