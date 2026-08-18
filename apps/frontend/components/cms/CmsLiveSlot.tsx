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
import { CmsSlotRenderer } from "./CmsRenderer";

export interface CmsLiveSlotProps {
  /** Public route/page identity. `home` maps `hero` to `homepage.hero`. */
  slug: string;
  slotKey: CmsSlotKey;
  client?: CmsClient;
  pollIntervalMs?: number;
  className?: string;
  showSourceLabel?: boolean;
  /** Optional slots stay out of the layout until an admin publishes them. */
  hideWhenNotFound?: boolean;
  /** Render a published component in the page's native layout instead of the generic CMS card. */
  renderContent?: (content: CmsContent) => ReactNode;
  /** Keep the native page composition visible while the live slot is loading or unavailable. */
  fallback?: ReactNode;
}

type LiveTransport = "connecting" | "sse" | "polling";

function errorMessage(error: unknown): string {
  if (error instanceof CmsApiError && error.kind === "not-found") return "Chưa có nội dung PUBLISHED cho slot này.";
  if (error instanceof CmsApiError && error.kind === "auth") return "CMS yêu cầu xác thực để đọc nội dung live.";
  if (error instanceof CmsApiError && error.kind === "forbidden") return "Bạn không có quyền đọc nội dung live này.";
  if (error instanceof CmsApiError && error.kind === "unavailable") return "Change-feed CMS tạm thời không khả dụng.";
  if (error instanceof Error) return error.message;
  return "Không thể tải nội dung live.";
}

export function CmsLiveSlot({
  slug,
  slotKey,
  client = defaultCmsClient,
  pollIntervalMs = 15_000,
  className = "",
  showSourceLabel = true,
  hideWhenNotFound = false,
  renderContent,
  fallback,
}: CmsLiveSlotProps): ReactElement {
  const backendSlotKey = resolveCmsSlotKey(slug, slotKey);
  const [content, setContent] = useState<CmsContent | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [transport, setTransport] = useState<LiveTransport>("connecting");
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const latestVersion = useRef(0);
  const latestEventId = useRef(0);
  const highestObservedEventId = useRef(0);
  const pendingEventIds = useRef<Set<number>>(new Set());
  const pendingEventVersions = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let sseConnected = false;
    let stopFeed: () => void = () => undefined;
    let stopPolling: () => void = () => undefined;
    latestVersion.current = 0;
    latestEventId.current = 0;
    highestObservedEventId.current = 0;
    pendingEventIds.current.clear();
    pendingEventVersions.current.clear();
    void Promise.resolve().then(() => {
      if (!cancelled) setLiveNotice(null);
    });

    const advanceCursor = (): void => {
      const pendingIds = [...pendingEventIds.current];
      const earliestPendingId = pendingIds.length > 0 ? Math.min(...pendingIds) : undefined;
      const safeCursor = earliestPendingId === undefined
        ? highestObservedEventId.current
        : earliestPendingId - 1;
      latestEventId.current = Math.max(latestEventId.current, safeCursor);
    };

    const resolvePendingEvent = (eventId: number): void => {
      pendingEventIds.current.delete(eventId);
      pendingEventVersions.current.delete(eventId);
      advanceCursor();
      if (pendingEventIds.current.size === 0 && sseConnected) {
        stopPolling();
        setTransport("sse");
      }
    };

    const pendingVersionFloor = (): number => {
      return Math.max(0, ...pendingEventVersions.current.values());
    };

    const refresh = async (minimumVersion = 0): Promise<boolean> => {
      try {
        const nextContent = await client.getPublishedContent(backendSlotKey);
        if (cancelled || nextContent.status !== "PUBLISHED") return false;
        if (nextContent.version < minimumVersion) {
          setError(new CmsApiError(
            "unavailable",
            503,
            `CMS mới trả version ${nextContent.version}; đang chờ version ${minimumVersion}.`,
          ));
          return false;
        }
        if (nextContent.version >= latestVersion.current) {
          latestVersion.current = nextContent.version;
          setContent(nextContent);
        }
        setError(null);
        return true;
      } catch (nextError) {
        if (!cancelled) {
          if (nextError instanceof CmsApiError && nextError.kind === "not-found") setContent(null);
          setError(nextError);
        }
        return false;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const startPolling = (): void => {
      if (cancelled || pollTimer) return;
      setTransport("polling");
      pollTimer = setInterval(() => {
        void refresh(pendingVersionFloor()).then((succeeded) => {
          if (!succeeded || cancelled || pendingEventIds.current.size === 0) return;
          pendingEventIds.current.clear();
          pendingEventVersions.current.clear();
          advanceCursor();
          setLiveNotice(`Đã đồng bộ ${backendSlotKey}, version ${latestVersion.current}.`);
          if (sseConnected) {
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

    // CmsClient multiplexes every live slot onto one EventSource and owns its
    // bounded reconnect policy. This effect only manages this slot's snapshot
    // and polling fallback, so StrictMode cleanup cannot leave orphan streams.
    stopFeed = client.subscribeToChanges({
        // Keep zero explicit so a reconnect after a failed first refresh asks
        // the backend to replay from the beginning instead of silently
        // dropping the event that triggered the failed refresh.
        after: latestEventId.current,
        onChange: (event) => {
          if (event.eventId <= latestEventId.current) return;
          highestObservedEventId.current = Math.max(highestObservedEventId.current, event.eventId);
          if (event.slotKey !== backendSlotKey) {
            // The change feed is global. Acknowledging unrelated IDs lets the
            // cursor advance, while pending relevant IDs still block it.
            advanceCursor();
            return;
          }
          if (event.version <= latestVersion.current) {
            advanceCursor();
            return;
          }
          if (event.published) {
            pendingEventIds.current.add(event.eventId);
            pendingEventVersions.current.set(event.eventId, event.version);
            void refresh(event.version).then((succeeded) => {
              if (succeeded && !cancelled) {
                setLiveNotice(`Đã đồng bộ ${backendSlotKey}, version ${latestVersion.current}.`);
                resolvePendingEvent(event.eventId);
              } else if (!cancelled) {
                // Keep the event pending, but switch to bounded polling so a
                // transient read error cannot permanently stall the cursor.
                startPolling();
              }
            });
          } else {
            latestVersion.current = event.version;
            setContent(null);
            setError(new CmsApiError("not-found", 404, "Slot hiện không còn PUBLISHED."));
            setLoading(false);
            advanceCursor();
          }
        },
        onConnected: () => {
          if (cancelled) return;
          sseConnected = true;
          if (pendingEventIds.current.size === 0) {
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
          void refresh(pendingVersionFloor()).then((succeeded) => {
            if (succeeded && !cancelled) {
              pendingEventIds.current.clear();
              pendingEventVersions.current.clear();
              highestObservedEventId.current = Math.max(highestObservedEventId.current, event.latestEventId);
              latestEventId.current = Math.max(latestEventId.current, event.latestEventId);
              setLiveNotice(`Đã resync nội dung live từ backend, version ${latestVersion.current}.`);
              if (sseConnected) {
                stopPolling();
                setTransport("sse");
              }
            }
            if (!succeeded && !cancelled) startPolling();
          });
        },
      });

    void refresh();

    return () => {
      cancelled = true;
      stopFeed();
      stopPolling();
    };
  }, [backendSlotKey, client, pollIntervalMs]);

  const sourceLabel = transport === "polling"
    ? "Live CMS · polling dự phòng"
    : transport === "sse"
      ? "Live CMS · change-feed"
      : "Live CMS · đang kết nối";

  // Optional public slots must be invisible until published content exists.
  // In particular, the homepage hero uses a grid-aligned fallback: inserting
  // an operational status paragraph before that fallback creates an extra grid
  // item and breaks the composition whenever CMS is unavailable.
  if (!content && hideWhenNotFound) {
    if (fallback === undefined) return <></>;
    return (
      <div
        className={className}
        data-cms-backend-slot={backendSlotKey}
        data-cms-live-slot={slotKey}
        data-cms-live-source="live-backend"
      >
        {fallback}
      </div>
    );
  }

  if (!content && fallback !== undefined) {
    return (
      <div
        aria-busy={hideWhenNotFound ? undefined : loading}
        aria-label={hideWhenNotFound ? undefined : `Nội dung live ${slotKey}`}
        className={className}
        data-cms-backend-slot={backendSlotKey}
        data-cms-live-slot={slotKey}
        data-cms-live-source="live-backend"
      >
        {error ? (
          <p className="cms-live-slot__fallback-note" role="status">
            {errorMessage(error)} Đang hiển thị giao diện có sẵn trong lúc CMS đồng bộ lại.
          </p>
        ) : null}
        {fallback}
      </div>
    );
  }

  if (content && renderContent) {
    return (
      <div
        aria-busy={hideWhenNotFound ? undefined : loading}
        aria-label={hideWhenNotFound ? undefined : `Nội dung live ${slotKey}`}
        className={className}
        data-cms-backend-slot={backendSlotKey}
        data-cms-live-slot={slotKey}
        data-cms-live-source="live-backend"
        data-cms-version={content.version}
      >
        {showSourceLabel && !hideWhenNotFound ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
            <span>{sourceLabel}</span>
            <span>Version {content.version}</span>
          </div>
        ) : null}
        {!hideWhenNotFound && error && content ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
            Đang hiển thị version {content.version} gần nhất; lần đồng bộ live tiếp theo sẽ thử lại.
          </p>
        ) : null}
        {!hideWhenNotFound && liveNotice ? <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">{liveNotice}</p> : null}
        {renderContent(content)}
      </div>
    );
  }

  return (
    <section
      aria-busy={hideWhenNotFound ? undefined : loading}
      aria-label={hideWhenNotFound ? undefined : `Nội dung live ${slotKey}`}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
      data-cms-live-source="live-backend"
      data-cms-live-slot={slotKey}
      data-cms-backend-slot={backendSlotKey}
    >
      {showSourceLabel && !hideWhenNotFound ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <span>{sourceLabel}</span>
          <span>{content ? `Version ${content.version}` : backendSlotKey}</span>
        </div>
      ) : null}

      {!hideWhenNotFound && error && !content ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert">
          {errorMessage(error)} Không có dữ liệu demo thay thế.
        </p>
      ) : null}

      {!hideWhenNotFound && error && content ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          Đang hiển thị version {content.version} gần nhất; lần đồng bộ live tiếp theo sẽ thử lại.
        </p>
      ) : null}

      {!hideWhenNotFound && liveNotice ? <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">{liveNotice}</p> : null}

      {!hideWhenNotFound && loading && !content ? <p className="text-sm text-slate-500" role="status">Đang tải nội dung live…</p> : null}
      {content ? <CmsSlotRenderer content={content} slotKey={slotKey} /> : null}
    </section>
  );
}

export default CmsLiveSlot;
