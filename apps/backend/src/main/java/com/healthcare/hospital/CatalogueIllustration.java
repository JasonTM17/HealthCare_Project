package com.healthcare.hospital;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Immutable membership remains valid when a sample's editable name or slug changes. */
public final class CatalogueIllustration {
    public static final String BOOKING_NOTICE = "Dữ liệu minh họa không nhận đặt lịch khám. Vui lòng chọn thông tin thực tế.";
    private static final Set<UUID> IDS = loadIds();

    private CatalogueIllustration() { }

    private static Set<UUID> loadIds() {
        try (InputStream stream = CatalogueIllustration.class.getResourceAsStream("/catalogue-illustration.json")) {
            if (stream == null) throw new IllegalStateException("Catalogue illustration identity unavailable");
            var identity = new ObjectMapper().readTree(stream);
            if (!"3343e1e9b44333cf6d7a8c936d1abe5735f4dd48c68484417abff67585beb61e".equals(identity.path("manifestSha256").asText())) {
                throw new IllegalStateException("Catalogue illustration identity mismatch");
            }
            Set<UUID> ids = new HashSet<>();
            for (var id : identity.path("ids")) {
                if (!ids.add(UUID.fromString(id.asText()))) throw new IllegalStateException("Duplicate catalogue illustration identity");
            }
            if (ids.size() != 232) throw new IllegalStateException("Incomplete catalogue illustration identity");
            return Set.copyOf(ids);
        } catch (Exception failure) {
            throw new IllegalStateException("Cannot load catalogue illustration identity", failure);
        }
    }

    public static boolean contains(UUID id) { return id != null && IDS.contains(id); }

    public static void requireBookable(UUID doctorId, UUID branchId, UUID packageId) {
        com.healthcare.demo.DashboardDemonstration.requireBookable(doctorId, branchId, packageId);
        if (contains(doctorId) || contains(branchId) || contains(packageId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, BOOKING_NOTICE);
        }
    }
}
