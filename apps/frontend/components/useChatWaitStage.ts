"use client";

import { useEffect, useState } from "react";

export type ChatWaitStage = "received" | "searching";

/**
 * Honest staged feedback for a bounded chat request (D-02: validated chunked
 * delivery, no simulated generation). "received" is the immediate (<1s)
 * acknowledgment; "searching" replaces it once the request has been in flight
 * for a few seconds and a real answer is still plausible. Neither stage
 * implies progressive token generation, and every stage is cleared when the
 * bounded deadline answers — the indicator is never indefinite.
 */
export function useChatWaitStage(active: boolean, searchingAfterMs = 4_000): ChatWaitStage {
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
    const timer = window.setTimeout(() => setStage("searching"), searchingAfterMs);
    return () => window.clearTimeout(timer);
  }, [active, searchingAfterMs]);

  return stage;
}

/** User-visible copy per stage; keep it natural Vietnamese and non-simulated. */
export const CHAT_WAIT_STAGE_COPY: Readonly<Record<ChatWaitStage, string>> = {
  received: "Đã nhận câu hỏi — đang chờ phản hồi…",
  searching: "Đang tra cứu nguồn y tế…",
};
