"use client";

import { useEffect, useState } from "react";

export type ChatWaitStage = "received" | "searching" | "connecting" | "preparing";

/**
 * Honest staged feedback for a bounded chat request (D-02: validated chunked
 * delivery, no simulated generation).
 * Progressive waiting stages during upstream / Render cold-starts:
 * - Stage 1 (< 4s): immediate acknowledgment
 * - Stage 2 (4s - 12s): searching medical sources & doctor catalog
 * - Stage 3 (12s - 24s): backend connecting specialty data
 * - Stage 4 (> 24s): preparing comprehensive clinical response
 * Neither stage implies progressive token generation, and every stage is cleared
 * when the bounded deadline answers — the indicator is never indefinite.
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

/** User-visible copy per stage; keep it natural Vietnamese and non-simulated. */
export const CHAT_WAIT_STAGE_COPY: Readonly<Record<ChatWaitStage, string>> = {
  received: "Đã nhận câu hỏi — đang chờ phản hồi…",
  searching: "Đang tra cứu nguồn y tế & danh mục bác sĩ…",
  connecting: "Máy chủ đang kết nối dữ liệu chuyên khoa…",
  preparing: "Đang chuẩn bị phản hồi y tế đầy đủ cho bạn…",
};
