package com.healthcare.cms.service;

import com.healthcare.cms.dto.CmsContentChangeResponse;
import com.healthcare.cms.dto.CmsHeartbeatResponse;
import com.healthcare.cms.dto.CmsReadyResponse;
import com.healthcare.cms.dto.CmsResyncResponse;
import com.healthcare.cms.entity.CmsContentChange;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class CmsChangeFeedHub {

    public static final int REPLAY_LIMIT = 50;
    private static final int MAX_CONNECTIONS = 256;
    private static final long EMITTER_TIMEOUT_MILLIS = 45_000L;
    private static final long HEARTBEAT_INTERVAL_MILLIS = 15_000L;

    private final CmsContentChangeRepository changeRepository;
    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final AtomicLong connectionIds = new AtomicLong();
    private final Object streamLock = new Object();
    private final ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "cms-sse-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    public CmsChangeFeedHub(CmsContentChangeRepository changeRepository) {
        this.changeRepository = changeRepository;
    }

    @PostConstruct
    void startHeartbeat() {
        heartbeatExecutor.scheduleAtFixedRate(
            this::sendHeartbeats,
            HEARTBEAT_INTERVAL_MILLIS,
            HEARTBEAT_INTERVAL_MILLIS,
            TimeUnit.MILLISECONDS
        );
    }

    @PreDestroy
    void stopHeartbeat() {
        heartbeatExecutor.shutdownNow();
    }

    public SseEmitter open(Long afterEventId) {
        synchronized (streamLock) {
            if (emitters.size() >= MAX_CONNECTIONS) {
                throw new BusinessException(503, "CMS change feed capacity is temporarily full");
            }

            long connectionId = connectionIds.incrementAndGet();
            SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MILLIS);
            Runnable remove = () -> emitters.remove(connectionId);
            emitter.onCompletion(remove);
            emitter.onTimeout(remove);
            emitter.onError(error -> remove.run());
            emitters.put(connectionId, emitter);

            try {
                long latestEventId = latestEventId();
                send(emitter, "ready", null, new CmsReadyResponse(
                    latestEventId,
                    REPLAY_LIMIT,
                    "/api/v1/cms/content/{slotKey}"
                ));

                if (afterEventId != null) {
                    List<CmsContentChange> changes = changeRepository.findAfterId(
                        afterEventId,
                        PageRequest.of(0, REPLAY_LIMIT + 1)
                    );
                    if (changes.size() > REPLAY_LIMIT) {
                        send(emitter, "resync", Long.toString(latestEventId), new CmsResyncResponse(
                            latestEventId,
                            "replay-window-exceeded",
                            "/api/v1/cms/content/{slotKey}"
                        ));
                    } else {
                        for (CmsContentChange change : changes) {
                            send(emitter, "cms-content-changed", Long.toString(change.getId()), toResponse(change));
                        }
                    }
                }
            } catch (IOException | RuntimeException ex) {
                emitters.remove(connectionId);
                emitter.completeWithError(ex);
            }
            return emitter;
        }
    }

    public void publish(CmsContentChangeResponse change) {
        synchronized (streamLock) {
            emitters.forEach((connectionId, emitter) -> {
                try {
                    send(emitter, "cms-content-changed", Long.toString(change.eventId()), change);
                } catch (IOException | RuntimeException ex) {
                    emitters.remove(connectionId);
                    emitter.completeWithError(ex);
                }
            });
        }
    }

    private void sendHeartbeats() {
        synchronized (streamLock) {
            long latestEventId;
            try {
                latestEventId = latestEventId();
            } catch (RuntimeException exception) {
                // Keep the scheduler alive if PostgreSQL is briefly unavailable.
                return;
            }
            CmsHeartbeatResponse heartbeat = new CmsHeartbeatResponse(
                OffsetDateTime.now(ZoneOffset.UTC),
                latestEventId
            );
            emitters.forEach((connectionId, emitter) -> {
                try {
                    send(emitter, "heartbeat", null, heartbeat);
                } catch (IOException | RuntimeException ex) {
                    emitters.remove(connectionId);
                    emitter.completeWithError(ex);
                }
            });
        }
    }

    private void send(SseEmitter emitter, String eventName, String eventId, Object data) throws IOException {
        SseEmitter.SseEventBuilder event = SseEmitter.event().name(eventName);
        if (eventId != null) {
            event.id(eventId);
        }
        emitter.send(event.data(data, MediaType.APPLICATION_JSON));
    }

    private long latestEventId() {
        return changeRepository.findTopByOrderByIdDesc()
            .map(CmsContentChange::getId)
            .orElse(0L);
    }

    private CmsContentChangeResponse toResponse(CmsContentChange change) {
        return new CmsContentChangeResponse(
            change.getId(),
            change.getSlotKey(),
            change.getContentVersion(),
            change.isPublished(),
            change.getChangedAt()
        );
    }
}
