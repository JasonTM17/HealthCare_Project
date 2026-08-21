package com.healthcare.cms.service;

import com.healthcare.cms.entity.CmsComponentType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CmsPublicSlotKeysTest {

    @Test
    void allowsOnlyPublicRouteInventorySlots() {
        assertThat(CmsPublicSlotKeys.isAllowed("homepage.hero")).isTrue();
        assertThat(CmsPublicSlotKeys.isAllowed("dat-lich.footer")).isTrue();
        assertThat(CmsPublicSlotKeys.isAllowed("tra-cuu.sidebar")).isTrue();

        assertThat(CmsPublicSlotKeys.isAllowed("patient.dashboard.hero")).isFalse();
        assertThat(CmsPublicSlotKeys.isAllowed("admin.hero")).isFalse();
        assertThat(CmsPublicSlotKeys.isAllowed("homepage.banner")).isFalse();
        assertThat(CmsPublicSlotKeys.isAllowed("homepage.hero.extra")).isFalse();
        assertThat(CmsPublicSlotKeys.isAllowed("HomePage.hero")).isFalse();
        assertThat(CmsPublicSlotKeys.isAllowed(null)).isFalse();
    }

    @Test
    void bindsComponentsToPublicSlotShapes() {
        assertThat(CmsPublicSlotKeys.allowedComponentTypes("homepage.hero"))
            .containsExactly(CmsComponentType.HERO);
        assertThat(CmsPublicSlotKeys.allowedComponentTypes("careers.body"))
            .containsExactlyInAnyOrder(
                CmsComponentType.RICH_TEXT,
                CmsComponentType.CTA_BANNER,
                CmsComponentType.NOTICE
            );
        assertThat(CmsPublicSlotKeys.allowedComponentTypes("homepage.sidebar"))
            .containsExactlyInAnyOrder(
                CmsComponentType.RICH_TEXT,
                CmsComponentType.CTA_BANNER,
                CmsComponentType.NOTICE,
                CmsComponentType.IMAGE_CARD
            );

        assertThat(CmsPublicSlotKeys.isComponentAllowed("careers.hero", CmsComponentType.RICH_TEXT)).isFalse();
        assertThat(CmsPublicSlotKeys.isComponentAllowed("careers.hero", CmsComponentType.HERO)).isTrue();
        assertThat(CmsPublicSlotKeys.isComponentAllowed("careers.body", CmsComponentType.IMAGE_CARD)).isFalse();
        assertThat(CmsPublicSlotKeys.allowedComponentTypes("patient.dashboard.hero")).isEmpty();
    }
}
