"use client";

import { useEffect, useState } from "react";

export type ChatWaitStage = "received" | "searching" | "connecting" | "preparing";

/**
 * Elapsed-time feedback for a bounded request. The client has no upstream
 * activity events, so a timer must not claim retrieval, connection or clinical
 * generation. Each stage ends when the result, error or cancellation arrives.
 */
export function useChatWaitStage(
  active: boolean,
  searchingAfterMs = 4_000,
  connectingAfterMs = 12_000,
  preparingAfterMs = 24_000,
): ChatWaitStage {
  const [stage, setStage] = useState<ChatWaitStage>("received");
  // Adjust state during render when the in-flight window flips (documented
  // React pattern for prop-derived state): every new request restarts at the
  // acknowledgment stage instead of keeping the previous run's stage.
  const [previousActive, setPreviousActive] = useState(active);
  if (active !== previousActive) {
    setPreviousActive(active);
    setStage("received");
  }

  useEffect(() => {
    if (!active) return;
    const tSearching = window.setTimeout(() => setStage("searching"), searchingAfterMs);
    const tConnecting = window.setTimeout(() => setStage("connecting"), connectingAfterMs);
    const tPreparing = window.setTimeout(() => setStage("preparing"), preparingAfterMs);
    return () => {
      window.clearTimeout(tSearching);
      window.clearTimeout(tConnecting);
      window.clearTimeout(tPreparing);
    };
  }, [active, searchingAfterMs, connectingAfterMs, preparingAfterMs]);

  return stage;
}

/**
 * Whole seconds elapsed while a request is in flight. The counter restarts on
 * every new request and only observes wall-clock waiting — it claims nothing
 * about upstream work.
 */
export function useChatWaitElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const [previousActive, setPreviousActive] = useState(active);
  if (active !== previousActive) {
    setPreviousActive(active);
    setElapsed(0);
  }

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(interval);
  }, [active]);

  return elapsed;
}

/** User-visible copy per stage; keep it natural Vietnamese and non-simulated. */
export const CHAT_WAIT_STAGE_COPY: Readonly<Record<ChatWaitStage, string>> = {
  received: "Đã nhận câu hỏi — đang chờ phản hồi…",
  searching: "Vẫn đang chờ máy chủ phản hồi…",
  connecting: "Phản hồi mất thêm thời gian. Bạn có thể dừng chờ.",
  preparing: "Thời gian chờ lâu hơn thường lệ. Bạn có thể dừng chờ và thử lại.",
};
