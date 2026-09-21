package com.healthcare.hospital.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Derives the article {@code sections} jsonb from a markdown body, matching the
 * V92 seed derivation byte-for-byte in semantics: the trimmed body splits on
 * the {@code \n## } delimiter; the preamble becomes a section titled
 * {@code Tổng quan}; every later chunk's first line is its heading and the
 * remainder its trimmed body (empty when the chunk is a bare heading).
 *
 * <p>Body is the single source of truth: {@link AdminArticleService} calls this
 * on every create/update so a TinyMCE edit can never leave the public
 * disease-guide pages rendering a stale {@code sections} array.
 */
public final class ArticleSectionsDeriver {

    private static final String PREAMBLE_HEADING = "Tổng quan";
    private static final String SECTION_DELIMITER = "\n## ";

    private ArticleSectionsDeriver() {
    }

    public static ArrayNode derive(String body) {
        ArrayNode sections = JsonNodeFactory.instance.arrayNode();
        String trimmed = body == null ? "" : body.trim();
        String[] chunks = trimmed.split(java.util.regex.Pattern.quote(SECTION_DELIMITER), -1);
        for (int ord = 0; ord < chunks.length; ord++) {
            String chunk = chunks[ord].trim();
            ObjectNode section = sections.addObject();
            if (ord == 0) {
                section.put("heading", PREAMBLE_HEADING);
                section.put("body", chunk);
                continue;
            }
            int newline = chunk.indexOf('\n');
            if (newline < 0) {
                section.put("heading", chunk);
                section.put("body", "");
            } else {
                section.put("heading", chunk.substring(0, newline).trim());
                section.put("body", chunk.substring(newline + 1).trim());
            }
        }
        return sections;
    }

    /** Convenience for mappers that need the read-only view. */
    public static JsonNode deriveAsJson(String body) {
        return derive(body);
    }
}
