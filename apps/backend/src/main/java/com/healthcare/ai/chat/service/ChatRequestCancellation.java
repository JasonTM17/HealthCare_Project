package com.healthcare.ai.chat.service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CancellationException;

/** Request-scoped cancellation signal shared by the chat service and its AI HTTP client. */
public final class ChatRequestCancellation {

    private final String requestId;
    private final Object monitor = new Object();
    private final List<Runnable> callbacks = new ArrayList<>();
    private boolean cancelled;

    ChatRequestCancellation(String requestId) {
        this.requestId = requestId;
    }

    public String requestId() {
        return requestId;
    }

    public boolean isCancelled() {
        synchronized (monitor) {
            return cancelled;
        }
    }

    public void throwIfCancelled() {
        if (isCancelled()) throw new CancellationException("Chat request was cancelled");
    }

    /**
     * Serialize the local cancel signal with the distributed commit claim. This
     * also makes a fail-closed poll cancellation win if Redis briefly recovers
     * before the caller reaches its Lua claim.
     */
    void claimCommit(Runnable distributedClaim) {
        synchronized (monitor) {
            if (cancelled) throw new CancellationException("Chat request was cancelled");
            distributedClaim.run();
        }
    }

    public AutoCloseable onCancel(Runnable callback) {
        boolean invokeNow;
        synchronized (monitor) {
            invokeNow = cancelled;
            if (!invokeNow) callbacks.add(callback);
        }
        if (invokeNow) callback.run();
        return () -> {
            synchronized (monitor) {
                callbacks.remove(callback);
            }
        };
    }

    void cancel() {
        List<Runnable> pending;
        synchronized (monitor) {
            if (cancelled) return;
            cancelled = true;
            pending = List.copyOf(callbacks);
            callbacks.clear();
        }
        for (Runnable callback : pending) {
            try {
                callback.run();
            } catch (RuntimeException ignored) {
                // One transport cleanup failure must not prevent other listeners.
            }
        }
    }
}
