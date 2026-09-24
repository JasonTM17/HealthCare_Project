"use client";

import React, { useEffect, useState } from "react";
import Icon from "./UiIcon";

export default function OfflineNetworkIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Only execute on browser
    if (typeof window === "undefined" || !("onLine" in navigator)) {
      return;
    }

    // Initialize state
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    let timerId: NodeJS.Timeout | null = null;

    const handleOffline = () => {
      if (timerId) clearTimeout(timerId);
      setShowReconnected(false);
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      timerId = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  if (!isOffline && !showReconnected) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      className="no-print fixed top-0 left-0 right-0 z-[9999] px-4 py-2 text-xs font-semibold shadow-md transition-all duration-300"
      role="status"
      style={{
        backgroundColor: isOffline ? "#fffbeb" : "#ecfdf5",
        color: isOffline ? "#92400e" : "#065f46",
        borderBottom: isOffline ? "1px solid #fde68a" : "1px solid #a7f3d0",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <>
              <Icon name="alert-triangle" size={16} />
              <span>
                <strong>Mất kết nối Internet:</strong> Bạn đang ngoại tuyến. Hệ thống sẽ tự động đồng bộ khi đường truyền Wi-Fi hoặc 4G/5G được kết nối lại.
              </span>
            </>
          ) : (
            <>
              <Icon name="check" size={16} />
              <span>
                <strong>Đã khôi phục kết nối:</strong> Đường truyền Internet đã ổn định.
              </span>
            </>
          )}
        </div>
        <button
          aria-label="Đóng thông báo trạng thái mạng"
          className="px-2 py-0.5 rounded-[4px] hover:bg-black/5 text-current transition-colors text-[11px] font-bold"
          onClick={() => {
            setIsOffline(false);
            setShowReconnected(false);
          }}
          type="button"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
