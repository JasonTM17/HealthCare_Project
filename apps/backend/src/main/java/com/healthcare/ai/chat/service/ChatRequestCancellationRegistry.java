package com.healthcare.ai.chat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Distributed request cancellation state. Redis owns the cross-instance
 * linearization; pub/sub interrupts active provider calls quickly, and bounded
 * owner polling recovers cancellation when a subscriber misses that message.
 */
@Component
public class ChatRequestCancellationRegistry implements MessageListener {

    public static final String CHANNEL = "healthcare:ai-chat:cancellations";
    private static final Logger log = LoggerFactory.getLogger(ChatRequestCancellationRegistry.class);
    private static final String KEY_PREFIX = "healthcare:ai-chat:request:";
    private static final DefaultRedisScript<String> REGISTER = script("""
        local state = redis.call('GET', KEYS[1])
        if state then return state end
        redis.call('SET', KEYS[1], 'ACTIVE', 'PX', ARGV[1])
        return 'REGISTERED'
        """);
    private static final DefaultRedisScript<String> CANCEL = script("""
        local state = redis.call('GET', KEYS[1])
        if not state or state == 'ACTIVE' then
          redis.call('SET', KEYS[1], 'CANCELLED', 'PX', ARGV[1])
          return 'CANCELLED'
        end
        return state
        """);
    private static final DefaultRedisScript<Long> CLAIM_COMMIT = new DefaultRedisScript<>("""
        if redis.call('GET', KEYS[1]) ~= 'ACTIVE' then return 0 end
        redis.call('SET', KEYS[1], 'COMMITTING', 'PX', ARGV[1])
        return 1
        """, Long.class);
    private static final DefaultRedisScript<Long> COMPLETE = new DefaultRedisScript<>("""
        local state = redis.call('GET', KEYS[1])
        if state ~= 'ACTIVE' and state ~= 'COMMITTING' then return 0 end
        redis.call('SET', KEYS[1], 'COMMITTED', 'PX', ARGV[1])
        return 1
        """, Long.class);
    private static final DefaultRedisScript<String> FAIL = script("""
        local state = redis.call('GET', KEYS[1])
        if state == 'ACTIVE' or state == 'COMMITTING' then
          redis.call('SET', KEYS[1], 'FAILED', 'PX', ARGV[1])
          return 'FAILED'
        end
        return state or 'MISSING'
        """);

    private final StringRedisTemplate redis;
    private final Duration stateTtl;
    private final ConcurrentMap<String, ChatRequestCancellation> active = new ConcurrentHashMap<>();

    public ChatRequestCancellationRegistry(
            StringRedisTemplate redis,
            long stateTtlSeconds) {
        this(redis, stateTtlSeconds, 50);
    }

    @Autowired
    public ChatRequestCancellationRegistry(
            StringRedisTemplate redis,
            @Value("${ai.chat.cancellation.state-ttl-seconds:180}") long stateTtlSeconds,
            @Value("${ai.chat.cancellation.owner-poll-interval-ms:50}") long ownerPollIntervalMillis) {
        this.redis = redis;
        if (stateTtlSeconds < 90 || stateTtlSeconds > 600) {
            throw new IllegalArgumentException("Chat cancellation state TTL must be 90..600 seconds");
        }
        if (ownerPollIntervalMillis < 10 || ownerPollIntervalMillis > 250) {
            throw new IllegalArgumentException("Chat cancellation owner poll interval must be 10..250 milliseconds");
        }
        this.stateTtl = Duration.ofSeconds(stateTtlSeconds);
    }

    public Registration register(String rawRequestId) {
        String requestId = canonicalRequestId(rawRequestId);
        String state = execute(REGISTER, requestId, stateTtl.toMillis());
        if (!"REGISTERED".equals(state)) {
            if ("CANCELLED".equals(state)) {
                throw new java.util.concurrent.CancellationException("Chat request was cancelled before registration");
            }
            throw new IllegalStateException("Chat request id is already active or terminal");
        }

        ChatRequestCancellation cancellation = new ChatRequestCancellation(requestId);
        if (active.putIfAbsent(requestId, cancellation) != null) {
            fail(requestId);
            throw new IllegalStateException("Chat request id is already active on this instance");
        }
        try {
            // Closes the race where the cancel side-call writes its tombstone
            // after REGISTER returns but before this instance subscribes locally.
            String stateAfterRegistration = redis.opsForValue().get(key(requestId));
            if ("CANCELLED".equals(stateAfterRegistration)) cancellation.cancel();
            else if (!"ACTIVE".equals(stateAfterRegistration)) {
                throw new IllegalStateException("Chat cancellation state changed during registration");
            }
        } catch (RuntimeException exception) {
            active.remove(requestId, cancellation);
            throw unavailable(exception);
        }
        return new Registration(cancellation, () -> active.remove(requestId, cancellation));
    }

    /** Idempotently records cancellation, including a tombstone before registration. */
    public void cancel(String rawRequestId) {
        String requestId = canonicalRequestId(rawRequestId);
        String state = execute(CANCEL, requestId, stateTtl.toMillis());
        if ("CANCELLED".equals(state)) {
            ChatRequestCancellation local = active.get(requestId);
            if (local != null) local.cancel();
            try {
                Long listeners = redis.convertAndSend(CHANNEL, requestId);
                if (listeners == null || listeners < 1) {
                    log.warn("AI chat cancellation has no Pub/Sub listeners; owner polling will reconcile");
                }
            } catch (RuntimeException exception) {
                log.warn(
                    "AI chat cancellation Pub/Sub delivery failed; owner polling will reconcile errorType={}",
                    exception.getClass().getSimpleName());
            }
        }
        // COMMITTING/COMMITTED means the exchange owns the completion race.
        // Repeated cancellation against that terminal side is intentionally a no-op.
    }

    /** Linearization point immediately before the SQL persistence transaction. */
    public void claimCommit(ChatRequestCancellation cancellation) {
        cancellation.claimCommit(() -> {
            Long claimed = execute(CLAIM_COMMIT, cancellation.requestId(), stateTtl.toMillis());
            if (!Long.valueOf(1).equals(claimed)) {
                throw new java.util.concurrent.CancellationException("Chat cancellation won before persistence");
            }
        });
    }

    /** Records a committed exchange or an idempotent replay. Best effort after SQL commit. */
    public void complete(ChatRequestCancellation cancellation) {
        try {
            Long completed = execute(COMPLETE, cancellation.requestId(), stateTtl.toMillis());
            if (!Long.valueOf(1).equals(completed)) {
                log.warn("AI chat completion state could not advance requestId={}", cancellation.requestId());
            }
        } catch (RuntimeException exception) {
            log.warn("AI chat completion state update failed requestId={}", cancellation.requestId());
        }
    }

    /** Marks provider or persistence failures without overwriting a cancellation tombstone. */
    public void fail(String rawRequestId) {
        try {
            execute(FAIL, canonicalRequestId(rawRequestId), stateTtl.toMillis());
        } catch (RuntimeException exception) {
            log.warn("AI chat cancellation failure state update failed");
        }
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String requestId = new String(message.getBody(), StandardCharsets.UTF_8);
        if (!isCanonicalRequestId(requestId)) return;
        ChatRequestCancellation cancellation = active.get(requestId);
        if (cancellation != null) cancellation.cancel();
    }

    /**
     * Recover missed Pub/Sub delivery from the shared tombstone while provider
     * calls are active. One MGET checks every request owned by this instance.
     */
    @Scheduled(fixedDelayString = "${ai.chat.cancellation.owner-poll-interval-ms:50}")
    public void reconcileActiveRequests() {
        List<ChatRequestCancellation> pending = active.values().stream()
            .filter(cancellation -> !cancellation.isCancelled())
            .toList();
        if (pending.isEmpty()) return;

        List<String> keys = pending.stream().map(cancellation -> key(cancellation.requestId())).toList();
        try {
            List<String> states = redis.opsForValue().multiGet(keys);
            if (states == null || states.size() != pending.size()) {
                throw new IllegalStateException("Redis returned an incomplete chat cancellation snapshot");
            }
            for (int index = 0; index < pending.size(); index++) {
                String state = states.get(index);
                if (!"ACTIVE".equals(state) && !"COMMITTING".equals(state) && !"COMMITTED".equals(state)) {
                    pending.get(index).cancel();
                }
            }
        } catch (RuntimeException exception) {
            pending.forEach(ChatRequestCancellation::cancel);
            log.warn(
                "AI chat cancellation state unavailable; stopped active provider requests count={} errorType={}",
                pending.size(), exception.getClass().getSimpleName()
            );
        }
    }

    private <T> T execute(DefaultRedisScript<T> script, String requestId, Object ttlMillis) {
        try {
            T result = redis.execute(script, List.of(key(requestId)), String.valueOf(ttlMillis));
            if (result == null) throw new IllegalStateException("Redis returned no cancellation state");
            return result;
        } catch (RuntimeException exception) {
            throw unavailable(exception);
        }
    }

    private static DefaultRedisScript<String> script(String source) {
        return new DefaultRedisScript<>(source, String.class);
    }

    private String key(String requestId) {
        return KEY_PREFIX + requestId;
    }

    private String canonicalRequestId(String rawRequestId) {
        if (!isCanonicalRequestId(rawRequestId)) {
            throw new IllegalArgumentException("Chat request id must be a canonical UUID");
        }
        return UUID.fromString(rawRequestId).toString();
    }

    private boolean isCanonicalRequestId(String value) {
        if (value == null) return false;
        try {
            return UUID.fromString(value).toString().equals(value);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private IllegalStateException unavailable(RuntimeException cause) {
        return new IllegalStateException("Shared chat cancellation state is unavailable", cause);
    }

    public static final class Registration implements AutoCloseable {
        private final ChatRequestCancellation cancellation;
        private final Runnable closeAction;

        private Registration(ChatRequestCancellation cancellation, Runnable closeAction) {
            this.cancellation = cancellation;
            this.closeAction = closeAction;
        }

        public ChatRequestCancellation cancellation() {
            return cancellation;
        }

        @Override
        public void close() {
            closeAction.run();
        }
    }
}
