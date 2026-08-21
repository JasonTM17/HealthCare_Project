package com.healthcare.cms.service;

import java.util.Set;
import java.util.regex.Pattern;

final class CmsPublicSlotKeys {

    private static final Pattern SLOT_KEY = Pattern.compile("[a-z0-9]+(?:[._-][a-z0-9]+)*");
    private static final int MAX_SLOT_KEY_LENGTH = 120;
    private static final Set<String> CMS_PUBLIC_ROUTE_KEYS = Set.of(
        "homepage",
        "about",
        "branches",
        "specialties",
        "doctors",
        "services",
        "packages",
        "articles",
        "careers",
        "search",
        "dat-lich",
        "contact",
        "faq",
        "huong-dan",
        "tra-cuu"
    );
    private static final Set<String> CMS_SLOT_KEYS = Set.of("hero", "body", "sidebar", "footer");

    private CmsPublicSlotKeys() {
    }

    static boolean isAllowed(String slotKey) {
        if (slotKey == null || slotKey.length() > MAX_SLOT_KEY_LENGTH || !SLOT_KEY.matcher(slotKey).matches()) {
            return false;
        }
        String[] parts = slotKey.split("\\.", -1);
        return parts.length == 2
            && CMS_PUBLIC_ROUTE_KEYS.contains(parts[0])
            && CMS_SLOT_KEYS.contains(parts[1]);
    }
}
