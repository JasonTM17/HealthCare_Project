interface HistoryNavigationEvent extends Event {
  navigationType: string;
  destination: { key: string; url: string; sameDocument: boolean };
}
interface HistoryNavigation extends EventTarget {
  traverseTo(key: string): { finished: Promise<unknown> };
}

/** Supplement anchor/unload guards without replacing Next's history handling. */
export function installAdminHistoryGuard({
  target = window,
  isBlocked,
  isBusy,
  onRequestLeave,
}: {
  target?: Window;
  isBlocked: () => boolean;
  isBusy: () => boolean;
  onRequestLeave: (proceed: () => void) => void;
}): { supported: boolean; dispose: () => void } {
  const navigation = (target as Window & { navigation?: HistoryNavigation }).navigation;
  if (!navigation) return { supported: false, dispose: () => {} };
  let bypass = false;
  const handle = (raw: Event) => {
    const event = raw as HistoryNavigationEvent;
    if (bypass || !isBlocked() || event.navigationType !== "traverse" || !event.destination.sameDocument || !event.cancelable) return;
    event.preventDefault();
    if (isBusy()) return;
    const key = event.destination.key;
    onRequestLeave(() => {
      bypass = true;
      void navigation.traverseTo(key).finished?.catch(() => { bypass = false; });
    });
  };
  navigation.addEventListener("navigate", handle);
  return { supported: true, dispose: () => navigation.removeEventListener("navigate", handle) };
}
