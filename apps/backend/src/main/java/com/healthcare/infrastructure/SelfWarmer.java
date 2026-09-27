package com.healthcare.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;

/**
 * Keeps the Render Free instance (and the ai-service beside it) from going to
 * sleep. The external GitHub Actions warmer cron was measured firing hours
 * apart instead of every five minutes, so every idle gap still ended in a
 * 26-42 s cold start on the first request of a burst. Pinging this instance's
 * own {@code /actuator/health} and the ai-service's {@code /livez} from inside
 * the JVM has no external dependency and costs one loopback GET per interval.
 *
 * <p>Best-effort by design: every ping failure is swallowed with a single
 * DEBUG line. A sleeping upstream is the expected state this component exists
 * to fix, not an incident to page on, so it never logs at WARN/ERROR and never
 * lets an exception escape into the scheduler.
 */
@Component
@ConditionalOnProperty(prefix = "app.self-warmer", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SelfWarmer {

    private static final Logger log = LoggerFactory.getLogger(SelfWarmer.class);

    /** Hard connect/read ceiling for a loopback ping; a warm instance answers in milliseconds. */
    private static final Duration PING_TIMEOUT = Duration.ofSeconds(5);

    private final int serverPort;
    private final String aiServiceUrl;
    private final RestTemplate restTemplate;

    // Multiple constructors exist (the package-private one is for tests), so
    // the injection target must be marked explicitly.
    @Autowired
    public SelfWarmer(
            @Value("${server.port:10000}") int serverPort,
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl) {
        this(serverPort, aiServiceUrl, defaultRestTemplate());
    }

    /** Test-visible constructor that allows injecting a mocked {@link RestTemplate}. */
    SelfWarmer(int serverPort, String aiServiceUrl, RestTemplate restTemplate) {
        this.serverPort = serverPort;
        this.aiServiceUrl = aiServiceUrl;
        this.restTemplate = restTemplate;
    }

    private static RestTemplate defaultRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) PING_TIMEOUT.toMillis());
        factory.setReadTimeout((int) PING_TIMEOUT.toMillis());
        return new RestTemplate(factory);
    }

    /**
     * Default cadence is four minutes: comfortably inside Render Free's idle
     * eviction window, and cheap enough (two tiny GETs) to leave on by default.
     */
    @Scheduled(fixedDelayString = "${app.self-warmer.interval-ms:240000}")
    public void warm() {
        pingSelf();
        pingAiService();
    }

    void pingSelf() {
        ping(URI.create("http://127.0.0.1:" + serverPort + "/actuator/health"), "backend");
    }

    void pingAiService() {
        ping(URI.create(normalizeBaseUrl(aiServiceUrl) + "/livez"), "ai-service");
    }

    private void ping(URI uri, String target) {
        try {
            restTemplate.getForEntity(uri, String.class);
            log.debug("Self-warmer ping OK target={}", target);
        } catch (RuntimeException exception) {
            // Swallowed on purpose: the warmer's job is to keep the instance
            // awake, and a missed ping only means the next tick retries.
            log.debug("Self-warmer ping failed target={} reason={}",
                target, exception.getClass().getSimpleName());
        }
    }

    /**
     * Render's {@code fromService.property: hostport} supplies a bare
     * {@code host:port}; mirror {@code AiService.endpoint} by prepending the
     * cleartext scheme so {@link URI#create} receives an absolute URL.
     */
    private static String normalizeBaseUrl(String base) {
        String trimmed = base == null ? "" : base.strip();
        if (!trimmed.isEmpty() && !trimmed.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*$")) {
            trimmed = "http://" + trimmed;
        }
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
