package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.exception.CmsPayloadValidationException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CmsPayloadValidatorTest {

    private final CmsPayloadValidator validator = new CmsPayloadValidator();

    private ObjectNode imageCardPayload(String imageUrl) {
        return JsonNodeFactory.instance.objectNode()
            .put("title", "Thẻ ảnh minh họa")
            .put("imageUrl", imageUrl);
    }

    @Test
    void acceptsRootRelativeAndAllowlistedImageUrls() {
        for (String imageUrl : new String[] {
            "/media/x.jpg",
            "/media/branches/branch-hospital.jpg",
            "https://images.unsplash.com/a.jpg",
            "https://images.pexels.com/photos/1.jpeg",
            "https://img.vietqr.io/image.png",
        }) {
            JsonNode sanitized = validator.validateAndSanitize(
                CmsComponentType.IMAGE_CARD, imageCardPayload(imageUrl));
            assertThat(sanitized.get("imageUrl").asText()).isEqualTo(imageUrl);
        }
    }

    @Test
    void acceptsAllowlistedHeroImageUrl() {
        ObjectNode payload = JsonNodeFactory.instance.objectNode()
            .put("title", "Trang chủ")
            .put("imageUrl", "https://images.pexels.com/photos/2.jpeg");
        JsonNode sanitized = validator.validateAndSanitize(CmsComponentType.HERO, payload);
        assertThat(sanitized.get("imageUrl").asText())
            .isEqualTo("https://images.pexels.com/photos/2.jpeg");
    }

    @Test
    void rejectsImageUrlsOutsideTheCspAllowlist() {
        for (String imageUrl : new String[] {
            "https://evil.example/a.jpg",
            "https://images.unsplash.com.evil.example/a.jpg",
            "http://images.unsplash.com/a.jpg",
            "//evil.example/a.jpg",
            "javascript:alert(1)",
            "data:image/png;base64,AAAA",
            "https://user:secret@images.unsplash.com/a.jpg",
        }) {
            assertThatThrownBy(() -> validator.validateAndSanitize(
                    CmsComponentType.IMAGE_CARD, imageCardPayload(imageUrl)))
                .isInstanceOf(CmsPayloadValidationException.class);
        }
    }

    @Test
    void keepsTheBroaderHttpsRuleForLinkFields() {
        ObjectNode banner = JsonNodeFactory.instance.objectNode()
            .put("title", "Đặt lịch")
            .put("body", "Nội dung CTA")
            .put("ctaLabel", "Đặt ngay")
            .put("ctaHref", "https://external-booking.example/dat-lich");
        JsonNode sanitized = validator.validateAndSanitize(CmsComponentType.CTA_BANNER, banner);
        assertThat(sanitized.get("ctaHref").asText())
            .isEqualTo("https://external-booking.example/dat-lich");

        ObjectNode card = imageCardPayload("/media/x.jpg")
            .put("href", "https://any-host.example/chi-tiet");
        JsonNode sanitizedCard = validator.validateAndSanitize(CmsComponentType.IMAGE_CARD, card);
        assertThat(sanitizedCard.get("href").asText())
            .isEqualTo("https://any-host.example/chi-tiet");
    }

    @Test
    void acceptsTelUriHotlineCtas() {
        // Production content carries real hotline CTAs (branches.sidebar →
        // tel:115, contact.sidebar → tel:19001234); the write boundary must
        // accept the strict tel: shape the frontend read path already renders.
        for (String ctaHref : new String[] { "tel:115", "tel:19001234", "tel:+842839781234", "tel:1900 1234" }) {
            ObjectNode banner = JsonNodeFactory.instance.objectNode()
                .put("title", "Tổng đài hỗ trợ")
                .put("body", "Gọi ngay khi cần cấp cứu.")
                .put("ctaLabel", "Gọi ngay")
                .put("ctaHref", ctaHref);
            JsonNode sanitized = validator.validateAndSanitize(CmsComponentType.CTA_BANNER, banner);
            assertThat(sanitized.get("ctaHref").asText()).isEqualTo(ctaHref);
        }
    }

    @Test
    void rejectsMalformedTelUriLinks() {
        for (String ctaHref : new String[] { "tel:", "tel:abc", "tel:javascript:alert(1)", "tel:115;drop" }) {
            ObjectNode banner = JsonNodeFactory.instance.objectNode()
                .put("title", "Tổng đài hỗ trợ")
                .put("body", "Nội dung CTA")
                .put("ctaLabel", "Gọi ngay")
                .put("ctaHref", ctaHref);
            assertThatThrownBy(() -> validator.validateAndSanitize(CmsComponentType.CTA_BANNER, banner))
                .isInstanceOf(CmsPayloadValidationException.class);
        }
    }
}
