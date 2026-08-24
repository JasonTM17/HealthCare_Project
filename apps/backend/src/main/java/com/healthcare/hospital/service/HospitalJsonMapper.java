package com.healthcare.hospital.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.healthcare.hospital.dto.ArticleSectionRequest;
import com.healthcare.hospital.dto.ArticleSectionResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class HospitalJsonMapper {

    private HospitalJsonMapper() {
    }

    public static List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        node.elements().forEachRemaining(value -> {
            if (value.isTextual() && !value.asText().isBlank()) {
                values.add(value.asText());
            }
        });
        return List.copyOf(values);
    }

    /** Convert bounded admin list fields to the canonical JSONB array shape. */
    public static ArrayNode stringArray(List<String> values) {
        ArrayNode array = JsonNodeFactory.instance.arrayNode();
        if (values != null) {
            values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::strip)
                .forEach(array::add);
        }
        return array;
    }

    /** Convert controlled metadata key/value input to a JSON object. */
    public static com.fasterxml.jackson.databind.node.ObjectNode stringObject(Map<String, String> values) {
        var object = JsonNodeFactory.instance.objectNode();
        if (values != null) {
            values.forEach((key, value) -> {
                if (key != null && !key.isBlank() && value != null && !value.isBlank()) {
                    object.put(key.strip(), value.strip());
                }
            });
        }
        return object;
    }

    /** Convert article sections without accepting arbitrary executable JSON. */
    public static ArrayNode articleSections(List<ArticleSectionRequest> values) {
        ArrayNode array = JsonNodeFactory.instance.arrayNode();
        if (values != null) {
            values.stream()
                .filter(value -> value != null
                    && ((value.heading() != null && !value.heading().isBlank())
                        || (value.body() != null && !value.body().isBlank())))
                .forEach(value -> array.add(JsonNodeFactory.instance.objectNode()
                    .put("heading", value.heading() == null ? "" : value.heading().strip())
                    .put("body", value.body() == null ? "" : value.body().strip())));
        }
        return array;
    }

    public static List<ArticleSectionResponse> articleSections(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<ArticleSectionResponse> sections = new ArrayList<>();
        node.elements().forEachRemaining(value -> {
            String heading = value.path("heading").asText("").trim();
            String body = value.path("body").asText("").trim();
            if (!heading.isBlank() || !body.isBlank()) {
                sections.add(new ArticleSectionResponse(heading, body));
            }
        });
        return List.copyOf(sections);
    }
}
