package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.exception.CmsPayloadValidationException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public final class CmsPageLayoutValidator {
    private static final int MAX_BYTES = 32_768;
    private static final Pattern CONTROLS = Pattern.compile("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]");
    private static final Pattern MARKDOWN_LINK = Pattern.compile("(!?)\\[([^\\]]*)\\]\\(([^)]+)\\)");
    private static final Pattern UNDERLINE = Pattern.compile("<u>[^<>]*</u>");
    private final CmsPageLayoutManifest manifest;

    public CmsPageLayoutValidator(CmsPageLayoutManifest manifest) {
        this.manifest = manifest;
    }

    public JsonNode validateAndSanitize(String slotKey, JsonNode payload) {
        CmsPageLayoutManifest.Layout layout = manifest.resolve(slotKey);
        exactKeys(payload, Set.of("schemaVersion", "sectionOrder", "fields"));
        require(payload.path("schemaVersion").isInt() && payload.path("schemaVersion").intValue() == 1,
            "unsupported layout schema version");
        require(payload.toString().getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES, "layout payload is too large");
        validateOrder(layout.sections(), payload.path("sectionOrder"));
        JsonNode fields = payload.path("fields");
        require(fields.isObject(), "layout fields must be an object");
        Map<String, CmsPageLayoutManifest.Field> allowed = layout.fields();
        fields.fields().forEachRemaining(entry -> {
            CmsPageLayoutManifest.Field field = allowed.get(entry.getKey());
            require(field != null, "unknown layout field");
            JsonNode value = entry.getValue();
            require(value.isObject() && value.path("kind").isTextual()
                && field.kind().equals(value.path("kind").textValue()), "layout field kind does not match");
            switch (field.kind()) {
                case "text" -> {
                    exactKeys(value, Set.of("kind", "value"));
                    plainText(value.path("value"), 4_000, false);
                }
                case "image" -> {
                    exactKeys(value, Set.of("kind", "src", "alt"));
                    String src = plainText(value.path("src"), 2_048, false);
                    require(safeUrl(src, true), "unsafe layout image source");
                    plainText(value.path("alt"), 500, true);
                }
                case "rich" -> {
                    exactKeys(value, Set.of("kind", "format", "value"));
                    require(value.path("format").isTextual() && "markdown".equals(value.path("format").textValue()),
                        "unsupported rich content format");
                    validateMarkdown(value.path("value"));
                }
                default -> throw new CmsPayloadValidationException("unsupported layout field kind");
            }
        });
        // Missing overrides deliberately fall back to native public values. Never mutate the caller's tree.
        return payload.deepCopy();
    }

    private static void validateOrder(List<CmsPageLayoutManifest.Section> sections, JsonNode order) {
        require(order.isArray() && order.size() == sections.size(), "layout order must include every section once");
        Map<String, Integer> groups = new HashMap<>();
        int group = 0;
        for (var section : sections) {
            groups.put(section.id(), group);
            if (!section.reorderable()) group++;
        }
        Set<String> seen = new HashSet<>();
        group = 0;
        for (int index = 0; index < order.size(); index++) {
            JsonNode id = order.get(index);
            require(id.isTextual() && seen.add(id.textValue()) && groups.containsKey(id.textValue()),
                "unknown or duplicate layout section");
            var nativeSection = sections.get(index);
            if (!nativeSection.reorderable()) {
                require(nativeSection.id().equals(id.textValue()), "fixed layout section cannot move");
                group++;
            } else {
                require(groups.get(id.textValue()) == group, "layout section cannot cross a fixed boundary");
            }
        }
    }

    private static void validateMarkdown(JsonNode node) {
        String value = boundedText(node, 4_000, false);
        // This exact literal is rendered as a React <u> node by the existing Markdown renderer.
        String withoutUnderline = UNDERLINE.matcher(value).replaceAll("").replaceAll("(?m)^>+ ?", "");
        require(!withoutUnderline.contains("<") && !withoutUnderline.contains(">"), "raw HTML is not allowed in layout content");
        Matcher links = MARKDOWN_LINK.matcher(value);
        while (links.find()) {
            require(safeUrl(links.group(3), "!".equals(links.group(1))), "unsafe layout Markdown URL");
        }
    }

    private static String plainText(JsonNode node, int limit, boolean allowEmpty) {
        String value = boundedText(node, limit, allowEmpty);
        require(!value.contains("<") && !value.contains(">"), "raw markup is not allowed in layout text");
        return value;
    }

    private static String boundedText(JsonNode node, int limit, boolean allowEmpty) {
        require(node.isTextual(), "layout value must be a string");
        String value = node.textValue();
        require(value.length() <= limit && (allowEmpty || !value.isBlank()) && !CONTROLS.matcher(value).find(),
            "layout text has invalid length or control characters");
        return value;
    }

    private static boolean safeUrl(String value, boolean image) {
        if (!value.equals(value.trim()) || value.chars().anyMatch(Character::isWhitespace)
            || CONTROLS.matcher(value).find() || value.contains("\\")) return false;
        return image ? CmsPayloadValidator.isSafeImageSource(value) : CmsPayloadValidator.isSafeActionLink(value);
    }

    private static void exactKeys(JsonNode node, Set<String> keys) {
        require(node != null && node.isObject() && node.size() == keys.size(), "layout object has missing or unknown fields");
        node.fieldNames().forEachRemaining(key -> require(keys.contains(key), "unknown layout object field"));
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new CmsPayloadValidationException(message);
    }
}
