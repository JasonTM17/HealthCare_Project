package com.healthcare.demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Server-owned identities, independent of editable labels and caller-provided flags. */
public final class DashboardDemonstration {
    public static final String NOTICE = "Dữ liệu minh họa; không chuyển tiền và không có lịch khám thật.";
    private static final Map<String, UUID> IDS = load();
    public static final UUID OWNER_ADMIN = UUID.fromString("90000000-0000-0000-0000-000000000025");

    private DashboardDemonstration() { }

    private static Map<String, UUID> load() {
        try (InputStream stream = DashboardDemonstration.class.getResourceAsStream("/dashboard-demonstration.json")) {
            if (stream == null) throw new IllegalStateException("Missing demonstration identity");
            byte[] bytes = stream.readAllBytes();
            // Git can check out this text resource with CRLF on Windows; identity ignores only that conversion.
            byte[] normalized = new String(bytes, StandardCharsets.UTF_8).replace("\r\n", "\n").getBytes(StandardCharsets.UTF_8);
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized));
            if (!"0e6fd6ecc635280b463e737767500462505491701896115ab30bf63f690e2eae".equals(hash)) {
                throw new IllegalStateException("Demonstration identity mismatch");
            }
            var tree = new ObjectMapper().readTree(bytes);
            Map<String, UUID> ids = new HashMap<>();
            tree.path("ids").fields().forEachRemaining(field -> ids.put(field.getKey(), UUID.fromString(field.getValue().asText())));
            if (ids.size() != 11 || ids.values().stream().distinct().count() != 11) {
                throw new IllegalStateException("Incomplete demonstration identity");
            }
            return Map.copyOf(ids);
        } catch (Exception failure) {
            throw new IllegalStateException("Cannot load demonstration identity", failure);
        }
    }

    public static UUID id(String name) { return IDS.get(name); }
    public static boolean appointment(UUID id) { return IDS.get("appointment").equals(id); }
    public static boolean notificationReference(UUID id) { return appointment(id) || IDS.get("question").equals(id); }
    public static String notice(UUID id) { return id != null && IDS.containsValue(id) ? NOTICE : null; }
    public static String noticeForText(Object id) {
        return id != null && IDS.values().stream().anyMatch(value -> value.toString().equals(id.toString())) ? NOTICE : null;
    }

    public static void requireOrdinaryPayment(UUID appointmentId) {
        if (appointment(appointmentId)) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Giao dịch minh họa không dùng ngân hàng, sao kê hay biên nhận thật.");
    }

    /** Reject immutable private fixtures before governance can lock their shared rows. */
    public static void requireMutableDoctor(UUID doctorId) {
        if (IDS.get("doctor").equals(doctorId)) {
            throw new org.springframework.security.access.AccessDeniedException(NOTICE);
        }
    }

    public static void requireBookable(UUID doctorId, UUID branchId, UUID packageId) {
        if (IDS.get("doctor").equals(doctorId) || IDS.get("branch").equals(branchId) || IDS.get("package").equals(packageId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NOTICE);
        }
    }
}
