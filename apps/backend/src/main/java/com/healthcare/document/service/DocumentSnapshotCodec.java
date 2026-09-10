package com.healthcare.document.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Canonical JSON serialization of a {@link DocumentSnapshot} for the
 * integrity hash printed inside the PDF (ADR-005). Field order is fixed by
 * construction, so the same snapshot always yields the same digest.
 */
@Component
public class DocumentSnapshotCodec {

    public String canonicalJson(DocumentSnapshot snapshot) {
        LinkedHashMap<String, Object> root = new LinkedHashMap<>();
        root.put("sourceType", name(snapshot.sourceType()));
        root.put("sourceRecordId", text(snapshot.sourceRecordId()));
        root.put("sourceVersion", snapshot.sourceVersion());
        root.put("templateVersion", text(snapshot.templateVersion()));
        root.put("patientName", text(snapshot.patientName()));
        root.put("patientPhone", text(snapshot.patientPhone()));
        root.put("doctorName", text(snapshot.doctorName()));
        root.put("sourceFinalizedAt", time(snapshot.sourceFinalizedAt()));
        root.put("visitSummary", visitSummary(snapshot.visitSummary()));
        root.put("prescription", prescription(snapshot.prescription()));
        return toJson(root);
    }

    public String sha256Hex(String canonicalJson) {
        return sha256Hex(canonicalJson.getBytes(StandardCharsets.UTF_8));
    }

    public String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            StringBuilder hex = new StringBuilder(digest.getDigestLength() * 2);
            for (byte b : digest.digest(bytes)) {
                hex.append(Character.forDigit((b >> 4) & 0xf, 16));
                hex.append(Character.forDigit(b & 0xf, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable in this JVM", exception);
        }
    }

    private Map<String, Object> visitSummary(DocumentSnapshot.VisitSummaryPayload payload) {
        if (payload == null) {
            return null;
        }
        LinkedHashMap<String, Object> map = new LinkedHashMap<>();
        map.put("bookingCode", text(payload.bookingCode()));
        map.put("visitDate", time(payload.visitDate()));
        map.put("icd10Code", text(payload.icd10Code()));
        map.put("icd10Name", text(payload.icd10Name()));
        map.put("diagnosis", text(payload.diagnosis()));
        map.put("symptomsSummary", text(payload.symptomsSummary()));
        map.put("bloodPressureSystolic", payload.bloodPressureSystolic());
        map.put("bloodPressureDiastolic", payload.bloodPressureDiastolic());
        map.put("heartRate", payload.heartRate());
        map.put("temperature", text(payload.temperature()));
        map.put("weightKg", text(payload.weightKg()));
        map.put("heightCm", text(payload.heightCm()));
        map.put("treatmentPlan", text(payload.treatmentPlan()));
        map.put("doctorNotes", text(payload.doctorNotes()));
        map.put("followUpDate", date(payload.followUpDate()));
        return map;
    }

    private Map<String, Object> prescription(DocumentSnapshot.PrescriptionPayload payload) {
        if (payload == null) {
            return null;
        }
        LinkedHashMap<String, Object> map = new LinkedHashMap<>();
        map.put("prescriptionCode", text(payload.prescriptionCode()));
        map.put("diagnosisSummary", text(payload.diagnosisSummary()));
        map.put("generalAdvice", text(payload.generalAdvice()));
        map.put("status", text(payload.status()));
        map.put("items", payload.items() == null
            ? null
            : payload.items().stream().map(this::prescriptionItem).toList());
        return map;
    }

    private Map<String, Object> prescriptionItem(DocumentSnapshot.PrescriptionItemSnapshot item) {
        LinkedHashMap<String, Object> map = new LinkedHashMap<>();
        map.put("medicationName", text(item.medicationName()));
        map.put("activeIngredient", text(item.activeIngredient()));
        map.put("dosage", text(item.dosage()));
        map.put("unit", text(item.unit()));
        map.put("frequency", text(item.frequency()));
        map.put("durationDays", item.durationDays());
        map.put("totalQuantity", item.totalQuantity());
        map.put("usageNote", text(item.usageNote()));
        return map;
    }

    private String toJson(Object value) {
        StringBuilder builder = new StringBuilder(1024);
        appendValue(builder, value);
        return builder.toString();
    }

    @SuppressWarnings("unchecked")
    private void appendValue(StringBuilder builder, Object value) {
        switch (value) {
            case null -> builder.append("null");
            case String text -> appendEscaped(builder, text);
            case Number number -> builder.append(number);
            case Boolean bool -> builder.append(bool);
            case Map<?, ?> map -> {
                builder.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (!first) {
                        builder.append(',');
                    }
                    first = false;
                    appendEscaped(builder, String.valueOf(entry.getKey()));
                    builder.append(':');
                    appendValue(builder, entry.getValue());
                }
                builder.append('}');
            }
            case Collection<?> collection -> {
                builder.append('[');
                boolean first = true;
                for (Object item : collection) {
                    if (!first) {
                        builder.append(',');
                    }
                    first = false;
                    appendValue(builder, item);
                }
                builder.append(']');
            }
            default -> appendEscaped(builder, String.valueOf(value));
        }
    }

    private void appendEscaped(StringBuilder builder, String text) {
        builder.append('"');
        for (int index = 0; index < text.length(); index++) {
            char ch = text.charAt(index);
            switch (ch) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> {
                    if (ch < 0x20) {
                        builder.append(String.format("\\u%04x", (int) ch));
                    } else {
                        builder.append(ch);
                    }
                }
            }
        }
        builder.append('"');
    }

    private String name(Enum<?> value) {
        return value == null ? null : value.name();
    }

    private String text(String value) {
        return value;
    }

    private String text(UUID value) {
        return value == null ? null : value.toString();
    }

    private String text(Number value) {
        return value == null ? null : value.toString();
    }

    private String time(OffsetDateTime value) {
        return value == null ? null : value.toString();
    }

    private String date(LocalDate value) {
        return value == null ? null : value.toString();
    }
}
