import type { Route } from "@playwright/test";

export async function fulfillBackendWarmup(route: Route): Promise<boolean> {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() !== "GET" || url.pathname !== "/api/v1/health") return false;
  if (request.headers().authorization) {
    throw new Error("Backend warmup must not send a browser Authorization header");
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "ok", service: "healthcare-backend", ai_ready: true }),
  });
  return true;
}
