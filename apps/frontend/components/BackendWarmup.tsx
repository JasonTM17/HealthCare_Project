"use client";

import { useEffect } from "react";

/**
 * Invisible background warmup component.
 * When a user loads any page, this component triggers a lightweight background request
 * to the same-origin BFF. This notifies Render to immediately awaken the container from
 * hibernation (cold start), ensuring by the time the user clicks "Đăng nhập" or "Đặt lịch",
 * the Spring Boot backend is already hot and responsive.
 */
export default function BackendWarmup() {
  useEffect(() => {
    // Wait 1200ms so we never compete with critical page hydration or metrics
    const timer = setTimeout(() => {
      try {
        fetch("/api/v1/public/ai/policy", {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        }).catch(() => {
          // Swallow any warmup errors quietly
        });
      } catch {
        // Ignore
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
