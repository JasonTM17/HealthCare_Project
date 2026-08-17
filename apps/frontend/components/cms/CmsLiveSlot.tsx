"use client";

import { useEffect, useRef, useState } from "react";
import {
  CmsApiError,
  CmsClient,
  defaultCmsClient,
  type CmsPage,
  type CmsSlotKey,
} from "../../lib/cms-client";
import { CmsSlotRenderer } from "./CmsRenderer";

export interface CmsLiveSlotProps {
  slug: string;
  slotKey: CmsSlotKey;
  client?: CmsClient;
  pollIntervalMs?: number;
  className?: string;
  showSourceLabel?: boolean;
}

type LiveTransport = "connecting" | "sse" | "polling";

function errorMessage(error: unknown): string {
  if (error instanceof CmsApiError && error.kind === "not-found") {
    return "Chưa có nội dung live cho slot này.";
  }
  if (error instanceof CmsApiError && error.kind === "auth") {
    return "CMS yêu cầu xác thực để đọc nội dung live.";
  }
  if (error instanceof CmsApiError && error.kind === "forbidden") {
    return "Bạn không có quyền đọc nội dung live này.";
  }
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
}: CmsLiveSlotProps): React.ReactElement {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [transport, setTransport] = useState<LiveTransport>("connecting");
  const latestVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    latestVersion.current = 0;

    const refresh = async (): Promise<void> => {
      try {
        const nextPage = await client.getPublishedPage(slug);
        if (cancelled || nextPage.state !== "PUBLISHED") return;
        if (nextPage.version >= latestVersion.current) {
          latestVersion.current = nextPage.version;
          setPage(nextPage);
        }
        setError(null);
      } catch (nextError) {
        if (!cancelled) setError(nextError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const startPolling = (): void => {
      if (cancelled || pollTimer) return;
      setTransport("polling");
      const interval = Math.max(5_000, pollIntervalMs);
      pollTimer = setInterval(() => void refresh(), interval);
    };

    const stopFeed = client.subscribeToChanges(slug, {
      onChange: (event) => {
        if (event.page && event.page.state === "PUBLISHED" && event.version >= latestVersion.current) {
          latestVersion.current = event.version;
          setPage(event.page);
          setError(null);
          setLoading(false);
          return;
        }
        void refresh();
      },
      onConnected: () => {
        if (!cancelled) setTransport("sse");
      },
      onFallback: startPolling,
      sinceVersion: latestVersion.current || undefined,
    });

    void refresh();

    return () => {
      cancelled = true;
      stopFeed();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [client, pollIntervalMs, slug]);

  const sourceLabel = transport === "polling"
    ? "Live CMS · polling dự phòng"
    : transport === "sse"
      ? "Live CMS · change-feed"
      : "Live CMS · đang kết nối";

  return (
    <section
      aria-busy={loading}
      aria-label={`Nội dung live ${slotKey}`}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
      data-cms-live-source="live-backend"
      data-cms-live-slot={slotKey}
      data-cms-slug={slug}
    >
      {showSourceLabel ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
          <span>{sourceLabel}</span>
          {page ? <span>Version {page.version}</span> : null}
        </div>
      ) : null}

      {error && !page ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert">
          {errorMessage(error)} Không có dữ liệu demo thay thế.
        </p>
      ) : null}

      {error && page ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          Nội dung đang hiển thị là version {page.version} gần nhất; lần cập nhật live tiếp theo sẽ thử lại.
        </p>
      ) : null}

      {loading && !page ? (
        <p className="text-sm text-slate-500" role="status">
          Đang tải nội dung live…
        </p>
      ) : null}

      {page ? (
        <CmsSlotRenderer components={page.slots[slotKey]} slotKey={slotKey} />
      ) : null}
    </section>
  );
}

export default CmsLiveSlot;
