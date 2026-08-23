import type { ReactNode } from "react";

/** Metadata-only route layouts use this passthrough without adding wrapper DOM. */
export default function PublicRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
