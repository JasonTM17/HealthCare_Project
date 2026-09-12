package com.healthcare.observability;

import org.slf4j.MDC;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Content-free request tracing shared by the HTTP edge and service clients.
 * Only canonical UUIDs are accepted, preventing untrusted header values from
 * becoming log-forging or high-cardinality telemetry input.
 */
public final class RequestTrace {

    public static final String HEADER = "X-Request-ID";
    public static final String REQUEST_ATTRIBUTE = RequestTrace.class.getName() + ".requestId";
    private static final String MDC_KEY = "request_id";
    private static final Pattern UUID_PATTERN = Pattern.compile(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    );

    private RequestTrace() {
    }

    public static String canonicalOrNew(String candidate) {
        if (candidate != null && UUID_PATTERN.matcher(candidate).matches()) {
            return UUID.fromString(candidate).toString();
        }
        return UUID.randomUUID().toString();
    }

    public static String currentId() {
        String current = MDC.get(MDC_KEY);
        return current == null || current.isBlank() ? null : current;
    }

    static String bind(String requestId) {
        String previous = MDC.get(MDC_KEY);
        MDC.put(MDC_KEY, requestId);
        return previous;
    }

    static void restore(String previous) {
        if (previous == null) MDC.remove(MDC_KEY);
        else MDC.put(MDC_KEY, previous);
    }
}
