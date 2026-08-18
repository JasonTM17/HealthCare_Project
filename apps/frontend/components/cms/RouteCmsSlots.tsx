"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import CmsLiveSlot from "./CmsLiveSlot";

function routeCmsSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const route = segments[0];
  if (["admin", "auth", "doctor", "patient", "careers"].includes(route)) return null;
  if (["bac-si", "chuyen-khoa", "goi-kham"].includes(route)) return null;
  return route;
}

/**
 * Mounts the safe, typed CMS extension points shared by public routes.
 * Homepage keeps its intentionally composed slots in app/page.tsx; every
 * other public route gets route-scoped hero/body slots when an admin publishes
 * them. Missing slots disappear without inventing page content.
 */
export function RouteCmsSlots(): ReactElement | null {
  const pathname = usePathname();
  const slug = routeCmsSlug(pathname);
  if (!slug) return null;

  return (
    <>
      <CmsLiveSlot
        className="route-cms-slots"
        hideWhenNotFound
        showSourceLabel={false}
        slug={slug}
        slotKey="hero"
      />
      <CmsLiveSlot
        className="route-cms-slots"
        hideWhenNotFound
        showSourceLabel={false}
        slug={slug}
        slotKey="body"
      />
    </>
  );
}

export default RouteCmsSlots;
