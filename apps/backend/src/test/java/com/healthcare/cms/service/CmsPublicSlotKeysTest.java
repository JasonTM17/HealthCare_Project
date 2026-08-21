package com.healthcare.cms.service;

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
}
