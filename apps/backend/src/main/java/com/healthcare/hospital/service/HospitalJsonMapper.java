package com.healthcare.hospital.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.hospital.dto.ArticleSectionResponse;

import java.util.ArrayList;
import java.util.List;

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
