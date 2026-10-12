"use client";

import Image from "next/image";
import { useState } from "react";
import { getPackageVisual } from "../lib/package-visuals";
import type { HealthPackage } from "../types/hospital";

// Callers key by package identity and image URL to reset failures on edits.
export default function PackageImage({ packageItem, className, sizes, priority = false, creditClassName = "sr-only" }: {
  packageItem: HealthPackage; className: string; sizes: string; priority?: boolean; creditClassName?: string;
}) {
  const [phase, setPhase] = useState(0);
  const initial = getPackageVisual(packageItem);
  const fallback = getPackageVisual({ ...packageItem, imageUrl: null });
  const visual = phase === 0 ? initial : fallback;
  if (phase === 2) return <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-4 text-center text-sm text-slate-600" role="status">Ảnh minh họa chưa tải được</div>;
  return <>
    <Image key={visual.imageSrc} alt={visual.imageAlt} className={className} fill priority={priority} sizes={sizes} src={visual.imageSrc}
      onError={() => setPhase((current) => current !== phase ? current : current === 0 && initial.imageSrc !== fallback.imageSrc ? 1 : 2)} />
    <figcaption className={creditClassName}>Ảnh minh họa: {visual.sourceHref && creditClassName !== "sr-only"
      ? <a href={visual.sourceHref} rel="noreferrer" target="_blank">{visual.sourceLabel}</a> : visual.sourceLabel}</figcaption>
  </>;
}
