"use client";

import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { CMS_PUBLIC_ROUTE_SLUGS } from "../../lib/cms-client";
import CmsLiveSlot from "./CmsLiveSlot";

// A published component is a deliberate public-page contract, not a catch-all
// for arbitrary first path segments. CmsEditor uses the same exported list.
const PUBLIC_CMS_ROUTES: ReadonlySet<string> = new Set(CMS_PUBLIC_ROUTE_SLUGS);

/**
 * Places typed CMS regions inside the public route frame rather than appending
 * a generic block after the page. The native route composition remains
 * authoritative, including its page heading. The homepage and careers page own
 * their custom hero/body placements; the shared Footer owns every route's
 * footer slot. Missing slots disappear without inventing page content.
 */
export function routeCmsSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const route = segments[0];
  // Dynamic detail paths intentionally share their canonical family key (for
  // example `doctors.hero`) so one editor surface controls the collection.
  // Compatibility aliases redirect before this public frame is rendered.
  return PUBLIC_CMS_ROUTES.has(route) ? route : null;
}

export function RouteCmsSlots({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const slug = routeCmsSlug(pathname);
  // Careers owns its hero/body composition. Its footer is still mounted by
  // the shared Footer, so the standard frame preserves its native layout.
  if (!slug || slug === "careers") return <>{children}</>;

  return (
    <div className={`native-route-cms native-route-cms--${slug}`} data-cms-route={slug}>
      <section aria-label="Nội dung đầu trang do bệnh viện xuất bản" className="native-route-cms__hero">
        <CmsLiveSlot
          className="native-route-cms__slot native-route-cms__hero-slot"
          hideWhenNotFound
          hideWhileLoading
          showSourceLabel={false}
          slug={slug}
          slotKey="hero"
        />
      </section>

      <div className="native-route-cms__content">{children}</div>

      <section aria-label="Nội dung hỗ trợ do bệnh viện xuất bản" className="native-route-cms__support">
        <CmsLiveSlot
          className="native-route-cms__slot native-route-cms__body"
          hideWhenNotFound
          hideWhileLoading
          showSourceLabel={false}
          slug={slug}
          slotKey="body"
        />
        <aside aria-label="Thông tin bên lề do bệnh viện xuất bản" className="native-route-cms__sidebar">
          <CmsLiveSlot
            className="native-route-cms__slot native-route-cms__sidebar-slot"
            hideWhenNotFound
            hideWhileLoading
            showSourceLabel={false}
            slug={slug}
            slotKey="sidebar"
          />
        </aside>
      </section>
    </div>
  );
}

export default RouteCmsSlots;
