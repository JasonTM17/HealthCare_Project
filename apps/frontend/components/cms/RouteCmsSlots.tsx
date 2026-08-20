"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import CmsLiveSlot from "./CmsLiveSlot";

/**
 * Mounts supplemental, typed CMS extension points shared by public routes.
 * Native route content stays first so its page heading and primary composition
 * remain authoritative. The homepage and careers page own their hero/body
 * placements; the shared Footer owns every route's footer slot. Missing slots
 * disappear without inventing page content. Dynamic detail pages intentionally
 * share their top-level route key (for example `doctors.hero`) so the editor can
 * manage the collection without allowing arbitrary path segments into the CMS
 * key space.
 */
export function routeCmsSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const route = segments[0];
  // Keep private/authenticated workspaces out of the public CMS surface. Every
  // other route, including careers, is a valid footer composition target.
  if (["admin", "auth", "doctor", "patient"].includes(route)) return null;
  return route;
}

export function RouteCmsSlots(): ReactElement | null {
  const pathname = usePathname();
  const slug = routeCmsSlug(pathname);
  // Careers owns its hero/body composition. Its footer is still mounted by
  // the shared Footer, so this supplemental region is not rendered there.
  if (!slug || slug === "careers") return null;

  return (
    <section aria-label="Nội dung bổ sung do bệnh viện xuất bản" className="route-cms-slots">
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        hideWhileLoading
        showSourceLabel={false}
        slug={slug}
        slotKey="hero"
      />
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        hideWhileLoading
        showSourceLabel={false}
        slug={slug}
        slotKey="body"
      />
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        hideWhileLoading
        showSourceLabel={false}
        slug={slug}
        slotKey="sidebar"
      />
    </section>
  );
}

export default RouteCmsSlots;
