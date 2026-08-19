"use client";

import { useEffect, useState } from "react";
import BrandMark from "./BrandMark";

const FULL_INTRO_MS = 1080;
const FULL_EXIT_START_MS = 760;
const REDUCED_INTRO_MS = 160;
const REDUCED_EXIT_START_MS = 80;

export default function BrandSplash() {
  const [rendered, setRendered] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    if (root.dataset.brandIntro === "seen") {
      return;
    }

    root.dataset.brandIntro = "playing";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitStart = reducedMotion ? REDUCED_EXIT_START_MS : FULL_EXIT_START_MS;
    const finishAfter = reducedMotion ? REDUCED_INTRO_MS : FULL_INTRO_MS;

    const exitTimer = window.setTimeout(() => setLeaving(true), exitStart);
    const finishTimer = window.setTimeout(() => {
      root.dataset.brandIntro = "seen";
      setRendered(false);
    }, finishAfter);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  if (!rendered) return null;

  return (
    <div
      aria-atomic="true"
      aria-label="Đang mở trang Bệnh viện đa khoa HealthCare"
      aria-live="polite"
      className={`brand-splash${leaving ? " brand-splash--leaving" : ""}`}
      role="status"
    >
      <div className="brand-splash__halo" aria-hidden="true" />
      <div className="brand-splash__content">
        <BrandMark size="hero" tagline="Bệnh viện đa khoa" tone="inverse" />
        <p>Tận tâm chăm sóc · Vững vàng chuyên môn</p>
        <span className="brand-splash__care-line" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}
