import type { ConsultationAttachment } from "../types/hospital";

function abortError(): DOMException {
  return new DOMException("Request cancelled", "AbortError");
}

export function waitForAttachmentPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const cancel = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

/** Bounded metadata-only polling. A network failure can never imply CLEAN. */
export async function pollConsultationAttachments(options: {
  ids: string[];
  signal: AbortSignal;
  fetchStatus: (id: string, signal: AbortSignal) => Promise<ConsultationAttachment>;
  onUpdate: (items: ConsultationAttachment[]) => void;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<"complete" | "pending"> {
  const remaining = new Set(options.ids);
  const attempts = Math.max(1, Math.min(60, options.maxAttempts ?? 30));
  for (let attempt = 0; remaining.size && attempt < attempts; attempt += 1) {
    if (options.signal.aborted) throw abortError();
    const ids = [...remaining];
    const results = await Promise.allSettled(ids.map((id) => options.fetchStatus(id, options.signal)));
    if (options.signal.aborted) throw abortError();
    const updates: ConsultationAttachment[] = [];
    results.forEach((result, index) => {
      if (result.status !== "fulfilled" || result.value.id !== ids[index]
          || !["PENDING", "CLEAN", "REJECTED"].includes(result.value.scanStatus)) return;
      updates.push(result.value);
      if (result.value.scanStatus !== "PENDING") remaining.delete(ids[index]);
    });
    if (updates.length) options.onUpdate(updates);
    if (remaining.size && attempt < attempts - 1) {
      await waitForAttachmentPoll(options.delayMs ?? 2000, options.signal);
    }
  }
  return remaining.size ? "pending" : "complete";
}
