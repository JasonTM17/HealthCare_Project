/**
 * Bounded background refresh for the authenticated notification bell.
 *
 * The bell used to load once per mount, so an unread badge on an already-open
 * doctor/admin tab only advanced after a navigation. This is the same
 * self-rescheduling shape `components/cms/CmsLiveSlot.tsx` uses for its polling
 * fallback — one pending timer at a time, a tick that re-arms itself only after
 * the previous fetch settles, and the same 5s floor — so a slow or failing
 * request can never stack a second request on top of it.
 *
 * It stays DOM-free (timers, clock and hidden-state probe are injected) so the
 * pause/cooldown behaviour is unit-testable, like `consultation-attachment-polling.ts`.
 */

/** Matches the CMS live-slot default: quiet enough to leave running all shift. */
export const NOTIFICATION_POLL_INTERVAL_MS = 15_000;
export const MIN_NOTIFICATION_POLL_INTERVAL_MS = 5_000;
export const MAX_NOTIFICATION_POLL_INTERVAL_MS = 300_000;

export interface NotificationPollTimers {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface NotificationPollOptions {
  /** One refresh pass. Rejections are swallowed: the next tick retries. */
  tick: () => unknown;
  timers: NotificationPollTimers;
  now?: () => number;
  intervalMs?: number;
  /** Defaults to the caller's `setPaused` wiring; a hidden tab never fetches. */
  hidden?: () => boolean;
}

export interface NotificationPollController {
  /** Mirrors `document.hidden`: pausing cancels the pending tick, resuming re-arms it. */
  setPaused(paused: boolean): void;
  stop(): void;
}

export function startNotificationPoll(options: NotificationPollOptions): NotificationPollController {
  const now = options.now ?? ((): number => Date.now());
  const isHidden = options.hidden ?? ((): boolean => false);
  const intervalMs = Math.min(
    MAX_NOTIFICATION_POLL_INTERVAL_MS,
    Math.max(MIN_NOTIFICATION_POLL_INTERVAL_MS, options.intervalMs ?? NOTIFICATION_POLL_INTERVAL_MS),
  );
  // The mount fetch already counted as tick zero, so the first poll lands a full
  // interval later instead of re-reading data the shell just loaded.
  let lastTickAt = now();
  let timer: unknown = null;
  let inFlight = false;
  let paused = false;
  let stopped = false;

  const clearPending = (): void => {
    if (timer === null) return;
    options.timers.cancel(timer);
    timer = null;
  };

  const arm = (delayMs: number): void => {
    if (stopped || paused || timer !== null) return;
    timer = options.timers.schedule(() => {
      timer = null;
      void run();
    }, Math.max(0, delayMs));
  };

  async function run(): Promise<void> {
    if (stopped || inFlight) return;
    if (paused || isHidden()) {
      clearPending();
      return;
    }
    inFlight = true;
    try {
      await options.tick();
      lastTickAt = now();
    } catch {
      // A failed pass keeps the last known badge, exactly like the initial load.
    } finally {
      inFlight = false;
    }
    arm(intervalMs);
  }

  return {
    /**
     * The cooldown is wall time since the last successful read, so time spent
     * hidden still ages the badge: resuming inside the window waits out what is
     * left of it instead of firing early or double-ticking.
     */
    setPaused(nextPaused: boolean): void {
      paused = nextPaused;
      if (nextPaused || stopped) {
        clearPending();
        return;
      }
      arm(intervalMs - (now() - lastTickAt));
    },
    stop(): void {
      stopped = true;
      clearPending();
    },
  };
}
