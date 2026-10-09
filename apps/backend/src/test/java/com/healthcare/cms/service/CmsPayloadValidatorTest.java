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
    void acceptsTelephoneActionsWithoutAllowingTelephoneImages() {
        for (String href : new String[] { "tel:115", "tel:19001234", "tel:+842812345678" }) {
            ObjectNode banner = JsonNodeFactory.instance.objectNode()
                .put("title", "Liên hệ").put("body", "Gọi để được hỗ trợ")
                .put("ctaLabel", "Gọi ngay").put("ctaHref", href);
            assertThat(validator.validateAndSanitize(CmsComponentType.CTA_BANNER, banner)
                .get("ctaHref").asText()).isEqualTo(href);
            assertThatThrownBy(() -> validator.validateAndSanitize(
                CmsComponentType.IMAGE_CARD, imageCardPayload(href)))
                .isInstanceOf(CmsPayloadValidationException.class);
        }
    }

    @Test
    void rejectsUnsafeTelephoneSyntax() {
        for (String href : new String[] {
            "tel:123", "tel:+1234567890123456", "tel:123456;ext=1",
            "tel:%2b123456", "tel:12 3456", "tel:123456\n", "tel:123456\r",
            "tel:112", "tel:+115", "tel:115 ", " tel:115", "tel:115\n",
            "tel:115\t", "tel:%31%31%35", "tel:115;ext=1",
        }) {
            ObjectNode banner = JsonNodeFactory.instance.objectNode()
                .put("title", "Liên hệ").put("body", "Gọi để được hỗ trợ")
                .put("ctaLabel", "Gọi ngay").put("ctaHref", href);
            assertThatThrownBy(() -> validator.validateAndSanitize(CmsComponentType.CTA_BANNER, banner))
                .isInstanceOf(CmsPayloadValidationException.class);
        }
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
}
