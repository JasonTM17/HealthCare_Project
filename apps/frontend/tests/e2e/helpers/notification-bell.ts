import type { Route } from "@playwright/test";

const NOTIFICATION_PATH = "/api/v1/notifications";
const EMPTY_PAGE = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 0,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

/**
 * Answer the portal/admin notification bell from a strict catch-all router.
 *
 * `Ultra Vòng 4` WS-B wired an in-app notification bell into every
 * authenticated shell: `components/PortalChrome.tsx` (patient + doctor) and
 * `app/admin/layout.tsx` (`AdminNotificationBell`). Each one reads page 0 of
 * `GET /api/v1/notifications` as soon as the shell mounts, so a spec that
 * stubs only the routes it models now sees one extra GET it never asked for.
 *
 * This mirrors `fulfillBackendWarmup`: it claims exactly that one request,
 * repeats the app's own no-browser-token invariant, and returns false for
 * anything else so the caller's unexpected-request oracle stays exhaustive.
 * Mark-read (`PUT /notifications/{id}/read`) is deliberately NOT answered here
 * — a spec that has not modelled it should still fail when it happens.
 */
export async function fulfillNotificationBell(route: Route): Promise<boolean> {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() !== "GET" || url.pathname !== NOTIFICATION_PATH) return false;
  if (request.headers().authorization) {
    throw new Error("Notification bell must not send a browser Authorization header");
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(EMPTY_PAGE),
  });
  return true;
}
