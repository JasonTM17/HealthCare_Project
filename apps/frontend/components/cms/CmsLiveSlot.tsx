"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  CmsApiError,
  CmsClient,
  defaultCmsClient,
  resolveCmsSlotKey,
  type CmsContent,
  type CmsSlotKey,
} from "../../lib/cms-client";
import { CmsReconciliationLedger } from "../../lib/cms-reconciliation.mjs";
import { CmsSlotRenderer } from "./CmsRenderer";

export interface CmsLiveSlotProps {
  /** Public route/page identity. `home` maps `hero` to `homepage.hero`. */
  slug: string;
  slotKey: CmsSlotKey;
  client?: CmsClient;
  pollIntervalMs?: number;
  className?: string;
  showSourceLabel?: boolean;
  /** Keep transport, version, and transient CMS diagnostics out of patient-facing slots. */
  quiet?: boolean;
  /** Optional slots stay out of the layout until an admin publishes them. */
  hideWhenNotFound?: boolean;
  /** Optional route slots should not reserve layout space during their first read. */
  hideWhileLoading?: boolean;
  /** Optional public slots should stay out of the layout when their read fails. */
  hideOnError?: boolean;
  /** Render a published component in the page's native layout instead of the generic CMS card. */
  renderContent?: (content: CmsContent) => ReactNode;
  /** Keep the native page composition visible while the live slot is loading or unavailable. */
  fallback?: ReactNode;
}

type LiveTransport = "connecting" | "sse" | "polling";
type RefreshResult = "updated" | "not-found" | "failed";

function errorMessage(error: unknown): string {
  if (!(error instanceof CmsApiError)) return "Không thể tải nội dung CMS lúc này.";
  switch (error.kind) {
    case "auth":
      return "Phiên đọc nội dung CMS không còn hiệu lực.";
    case "forbidden":
      return "Tài khoản hiện tại không có quyền đọc nội dung CMS này.";
    case "validation":
      return "Nội dung CMS chưa thể hiển thị vì dữ liệu không hợp lệ.";
    case "conflict":
      return "Nội dung CMS vừa thay đổi và đang được đồng bộ lại.";
    case "not-found":
      return "Chưa có nội dung PUBLISHED cho slot này.";
    case "network":
      return "Chưa thể kết nối tới CMS.";
    case "server":
      return "CMS đang gặp sự cố và chưa thể trả nội dung.";
    case "unavailable":
      return "Change-feed CMS tạm thời không khả dụng.";
    default:
      return error.status === 429
        ? "CMS đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau."
        : "Không thể tải nội dung CMS lúc này.";
  }
}

const PUBLIC_TECHNICAL_COPY_PATTERN = /\b(?:live cms|change-feed|polling|transport|demo|placeholder)\b/i;

function containsPublicTechnicalCopy(content: CmsContent): boolean {
  return Object.values(content.payload).some(
    (value) => typeof value === "string" && PUBLIC_TECHNICAL_COPY_PATTERN.test(value),
  );
}

export function CmsLiveSlot({
  slug,
  slotKey,
  client = defaultCmsClient,
  pollIntervalMs = 15_000,
  className = "",
  showSourceLabel = true,
  quiet = false,
  hideWhenNotFound = false,
  hideWhileLoading = false,
  hideOnError = false,
  renderContent,
  fallback,
}: CmsLiveSlotProps): ReactElement {
  const backendSlotKey = resolveCmsSlotKey(slug, slotKey);
  // Public callers already opt out of the source label. Treat that as a
  // patient-facing slot even when the older caller has not passed `quiet` yet.
  const publicQuiet = quiet || !showSourceLabel;
  const slotAriaLabel = publicQuiet ? "Thông tin bệnh viện" : `Nội dung live ${slotKey}`;
  const [content, setContent] = useState<CmsContent | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [transport, setTransport] = useState<LiveTransport>("connecting");
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const latestVersion = useRef(0);
  const suppressTechnicalCopy = publicQuiet && content !== null && containsPublicTechnicalCopy(content);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let safetyPollTimer: ReturnType<typeof setInterval> | undefined;
    let sseConnected = false;
    let initialSnapshotReady = false;
    const reconciliation = new CmsReconciliationLedger();
    let refreshGeneration = 0;
    let stopFeed: () => void = () => undefined;
    let stopPolling: () => void = () => undefined;
    let stopSafetyPolling: () => void = () => undefined;
    latestVersion.current = 0;
    // The same component instance can be reused when the public route changes.
    // Do not expose the previous route's published content while the new slot
    // is loading or when its first authoritative read fails.
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setContent(null);
        setError(null);
        setLoading(true);
        setTransport("connecting");
        setLiveNotice(null);
      }
    });

    const resolvePendingEvent = (eventId: number): void => {
      reconciliation.resolvePending(eventId);
      if (reconciliation.pendingEventIds.size === 0
        && reconciliation.reconciliationCursor === 0
        && sseConnected) {
        stopPolling();
        setTransport("sse");
      }
    };

    const pendingVersionFloor = (): number => {
      return reconciliation.pendingVersionFloor();
    };

    const pendingEventCursor = (): number => {
      return reconciliation.pendingEventCursor();
    };

    const beginReconciliation = (eventId: number): void => {
      reconciliation.beginReconciliation(eventId);
    };

    const finishReconciliation = (eventId: number): boolean => {
      return reconciliation.acknowledgeThrough(eventId);
    };

    const refresh = async (minimumVersion = 0, afterEventId?: number): Promise<RefreshResult> => {
      const readGeneration = ++refreshGeneration;
      const readReconciliationCursor = reconciliation.reconciliationCursor;
      const isAuthoritativeRead = (): boolean => {
        if (cancelled || readGeneration !== refreshGeneration) return false;
        if (afterEventId !== undefined) {
          return reconciliation.reconciliationCursor <= afterEventId;
        }
        return reconciliation.reconciliationCursor <= readReconciliationCursor;
      };

      try {
        const nextContent = await client.getPublishedContent(
          backendSlotKey,
          afterEventId === undefined ? undefined : { afterEventId },
        );
        if (!isAuthoritativeRead() || nextContent.status !== "PUBLISHED") return "failed";
        if (nextContent.version < minimumVersion) {
          setError(new CmsApiError(
            "unavailable",
            503,
            `CMS mới trả version ${nextContent.version}; đang chờ version ${minimumVersion}.`,
          ));
          return "failed";
        }
        if (nextContent.version >= latestVersion.current) {
          latestVersion.current = nextContent.version;
          setContent(nextContent);
        }
        setError(null);
        initialSnapshotReady = true;
        return "updated";
      } catch (nextError) {
        if (!isAuthoritativeRead()) return "failed";
        if (nextError instanceof CmsApiError && nextError.kind === "not-found") {
          setContent(null);
          setError(new CmsApiError("not-found", 404, "Slot hiện không còn PUBLISHED."));
          initialSnapshotReady = true;
          return "not-found";
        }
        setError(nextError);
        return "failed";
      } finally {
        if (isAuthoritativeRead()) setLoading(false);
      }
    };

    const startPolling = (): void => {
      if (cancelled || pollTimer) return;
      setTransport("polling");
      pollTimer = setInterval(() => {
        const minimumVersion = pendingVersionFloor();
        const afterEventId = pendingEventCursor();
        const hasPendingReconciliation = reconciliation.hasPendingWork;
        void refresh(minimumVersion, afterEventId).then((result) => {
          if (
            result === "failed"
            || cancelled
          ) return;
          if (!hasPendingReconciliation) {
            if (initialSnapshotReady
              && sseConnected
              && reconciliation.pendingEventIds.size === 0
              && reconciliation.reconciliationCursor === 0) {
              stopPolling();
              setTransport("sse");
            }
            return;
          }
          if (!finishReconciliation(afterEventId)) {
            // A newer heartbeat/event won the race. Keep the polling loop
            // alive and retry with the newer authoritative cursor.
            startPolling();
            return;
          }
          setLiveNotice(`Đã đồng bộ ${backendSlotKey}, version ${latestVersion.current}.`);
          if (sseConnected
            && reconciliation.pendingEventIds.size === 0
            && reconciliation.reconciliationCursor === 0) {
            stopPolling();
            setTransport("sse");
          }
        });
      }, Math.max(5_000, pollIntervalMs));
    };

    stopPolling = (): void => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const startSafetyPolling = (): void => {
      if (cancelled || safetyPollTimer) return;
      safetyPollTimer = setInterval(() => {
        if (
          cancelled
          || pollTimer
          || !initialSnapshotReady
          || reconciliation.hasPendingWork
        ) return;
        const observedVersion = latestVersion.current;
        void refresh(0).then((result) => {
          if (
            result === "updated"
            && !cancelled
            && latestVersion.current > observedVersion
          ) {
            setLiveNotice(`Đã đồng bộ ${backendSlotKey}, version ${latestVersion.current}.`);
          }
        });
      }, Math.max(5_000, pollIntervalMs));
    };

    stopSafetyPolling = (): void => {
      if (!safetyPollTimer) return;
      clearInterval(safetyPollTimer);
      safetyPollTimer = undefined;
    };

    // CmsClient multiplexes every live slot onto one EventSource and owns its
    // bounded reconnect policy. This effect only owns this slot's durable
    // reconciliation and polling fallback.
    stopFeed = client.subscribeToChanges({
        // Keep zero explicit so a reconnect after a failed first refresh asks
        // the backend to replay from the beginning instead of silently
        // dropping the event that triggered the failed refresh.
        after: reconciliation.latestEventId,
        onChange: (event) => {
          if (event.eventId <= reconciliation.latestEventId) return;
          const hasEventGap = reconciliation.observe(event.eventId);
          if (hasEventGap) {
            beginReconciliation(event.eventId);
            startPolling();
          }
          if (event.slotKey !== backendSlotKey) {
            // The change feed is global. Acknowledging unrelated IDs lets the
            // contiguous cursor advance, while pending relevant IDs still
            // block it. A gap is reconciled through the durable snapshot.
            reconciliation.advanceCursor();
            return;
          }
          if (event.version <= latestVersion.current) {
            reconciliation.advanceCursor();
            return;
          }
          if (event.published) {
            reconciliation.markPending(event.eventId, event.version);
            void refresh(event.version, event.eventId).then((result) => {
              if (result === "updated" && !cancelled) {
                setLiveNotice(`Đã đồng bộ ${backendSlotKey}, version ${latestVersion.current}.`);
                resolvePendingEvent(event.eventId);
              } else if (!cancelled) {
                // Keep the event pending, but switch to bounded polling so a
                // transient read error cannot permanently stall the cursor.
                startPolling();
              }
            });
          } else {
            // Treat unpublish events as wake-up hints too. The authoritative
            // public snapshot must confirm 404 before the UI clears content or
            // advances the durable cursor, which protects the browser from a
            // stale or non-durable high-ID SSE frame.
            reconciliation.markPending(event.eventId, event.version);
            void refresh(0, event.eventId).then((result) => {
              if (result === "not-found" && !cancelled) {
                latestVersion.current = Math.max(latestVersion.current, event.version);
                setLiveNotice(`Đã đồng bộ ${backendSlotKey}; nội dung đã được gỡ xuất bản.`);
                resolvePendingEvent(event.eventId);
              } else if (!cancelled) {
                // A 200 response contradicts the unpublish hint; keep the
                // published snapshot visible and reconcile by polling instead
                // of acknowledging a cursor the database has not proven.
                startPolling();
              }
            });
          }
        },
        onConnected: () => {
          if (cancelled) return;
          sseConnected = true;
          if (reconciliation.pendingEventIds.size === 0
            && reconciliation.reconciliationCursor === 0
            && initialSnapshotReady) {
            stopPolling();
            setTransport("sse");
          } else {
            // A reconnect can win the race with a pending HTTP refresh. Keep
            // polling alive until that event is actually acknowledged.
            startPolling();
          }
        },
        onFallback: () => {
          sseConnected = false;
          startPolling();
        },
        onResync: (event) => {
          beginReconciliation(event.latestEventId);
          startPolling();
          void refresh(pendingVersionFloor(), event.latestEventId).then((result) => {
            if (result !== "failed" && !cancelled) {
              if (!finishReconciliation(event.latestEventId)) {
                startPolling();
                return;
              }
              setLiveNotice(`Đã resync nội dung live từ backend, version ${latestVersion.current}.`);
              if (sseConnected
                && reconciliation.pendingEventIds.size === 0
                && reconciliation.reconciliationCursor === 0) {
                stopPolling();
                setTransport("sse");
              }
            }
            if (result === "failed" && !cancelled) startPolling();
          });
        },
        onHeartbeat: (heartbeat) => {
          if (heartbeat.latestEventId <= reconciliation.latestEventId) return;
          beginReconciliation(heartbeat.latestEventId);
          startPolling();
          void refresh(0, heartbeat.latestEventId).then((result) => {
            if (cancelled) return;
            if (result === "failed") {
              // The durable cursor proves that a broker event may have been
              // missed; keep bounded polling active until the snapshot reads.
              startPolling();
              return;
            }
            if (!finishReconciliation(heartbeat.latestEventId)) {
              startPolling();
              return;
            }
            setLiveNotice("Đã kiểm tra lại nội dung live, version " + latestVersion.current + ".");
            if (sseConnected
              && reconciliation.pendingEventIds.size === 0
              && reconciliation.reconciliationCursor === 0) {
              stopPolling();
              setTransport("sse");
            }
          });
        },
      });

    // Even the first/fallback snapshot bypasses a potentially stale
    // per-instance cache. The durable cursor is the cache-coherence boundary.
    void refresh(0, reconciliation.latestEventId).then((result) => {
      if (result === "failed" && !cancelled) {
        // A healthy SSE connection does not prove the initial snapshot was
        // readable. Keep bounded polling alive until the first read succeeds.
        startPolling();
      } else if (!cancelled
        && initialSnapshotReady
        && sseConnected
        && reconciliation.pendingEventIds.size === 0
        && reconciliation.reconciliationCursor === 0) {
        stopPolling();
        setTransport("sse");
      }
    });
    // Some browser/proxy combinations can leave EventSource "open" while
    // buffering named SSE frames. Keep a quiet cache-coherence watchdog so a
    // missed live event still reconciles from the durable backend snapshot.
    startSafetyPolling();

    return () => {
      cancelled = true;
      stopFeed();
      stopPolling();
      stopSafetyPolling();
    };
  }, [backendSlotKey, client, pollIntervalMs]);

  if (hideWhileLoading && loading && !content && !error) return <></>;

  // A public optional slot must not turn a transient backend outage into a
  // late layout insertion. An explicit fallback remains authoritative and is
  // handled by the normal fallback wrapper below.
  if (hideOnError && !loading && !content && error && fallback === undefined) return <></>;

  const sourceLabel = transport === "polling"
    ? "Live CMS · polling dự phòng"
    : transport === "sse"
      ? "Live CMS · change-feed"
      : "Live CMS · đang kết nối";

  if (hideWhenNotFound && !loading && !content && error instanceof CmsApiError && error.kind === "not-found") {
    if (fallback !== undefined) {
      return (
        <div
          aria-busy={loading}
          className={className}
          data-cms-backend-slot={backendSlotKey}
          data-cms-live-slot={slotKey}
          data-cms-live-source="live-backend"
        >
          {!publicQuiet && error ? (
            <p className="cms-live-slot__fallback-note" role="status">
              {errorMessage(error)} Đang hiển thị giao diện có sẵn trong lúc CMS đồng bộ lại.
            </p>
          ) : null}
          {fallback}
        </div>
      );
    }
    return <></>;
  }

  if (!content && fallback !== undefined) {
    return (
      <div
        aria-busy={loading}
        aria-label={slotAriaLabel}
        className={className}
        data-cms-backend-slot={backendSlotKey}
        data-cms-live-slot={slotKey}
        data-cms-live-source="live-backend"
      >
        {!publicQuiet && error ? (
          <p className="cms-live-slot__fallback-note" role="status">
            {errorMessage(error)} Đang hiển thị giao diện có sẵn trong lúc CMS đồng bộ lại.
          </p>
        ) : null}
        {fallback}
      </div>
    );
  }

  if (suppressTechnicalCopy) {
    if (fallback !== undefined) {
      return (
        <div
          aria-busy={loading}
          aria-label={slotAriaLabel}
          className={className}
          data-cms-backend-slot={backendSlotKey}
          data-cms-live-slot={slotKey}
          data-cms-live-source="live-backend"
          data-cms-suppressed="technical-copy"
        >
          {fallback}
        </div>
      );
    }
    return <></>;
  }

  if (content && renderContent) {
    return (
      <div
        aria-busy={loading}
        aria-label={slotAriaLabel}
        className={className}
        data-cms-backend-slot={backendSlotKey}
        data-cms-live-slot={slotKey}
        data-cms-live-source="live-backend"
        data-cms-version={content.version}
      >
        {showSourceLabel && !publicQuiet ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
            <span>{sourceLabel}</span>
            <span>Version {content.version}</span>
          </div>
        ) : null}
        {!publicQuiet && error && content ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
            Đang hiển thị version {content.version} gần nhất; lần đồng bộ live tiếp theo sẽ thử lại.
          </p>
        ) : null}
        {!publicQuiet && liveNotice ? <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">{liveNotice}</p> : null}
        {renderContent(content)}
      </div>
    );
  }

  return (
    <section
      aria-busy={loading}
      aria-label={slotAriaLabel}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
      data-cms-live-source="live-backend"
      data-cms-live-slot={slotKey}
      data-cms-backend-slot={backendSlotKey}
    >
      {showSourceLabel && !publicQuiet ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <span>{sourceLabel}</span>
          <span>{content ? `Version ${content.version}` : backendSlotKey}</span>
        </div>
      ) : null}

      {error && !content ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert">
          {publicQuiet ? "Thông tin đang được cập nhật. Vui lòng thử lại sau." : `${errorMessage(error)} Không có nội dung thay thế.`}
        </p>
      ) : null}

      {!publicQuiet && error && content ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          Đang hiển thị version {content.version} gần nhất; lần đồng bộ live tiếp theo sẽ thử lại.
        </p>
      ) : null}

      {!publicQuiet && liveNotice ? <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">{liveNotice}</p> : null}

      {loading && !content ? <p className="text-sm text-slate-500" role="status">Đang tải nội dung live…</p> : null}
      {content ? <CmsSlotRenderer content={content} slotKey={slotKey} /> : null}
    </section>
  );
}

export default CmsLiveSlot;
