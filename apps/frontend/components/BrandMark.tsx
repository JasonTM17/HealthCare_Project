import React from "react";

export interface BrandMarkProps {
  className?: string;
  size?: "compact" | "regular" | "hero";
  tagline?: string;
  tone?: "default" | "inverse";
}

/**
 * The HealthCare emblem combines a protective shield, a heart and a vital-sign
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
            d="M32 4.5 54 12v17.3c0 14.2-8.8 24.1-22 30.2-13.2-6.1-22-16-22-30.2V12L32 4.5Z"
          />
          <path
            className="brand-emblem__heart"
            d="M32 46.6C23.5 41.2 17 35.7 17 27.9c0-5.2 3.8-9 8.8-9 2.7 0 5 1.3 6.2 3.4 1.2-2.1 3.5-3.4 6.2-3.4 5 0 8.8 3.8 8.8 9 0 7.8-6.5 13.3-15 18.7Z"
          />
          <path className="brand-emblem__pulse" d="M18.2 31.2h7.1l3-6.1 5.6 13.1 3.5-7h8.4" />
          <circle className="brand-emblem__signal" cx="34" cy="38.2" r="2.2" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong><span>Health</span><span>Care</span></strong>
        <small>{tagline}</small>
      </span>
    </span>
  );
}
