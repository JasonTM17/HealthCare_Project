"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
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
}: CmsLiveSlotProps): ReactElement {
  const backendSlotKey = resolveCmsSlotKey(slug, slotKey);
  const [content, setContent] = useState<CmsContent | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [transport, setTransport] = useState<LiveTransport>("connecting");
  const latestVersion = useRef(0);
  const latestEventId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempt = 0;
    let stopFeed: () => void = () => undefined;
    latestVersion.current = 0;
    latestEventId.current = 0;

    const refresh = async (): Promise<boolean> => {
      try {
        const nextContent = await client.getPublishedContent(backendSlotKey);
        if (cancelled || nextContent.status !== "PUBLISHED") return false;
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
      pollTimer = setInterval(() => void refresh(), Math.max(5_000, pollIntervalMs));
    };

    const stopPolling = (): void => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const scheduleReconnect = (): void => {
      if (cancelled || reconnectTimer) return;
      const delay = Math.min(30_000, 1_000 * (2 ** reconnectAttempt));
      reconnectAttempt = Math.min(reconnectAttempt + 1, 5);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        startFeed();
      }, delay);
    };

    const startFeed = (): void => {
      if (cancelled) return;
      setTransport("connecting");
      stopFeed = client.subscribeToChanges({
        after: latestEventId.current || undefined,
        onChange: (event) => {
          if (event.slotKey !== backendSlotKey || event.eventId <= latestEventId.current) return;
          if (event.version <= latestVersion.current) {
            latestEventId.current = event.eventId;
            return;
          }
          if (event.published) {
            void refresh().then((succeeded) => {
              if (succeeded && !cancelled) latestEventId.current = event.eventId;
            });
          } else {
            latestEventId.current = event.eventId;
            latestVersion.current = event.version;
            setContent(null);
            setError(new CmsApiError("not-found", 404, "Slot hiện không còn PUBLISHED."));
            setLoading(false);
          }
        },
        onConnected: () => {
          if (cancelled) return;
          reconnectAttempt = 0;
          stopPolling();
          setTransport("sse");
        },
        onFallback: () => {
          startPolling();
          scheduleReconnect();
        },
        onResync: (event) => {
          void refresh().then((succeeded) => {
            if (succeeded && !cancelled) latestEventId.current = Math.max(latestEventId.current, event.latestEventId);
          });
        },
      });
    };

    startFeed();

    void refresh();

    return () => {
      cancelled = true;
      stopFeed();
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [backendSlotKey, client, pollIntervalMs]);

  const sourceLabel = transport === "polling"
    ? "Live CMS · polling dự phòng"
    : transport === "sse"
      ? "Live CMS · change-feed"
      : "Live CMS · đang kết nối";

  if (hideWhenNotFound && !loading && !content && error instanceof CmsApiError && error.kind === "not-found") {
    return <></>;
  }

  return (
    <section
      aria-busy={loading}
      aria-label={`Nội dung live ${slotKey}`}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
      data-cms-live-source="live-backend"
      data-cms-live-slot={slotKey}
      data-cms-backend-slot={backendSlotKey}
    >
      {showSourceLabel ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <span>{sourceLabel}</span>
          <span>{content ? `Version ${content.version}` : backendSlotKey}</span>
        </div>
      ) : null}

      {error && !content ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert">
          {errorMessage(error)} Không có dữ liệu demo thay thế.
        </p>
      ) : null}

      {error && content ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          Đang hiển thị version {content.version} gần nhất; lần đồng bộ live tiếp theo sẽ thử lại.
        </p>
      ) : null}

      {loading && !content ? <p className="text-sm text-slate-500" role="status">Đang tải nội dung live…</p> : null}
      {content ? <CmsSlotRenderer content={content} slotKey={slotKey} /> : null}
    </section>
  );
}

export default CmsLiveSlot;
