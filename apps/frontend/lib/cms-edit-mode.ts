"use client";

/**
 * Tiny external store for the admin-only inline CMS edit mode. Kept separate
 * from React so both the toolbar (the only writer) and every CmsLiveSlot
 * (readers) subscribe through `useSyncExternalStore` without prop drilling.
 *
 * The flag is a per-tab UI preference (sessionStorage): it never carries
 * content, credentials, or identifiers, and the store never touches storage
 * during module init or server rendering — the first render is always "off"
 * and the toolbar hydrates the persisted value from an effect.
 */

const STORAGE_KEY = "healthcare.cms-edit-mode";

let hydrated = false;
let enabled = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function readPersisted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Subscribe to edit-mode changes. Returns the unsubscribe function. */
export function subscribeCmsEditMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot for useSyncExternalStore. "Off" until the toolbar hydrates. */
export function isCmsEditModeEnabled(): boolean {
  return enabled;
}

/** Toolbar-only: read the persisted value once and publish it. */
export function hydrateCmsEditMode(): void {
  if (hydrated) return;
  hydrated = true;
  const persisted = readPersisted();
  if (persisted !== enabled) {
    enabled = persisted;
    notify();
  }
}

/** Toolbar-only: flip the mode and persist the per-tab preference. */
export function setCmsEditMode(next: boolean): void {
  hydrated = true;
  enabled = next;
  if (typeof window !== "undefined") {
    try {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, "1");
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // A private-mode storage refusal only costs the persistence of a
      // per-tab UI preference, never correctness.
    }
  }
  notify();
}

// ---------------------------------------------------------------------------
// Client-mount flag. Admin-only affordances depend on client-only state, so
// they must not exist in the server HTML. Components read this through
// useSyncExternalStore and one component calls `markClientMounted()` from an
// effect — no synchronous setState, no hydration mismatch.
// ---------------------------------------------------------------------------

let clientMounted = false;
const mountedListeners = new Set<() => void>();

/** Subscribe for the client-mount flip. */
export function subscribeClientMounted(listener: () => void): () => void {
  mountedListeners.add(listener);
  return () => mountedListeners.delete(listener);
}

/** Snapshot for useSyncExternalStore: false on the server, true after mount. */
export function isClientMounted(): boolean {
  return clientMounted;
}

/** Call once from an effect after hydration completes. */
export function markClientMounted(): void {
  if (clientMounted) return;
  clientMounted = true;
  for (const listener of mountedListeners) listener();
}

// ---------------------------------------------------------------------------
// Save-flash: a short "Đã lưu" confirmation the toolbar shows after an inline
// save. Lives here (not in slot-local state) so one global chip covers every
// slot branch, and the notification survives the slot's refetch cycle that
// would immediately wipe a component-local flag.
// ---------------------------------------------------------------------------

const SAVE_FLASH_MS = 2500;
let saveFlashSlot: string | null = null;
let saveFlashTimer: ReturnType<typeof setTimeout> | undefined;
const saveFlashListeners = new Set<() => void>();

/** Snapshot: the slot key currently flashing, or null. */
export function cmsSaveFlashSlot(): string | null {
  return saveFlashSlot;
}

export function subscribeCmsSaveFlash(listener: () => void): () => void {
  saveFlashListeners.add(listener);
  return () => saveFlashListeners.delete(listener);
}

/** CmsLiveSlot calls this after a successful inline save. */
export function publishCmsSaveFlash(slotKey: string): void {
  saveFlashSlot = slotKey;
  if (saveFlashTimer) clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(() => {
    saveFlashSlot = null;
    for (const listener of saveFlashListeners) listener();
  }, SAVE_FLASH_MS);
  for (const listener of saveFlashListeners) listener();
}
