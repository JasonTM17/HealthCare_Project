package com.healthcare.sync.outbox;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;

/** Creates event ids and correlation ids inside the trusted server boundary. */
public final class ServerSyncEventFactory {

    private final Clock clock;

    public ServerSyncEventFactory() {
        this(Clock.systemUTC());
    }

    public ServerSyncEventFactory(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public SyncOutboxEvent create(SyncEventIdentity identity, SyncContentHash contentHash) {
        return SyncOutboxEvent.pending(
            identity,
            contentHash,
            OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC),
            UUID.randomUUID()
        );
    }
}
