import React from "react";

export interface BrandMarkProps {
  className?: string;
  size?: "compact" | "regular" | "hero";
  tagline?: string;
  tone?: "default" | "inverse";
}

/**
 * The HealthCare emblem combines a medical cross, a core and a vital-sign
 * line. It stays as inline SVG so the mark remains crisp at every screen size
 * and inherits the correct palette in the header, footer and intro screen.
 */
export default function BrandMark({
  className = "",
  size = "regular",
  tagline = "Bệnh viện đa khoa",
  tone = "default",
}: BrandMarkProps) {
  return (
    <span className={`brand-identity brand-identity--${size} brand-identity--${tone}${className ? ` ${className}` : ""}`}>
      <span className="brand-mark brand-emblem" aria-hidden="true">
        <svg focusable="false" viewBox="0 0 64 64">
          <path
            className="brand-emblem__shield"
            d="M24 6h16v10h10v16H40v16H24V32H14V16h10V6Z"
          />
          <path
            className="brand-emblem__heart"
            d="M28 22h8v8h8v8h-8v8h-8v-8h-8v-8h8v-8Z"
          />
          <path className="brand-emblem__pulse" d="M18 33h7l2.2-5 4.4 10 2.6-5h9.6" />
          <circle className="brand-emblem__signal" cx="35" cy="38" r="2.2" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong><span>Health</span><span>Care</span></strong>
        <small>{tagline}</small>
      </span>
    </span>
  );
}
