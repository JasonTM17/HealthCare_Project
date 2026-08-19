"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import CmsLiveSlot from "./CmsLiveSlot";

function routeCmsSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const route = segments[0];
  // Keep private/authenticated workspaces out of the public CMS surface. Every
  // other route, including catalog/detail and careers pages, is a valid public
  // composition target so an admin can publish the same route-level hero/body
  // contract across the whole patient-facing information architecture.
  if (["admin", "auth", "doctor", "patient"].includes(route)) return null;
  return route;
}

/**
 * Mounts the safe, typed CMS extension points shared by public routes.
 * Homepage keeps its intentionally composed slots in app/page.tsx; every
 * other public route gets route-scoped hero/body slots when an admin publishes
 * them. Missing slots disappear without inventing page content. Dynamic detail
 * pages intentionally share their top-level route key (for example
 * `doctors.hero`) so the editor can manage the collection without allowing
 * arbitrary path segments into the CMS key space.
 */
export function RouteCmsSlots(): ReactElement | null {
  const pathname = usePathname();
  const slug = routeCmsSlug(pathname);
  if (!slug) return null;

  return (
    <div aria-label="Các vùng nội dung live của trang" className="route-cms-slots">
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        showSourceLabel={false}
        slug={slug}
        slotKey="hero"
      />
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        showSourceLabel={false}
        slug={slug}
        slotKey="body"
      />
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        showSourceLabel={false}
        slug={slug}
        slotKey="sidebar"
      />
      <CmsLiveSlot
        className="route-cms-slot"
        hideWhenNotFound
        showSourceLabel={false}
        slug={slug}
        slotKey="footer"
      />
    </div>
  );
}

export default RouteCmsSlots;
