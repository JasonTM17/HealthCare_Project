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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Distributed request cancellation state. Redis owns the cross-instance
 * linearization; pub/sub interrupts active provider calls quickly, and bounded
 * owner polling recovers cancellation or lease expiry when a subscriber misses
 * its message.
 *
 * <p>Active liveness leases share the existing per-request Redis String key.
 * They are versioned JSON strings with a short logical deadline and the usual
 * cancellation-state TTL. Terminal lease states return to the legacy strings,
 * so older readers fail closed while a lease is active and can still read its
 * terminal result.</p>
 */
@Component
public class ChatRequestCancellationRegistry implements MessageListener {

    public static final String CHANNEL = "healthcare:ai-chat:cancellations";
    // Lease budgets must accommodate the cross-region BFF (Vercel US) -> backend
    // (Render Singapore) round-trip. Sized together with the BFF's
    // CHAT_LEASE_OPEN/RENEW timeouts in lib/server/healthcare-bff.ts:
    // renew interval (2s) < permit freshness (4s) < lease TTL (8s), and every
    // BFF timeout < permit freshness so a slow-but-valid renewal is never rejected.
    public static final long LEASE_TTL_MILLIS = 8_000;
    public static final long RENEWAL_PERMIT_FRESHNESS_MILLIS = 4_000;

    private static final Logger log = LoggerFactory.getLogger(ChatRequestCancellationRegistry.class);
    private static final String KEY_PREFIX = "healthcare:ai-chat:request:";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DefaultRedisScript<String> REGISTER = script("""
        local state = redis.call('GET', KEYS[1])
        if state then return state end
        redis.call('SET', KEYS[1], 'ACTIVE', 'PX', ARGV[1])
        return 'REGISTERED'
        """);
    private static final String LEASE_SCRIPT_HELPERS = """
        local function decodeLease(raw)
          if not raw or string.sub(raw, 1, 1) ~= '{' then return nil, false end
          local ok, value = pcall(cjson.decode, raw)
          if not ok or type(value) ~= 'table' or value.version ~= 1
              or type(value.state) ~= 'string' then
            return nil, true
          end
          return value, false
        end
        local function nowMillis()
          local clock = redis.call('TIME')
          return tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
        end
        local function cancelled(key, ttl)
          redis.call('SET', key, 'CANCELLED', 'PX', ttl)
          return 'CANCELLED'
        end
        """;
    private static final DefaultRedisScript<String> OPEN_LEASE = script(LEASE_SCRIPT_HELPERS + """
        if redis.call('EXISTS', KEYS[1]) == 1 then return '!COLLISION' end
        local now = nowMillis()
        local value = {
          version = 1,
          state = 'LEASE_OPEN',
          scope = ARGV[1],
          patientId = ARGV[2],
          conversationId = ARGV[3],
          idempotencyDigest = ARGV[4],
          leaseExpiresAtMs = now + tonumber(ARGV[5]),
          renewalPermitDigest = ARGV[6],
          renewalPermitIssuedAtMs = now
        }
        -- Physical retention is the cancellation-state TTL, never the short
        -- logical lease TTL. A legacy GET-based REGISTER must see this record.
        redis.call('SET', KEYS[1], cjson.encode(value), 'PX', ARGV[8])
        return ARGV[7]
        """);
    private static final DefaultRedisScript<String> RENEW_LEASE = script(LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return '!MISSING' end
        local value, invalid = decodeLease(raw)
        if invalid then return cancelled(KEYS[1], ARGV[7]) end
        if not value then return '!LEGACY_STATE' end
        if value.scope ~= ARGV[1] then return '!SCOPE' end
        if value.state ~= 'LEASE_OPEN' and value.state ~= 'ACTIVE' then return '!STATE' end
        local now = nowMillis()
        if tonumber(value.leaseExpiresAtMs or 0) <= now
            or tonumber(value.renewalPermitIssuedAtMs or 0) > now
            or now - tonumber(value.renewalPermitIssuedAtMs or 0) > tonumber(ARGV[5]) then
          return cancelled(KEYS[1], ARGV[7])
        end
        if value.renewalPermitDigest ~= ARGV[2] then return '!PERMIT' end
        value.leaseExpiresAtMs = now + tonumber(ARGV[6])
        value.renewalPermitDigest = ARGV[3]
        value.renewalPermitIssuedAtMs = now
        redis.call('SET', KEYS[1], cjson.encode(value), 'PX', ARGV[7])
        return ARGV[4]
        """);
    private static final DefaultRedisScript<String> REGISTER_LEASE = script(LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 'MISSING' end
        local value, invalid = decodeLease(raw)
        if invalid then return cancelled(KEYS[1], ARGV[5]) end
        if not value then return raw end
        if value.state ~= 'LEASE_OPEN' then return value.state end
        local now = nowMillis()
        if tonumber(value.leaseExpiresAtMs or 0) <= now then
          return cancelled(KEYS[1], ARGV[5])
        end
        if value.scope ~= ARGV[1] or value.patientId ~= ARGV[2]
            or value.conversationId ~= ARGV[3] or value.idempotencyDigest ~= ARGV[4] then
          return 'BINDING_MISMATCH'
        end
        value.state = 'ACTIVE'
        redis.call('SET', KEYS[1], cjson.encode(value), 'PX', ARGV[5])
        return 'REGISTERED'
        """);
    private static final DefaultRedisScript<String> CANCEL = script(LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw or raw == 'ACTIVE' then return cancelled(KEYS[1], ARGV[1]) end
        local value, invalid = decodeLease(raw)
        if invalid then return cancelled(KEYS[1], ARGV[1]) end
        if value then
          if value.state == 'LEASE_OPEN' or value.state == 'ACTIVE' then
            return cancelled(KEYS[1], ARGV[1])
          end
          return value.state
        end
        if raw == 'COMMITTING' or raw == 'COMMITTED' then return raw end
        if raw == 'CANCELLED' then return raw end
        return cancelled(KEYS[1], ARGV[1])
        """);
    private static final DefaultRedisScript<Long> CLAIM_COMMIT = new DefaultRedisScript<>(
        LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 0 end
        local value, invalid = decodeLease(raw)
        if invalid then cancelled(KEYS[1], ARGV[1]); return 0 end
        if not value then
          if ARGV[2] ~= 'LEGACY' or raw ~= 'ACTIVE' then return 0 end
          redis.call('SET', KEYS[1], 'COMMITTING', 'PX', ARGV[1])
          return 1
        end
        if ARGV[2] ~= 'LEASE' or value.state ~= 'ACTIVE'
            or value.scope ~= ARGV[3] or value.patientId ~= ARGV[4]
            or value.conversationId ~= ARGV[5] or value.idempotencyDigest ~= ARGV[6] then
          return 0
        end
        if tonumber(value.leaseExpiresAtMs or 0) <= nowMillis() then
          cancelled(KEYS[1], ARGV[1]); return 0
        end
        value.state = 'COMMITTING'
        redis.call('SET', KEYS[1], cjson.encode(value), 'PX', ARGV[1])
        return 1
        """, Long.class);
    private static final DefaultRedisScript<Long> COMPLETE = new DefaultRedisScript<>(
        LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 0 end
        local value, invalid = decodeLease(raw)
        if invalid then cancelled(KEYS[1], ARGV[1]); return 0 end
        if value then
          if value.state ~= 'ACTIVE' and value.state ~= 'COMMITTING' then return 0 end
          redis.call('SET', KEYS[1], 'COMMITTED', 'PX', ARGV[1])
          return 1
        end
        if raw ~= 'ACTIVE' and raw ~= 'COMMITTING' then return 0 end
        redis.call('SET', KEYS[1], 'COMMITTED', 'PX', ARGV[1])
        return 1
        """, Long.class);
    private static final DefaultRedisScript<String> FAIL = script(LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 'MISSING' end
        local value, invalid = decodeLease(raw)
        if invalid then return cancelled(KEYS[1], ARGV[1]) end
        if value then
          if value.state == 'ACTIVE' or value.state == 'COMMITTING' then
            redis.call('SET', KEYS[1], 'FAILED', 'PX', ARGV[1])
            return 'FAILED'
          end
          return value.state
        end
        if raw == 'ACTIVE' or raw == 'COMMITTING' then
          redis.call('SET', KEYS[1], 'FAILED', 'PX', ARGV[1])
          return 'FAILED'
        end
        return raw
        """);
    private static final DefaultRedisScript<String> RECONCILE = script(LEASE_SCRIPT_HELPERS + """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 'MISSING' end
        local value, invalid = decodeLease(raw)
        if invalid then return cancelled(KEYS[1], ARGV[1]) end
        if value then
          if value.state == 'ACTIVE'
              and tonumber(value.leaseExpiresAtMs or 0) <= nowMillis() then
            return cancelled(KEYS[1], ARGV[1])
          end
          return value.state
        end
        if raw == 'ACTIVE' or raw == 'COMMITTING' or raw == 'COMMITTED'
            or raw == 'CANCELLED' or raw == 'FAILED' then return raw end
        return cancelled(KEYS[1], ARGV[1])
        """);

    private final StringRedisTemplate redis;
    private final Duration stateTtl;
    private final ConcurrentMap<String, ChatRequestCancellation> active = new ConcurrentHashMap<>();

    public ChatRequestCancellationRegistry(StringRedisTemplate redis, long stateTtlSeconds) {
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

    public String openLease(String rawRequestId, LeaseBinding binding) {
        String requestId = canonicalRequestId(rawRequestId);
        String token = newPermitToken();
        String result = executeLease(
            OPEN_LEASE,
            requestId,
            binding.scope().name(),
            binding.patientIdOrEmpty(),
            binding.conversationIdOrEmpty(),
            binding.idempotencyDigest(),
            String.valueOf(LEASE_TTL_MILLIS),
            sha256(token),
            token,
            String.valueOf(stateTtl.toMillis())
        );
        if (token.equals(result)) return token;
        if ("!COLLISION".equals(result)) {
            throw new CancellationException("Chat request already has cancellation state");
        }
        throw new IllegalStateException("Could not open chat request lease");
    }

    public String renewLease(String rawRequestId, LeaseScope scope, String rawPermit) {
        String requestId = canonicalRequestId(rawRequestId);
        if (rawPermit == null || rawPermit.length() < 32 || rawPermit.length() > 128) {
            cancelLocal(requestId);
            throw new CancellationException("Chat lease renewal permit is invalid");
        }
        String nextToken = newPermitToken();
        String result;
        try {
            result = executeLease(
                RENEW_LEASE,
                requestId,
                scope.name(),
                sha256(rawPermit),
                sha256(nextToken),
                nextToken,
                String.valueOf(RENEWAL_PERMIT_FRESHNESS_MILLIS),
                String.valueOf(LEASE_TTL_MILLIS),
                String.valueOf(stateTtl.toMillis())
            );
        } catch (RuntimeException exception) {
            cancelLocal(requestId);
            throw exception;
        }
        if (nextToken.equals(result)) return nextToken;
        cancelLocal(requestId);
        publishCancellation(requestId);
        throw new CancellationException("Chat lease renewal was rejected");
    }

    /** Registers a trusted-BFF provider request against its open lease and exact scope binding. */
    public Registration registerBffLease(String rawRequestId, LeaseBinding binding) {
        String requestId = canonicalRequestId(rawRequestId);
        String state = executeLease(
            REGISTER_LEASE,
            requestId,
            binding.scope().name(),
            binding.patientIdOrEmpty(),
            binding.conversationIdOrEmpty(),
            binding.idempotencyDigest(),
            String.valueOf(stateTtl.toMillis())
        );
        if (!"REGISTERED".equals(state)) {
            if ("CANCELLED".equals(state) || "LEASE_OPEN".equals(state) || "ACTIVE".equals(state)) {
                throw new CancellationException("Chat request lease expired or was already used");
            }
            throw new CancellationException("Chat request lease binding is unavailable");
        }
        return registerOwner(requestId);
    }

    /** Legacy direct route registration; trusted BFF routes must use {@link #registerBffLease}. */
    public Registration register(String rawRequestId) {
        String requestId = canonicalRequestId(rawRequestId);
        String state = execute(REGISTER, requestId, stateTtl.toMillis());
        if (!"REGISTERED".equals(state)) {
            if ("CANCELLED".equals(state)) {
                throw new CancellationException("Chat request was cancelled before registration");
            }
            throw new IllegalStateException("Chat request id is already active or terminal");
        }
        return registerOwner(requestId);
    }

    /** Idempotently records cancellation, including a tombstone before registration. */
    public void cancel(String rawRequestId) {
        String requestId = canonicalRequestId(rawRequestId);
        String state = execute(CANCEL, requestId, stateTtl.toMillis());
        if ("CANCELLED".equals(state)) {
            cancelLocal(requestId);
            publishCancellation(requestId);
        }
        // COMMITTING/COMMITTED means the exchange owns the completion race.
        // Repeated cancellation against that terminal side is intentionally a no-op.
    }

    /** Linearization point immediately before the SQL persistence transaction. */
    public void claimCommit(ChatRequestCancellation cancellation) {
        cancellation.claimCommit(() -> claimCommit(cancellation.requestId()));
    }

    /** Legacy claim for direct non-BFF callers. */
    public void claimCommit(String rawRequestId) {
        String requestId = canonicalRequestId(rawRequestId);
        Long claimed = executeCommitClaim(requestId, "LEGACY", null);
        if (!Long.valueOf(1).equals(claimed)) {
            throw new CancellationException("Chat cancellation won before persistence");
        }
    }

    /** Claims a prepared patient request only while its exact bound lease is live. */
    public void claimCommit(String rawRequestId, LeaseBinding binding) {
        String requestId = canonicalRequestId(rawRequestId);
        if (binding.scope() != LeaseScope.PATIENT) {
            throw new IllegalArgumentException("Only a patient chat lease can commit an exchange");
        }
        Long claimed = executeCommitClaim(requestId, "LEASE", binding);
        if (!Long.valueOf(1).equals(claimed)) {
            throw new CancellationException("Chat cancellation or lease expiry won before persistence");
        }
    }

    /** Records a committed exchange or an idempotent replay. Best effort after SQL commit. */
    public void complete(ChatRequestCancellation cancellation) {
        complete(cancellation.requestId());
    }

    /** Records a committed guest exchange or prepared patient replay. */
    public void complete(String rawRequestId) {
        String requestId = canonicalRequestId(rawRequestId);
        try {
            Long completed = redis.execute(COMPLETE, List.of(key(requestId)), String.valueOf(stateTtl.toMillis()));
            if (!Long.valueOf(1).equals(completed)) {
                log.warn("AI chat completion state could not advance requestId={}", requestId);
            }
        } catch (RuntimeException exception) {
            log.warn("AI chat completion state update failed requestId={}", requestId);
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
        cancelLocal(requestId);
    }

    /**
     * Recover missed Pub/Sub delivery and expired leases from each owner's
     * single request key. Each Lua call addresses one key, preserving Redis
     * Cluster slot safety without a cross-request MGET.
     */
    @Scheduled(fixedDelayString = "${ai.chat.cancellation.owner-poll-interval-ms:50}")
    public void reconcileActiveRequests() {
        List<ChatRequestCancellation> pending = active.values().stream()
            .filter(cancellation -> !cancellation.isCancelled())
            .toList();
        if (pending.isEmpty()) return;

        try {
            for (ChatRequestCancellation cancellation : pending) {
                String state = redis.execute(
                    RECONCILE,
                    List.of(key(cancellation.requestId())),
                    String.valueOf(stateTtl.toMillis())
                );
                if (!"ACTIVE".equals(state) && !"COMMITTING".equals(state) && !"COMMITTED".equals(state)) {
                    cancellation.cancel();
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

    private Registration registerOwner(String requestId) {
        ChatRequestCancellation cancellation = new ChatRequestCancellation(requestId);
        if (active.putIfAbsent(requestId, cancellation) != null) {
            fail(requestId);
            throw new IllegalStateException("Chat request id is already active on this instance");
        }
        try {
            // Closes the race where CANCEL runs after REGISTER returns but
            // before the request-owning instance subscribes locally.
            String stateAfterRegistration = redis.execute(
                RECONCILE,
                List.of(key(requestId)),
                String.valueOf(stateTtl.toMillis())
            );
            if ("CANCELLED".equals(stateAfterRegistration) || "MISSING".equals(stateAfterRegistration)) {
                cancellation.cancel();
                throw new CancellationException("Chat request was cancelled during registration");
            } else if (!"ACTIVE".equals(stateAfterRegistration)) {
                throw new IllegalStateException("Chat cancellation state changed during registration");
            }
        } catch (CancellationException exception) {
            active.remove(requestId, cancellation);
            throw exception;
        } catch (RuntimeException exception) {
            active.remove(requestId, cancellation);
            throw unavailable(exception);
        }
        return new Registration(cancellation, () -> active.remove(requestId, cancellation));
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

    private Long executeCommitClaim(String requestId, String mode, LeaseBinding binding) {
        try {
            Long claimed = redis.execute(
                CLAIM_COMMIT,
                List.of(key(requestId)),
                String.valueOf(stateTtl.toMillis()),
                mode,
                binding == null ? "" : binding.scope().name(),
                binding == null ? "" : binding.patientIdOrEmpty(),
                binding == null ? "" : binding.conversationIdOrEmpty(),
                binding == null ? "" : binding.idempotencyDigest()
            );
            if (claimed == null) throw new IllegalStateException("Redis returned no commit claim state");
            return claimed;
        } catch (RuntimeException exception) {
            throw unavailable(exception);
        }
    }

    private String executeLease(DefaultRedisScript<String> script, String requestId, String... arguments) {
        try {
            String result = redis.execute(script, List.of(key(requestId)), (Object[]) arguments);
            if (result == null) throw new IllegalStateException("Redis returned no lease state");
            return result;
        } catch (RuntimeException exception) {
            throw unavailable(exception);
        }
    }

    private void publishCancellation(String requestId) {
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

    private void cancelLocal(String requestId) {
        ChatRequestCancellation local = active.get(requestId);
        if (local != null) local.cancel();
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

    private String newPermitToken() {
        byte[] random = new byte[32];
        RANDOM.nextBytes(random);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private IllegalStateException unavailable(RuntimeException cause) {
        if (cause instanceof IllegalStateException stateException
                && "Shared chat cancellation state is unavailable".equals(stateException.getMessage())) {
            return stateException;
        }
        return new IllegalStateException("Shared chat cancellation state is unavailable", cause);
    }

    public enum LeaseScope {
        PUBLIC_CHAT,
        PATIENT
    }

    public record LeaseBinding(
            LeaseScope scope,
            String patientId,
            String conversationId,
            String idempotencyKey) {

        public static LeaseBinding publicChat() {
            return new LeaseBinding(LeaseScope.PUBLIC_CHAT, null, null, null);
        }

        public static LeaseBinding patient(UUID patientId, UUID conversationId, String idempotencyKey) {
            if (patientId == null || conversationId == null || idempotencyKey == null) {
                throw new IllegalArgumentException("Patient chat lease binding is incomplete");
            }
            String normalizedKey = idempotencyKey.strip();
            if (!normalizedKey.matches("^[A-Za-z0-9._:-]{8,128}$")) {
                throw new IllegalArgumentException("Patient chat idempotency key is invalid");
            }
            return new LeaseBinding(
                LeaseScope.PATIENT,
                patientId.toString(),
                conversationId.toString(),
                normalizedKey
            );
        }

        private String patientIdOrEmpty() {
            return patientId == null ? "" : patientId;
        }

        private String conversationIdOrEmpty() {
            return conversationId == null ? "" : conversationId;
        }

        private String idempotencyDigest() {
            return idempotencyKey == null ? "" : sha256(idempotencyKey);
        }
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
