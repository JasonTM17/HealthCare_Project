"use client";

import { useEffect, useState } from "react";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const updateProgress = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) {
        setProgress(0);
        ticking = false;
        return;
      }
      const currentScroll = window.scrollY;
      const currentProgress = Math.min(100, Math.max(0, (currentScroll / totalHeight) * 100));
      setProgress(currentProgress);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="reading-progress-track"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "3.5px",
        backgroundColor: "rgba(226, 232, 240, 0.5)",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        className="reading-progress-indicator"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tiến trình đọc bài viết"
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #004b50 0%, #0d9488 50%, #14b8a6 100%)",
          transition: "width 80ms ease-out",
        }}
      />
    </div>
  );
}
