package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.exception.CmsPayloadValidationException;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class CmsPayloadValidator {

    private static final Pattern FIELD_NAME = Pattern.compile("[a-z][A-Za-z0-9]{0,39}");
    private static final Pattern UNSAFE_TEXT = Pattern.compile("(?i)(<|>|javascript\\s*:|data\\s*:)");
    // Hotline CTAs ("Gọi 115") are legitimate content: strict RFC 3966 shape.
    private static final Pattern TEL_URI = Pattern.compile("(?i)^tel:\\+?[0-9][0-9().\\-\\s]{1,24}$");
    private static final int MAX_FIELDS = 12;
    private static final int MAX_TEXT_LENGTH = 4_000;
    private static final int MAX_PAYLOAD_BYTES = 32_768;
    // Matches the frontend CSP img-src hosts (images.unsplash.com, images.pexels.com, img.vietqr.io) in next.config.ts.
    private static final Set<String> ALLOWED_IMAGE_HOSTS = Set.of(
        "images.unsplash.com", "images.pexels.com", "img.vietqr.io");

    private final Map<CmsComponentType, PayloadSchema> schemas = new EnumMap<>(CmsComponentType.class);

    public CmsPayloadValidator() {
        schemas.put(CmsComponentType.HERO, new PayloadSchema(
            Set.of("eyebrow", "title", "body", "ctaLabel", "ctaHref", "imageUrl"),
            Set.of("title")
        ));
        schemas.put(CmsComponentType.RICH_TEXT, new PayloadSchema(
            Set.of("title", "body"),
            Set.of("title", "body")
        ));
        schemas.put(CmsComponentType.CTA_BANNER, new PayloadSchema(
            Set.of("title", "body", "ctaLabel", "ctaHref"),
            Set.of("title", "body", "ctaLabel", "ctaHref")
        ));
        schemas.put(CmsComponentType.NOTICE, new PayloadSchema(
            Set.of("title", "body"),
            Set.of("title", "body")
        ));
        schemas.put(CmsComponentType.IMAGE_CARD, new PayloadSchema(
            Set.of("title", "body", "imageUrl", "href"),
            Set.of("title", "imageUrl")
        ));
    }

    public JsonNode validateAndSanitize(CmsComponentType componentType, JsonNode payload) {
        if (componentType == null) {
            throw new CmsPayloadValidationException("componentType is required");
        }
        if (payload == null || !payload.isObject()) {
            throw new CmsPayloadValidationException("payload must be a JSON object");
        }

        PayloadSchema schema = schemas.get(componentType);
        if (payload.size() > MAX_FIELDS) {
            throw new CmsPayloadValidationException("payload has too many fields");
        }

        ObjectNode sanitized = JsonNodeFactory.instance.objectNode();
        payload.fields().forEachRemaining(entry -> {
            String fieldName = entry.getKey();
            JsonNode value = entry.getValue();

            if (!FIELD_NAME.matcher(fieldName).matches() || !schema.allowedFields().contains(fieldName)) {
                throw new CmsPayloadValidationException("payload field is not allowed: " + fieldName);
            }
            if (!value.isTextual()) {
                throw new CmsPayloadValidationException("payload field must be a string: " + fieldName);
            }

            String text = value.textValue().trim();
            if (text.isEmpty() || text.length() > MAX_TEXT_LENGTH) {
                throw new CmsPayloadValidationException("payload field has an invalid length: " + fieldName);
            }
            if (containsControlCharacter(text) || UNSAFE_TEXT.matcher(text).find()) {
                throw new CmsPayloadValidationException("payload field contains unsafe markup or scheme: " + fieldName);
            }
            if (isLinkField(fieldName) && !isSafeLink(text)) {
                throw new CmsPayloadValidationException("payload link must be a relative path or HTTPS URL: " + fieldName);
            }
            if (isImageField(fieldName) && !isSafeImageSource(text)) {
                throw new CmsPayloadValidationException("payload image must be a root-relative path or an HTTPS URL on an allowed image host: " + fieldName);
            }
            sanitized.put(fieldName, text);
        });

        for (String requiredField : schema.requiredFields()) {
            if (!sanitized.hasNonNull(requiredField)) {
                throw new CmsPayloadValidationException("payload field is required: " + requiredField);
            }
        }
        if (sanitized.toString().getBytes(StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
            throw new CmsPayloadValidationException("payload is too large");
        }
        return sanitized;
    }

    private boolean isLinkField(String fieldName) {
        return fieldName.equals("ctaHref") || fieldName.equals("href") || fieldName.equals("imageUrl");
    }

    private boolean isSafeLink(String value) {
        if (value.startsWith("/")) {
            return !value.startsWith("//") && !value.contains("\\");
        }
        if (TEL_URI.matcher(value).matches()) {
            return true;
        }
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && uri.getUserInfo() == null;
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    private boolean isImageField(String fieldName) {
        return fieldName.equals("imageUrl") || fieldName.equals("src");
    }

    /**
     * Image fields are stricter than generic links: the public CSP img-src
     * only allows same-origin and a few HTTPS image hosts, so an external
     * host that passes isSafeLink would still render as a broken image.
     */
    private boolean isSafeImageSource(String value) {
        if (value.startsWith("/")) {
            return !value.startsWith("//") && !value.contains("\\");
        }
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && uri.getUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && ALLOWED_IMAGE_HOSTS.contains(uri.getHost().toLowerCase(Locale.ROOT));
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    private boolean containsControlCharacter(String value) {
        return value.chars().anyMatch(character -> Character.isISOControl(character) && !Character.isWhitespace(character));
    }

    private record PayloadSchema(Set<String> allowedFields, Set<String> requiredFields) {
    }
}
