package com.healthcare.sync.outbox;

/** Monotonic database cursor; zero is the pre-persistence start position. */
public record SyncCursor(long value) implements Comparable<SyncCursor> {

    public static final SyncCursor INITIAL = new SyncCursor(0);

    public SyncCursor {
        if (value < 0) {
            throw new IllegalArgumentException("cursor cannot be negative");
        }
    }

    public boolean isAfter(SyncCursor other) {
        return other != null && value > other.value;
    }

    @Override
    public int compareTo(SyncCursor other) {
        return Long.compare(value, other.value);
    }
}
