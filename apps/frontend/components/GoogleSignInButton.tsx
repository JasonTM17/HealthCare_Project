"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./google-sign-in.module.css";

// Google Identity Services (GIS). Renders the official sign-in button only
// when a Web client id is configured at build time — an unset env fails
// invisible (the component renders nothing), never a dead button.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client?hl=vi";
const SCRIPT_TIMEOUT_MS = 12_000;

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: string;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

interface Props {
  /** Receives the GIS credential (ID token) to exchange for a session. */
  onCredential: (credential: string) => void;
  /** Blocks both pointer and keyboard interaction during authentication. */
  busy?: boolean;
}

export function isGoogleSignInEnabled(): boolean {
  return GOOGLE_CLIENT_ID !== null;
}

export default function GoogleSignInButton({ onCredential, busy = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  // Stable ref so the GIS callback always sees the latest handler without
  // re-running the loader effect.
  const handlerRef = useRef(onCredential);
  useEffect(() => {
    handlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let lastWidth = 0;
    let script: HTMLScriptElement | null = null;
    const timer = window.setTimeout(() => failed(), SCRIPT_TIMEOUT_MS);
    const failed = () => {
      if (cancelled) return;
      window.clearTimeout(timer);
      if (script?.dataset.healthcareGis) script.dataset.healthcareGis = "failed";
      setStatus("failed");
    };
    const initialize = () => {
      const googleId = window.google?.accounts?.id;
      if (cancelled) return;
      if (!googleId) { failed(); return; }
      const container = containerRef.current;
      if (!container) return;
      try {
        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          callback: (response) => {
            if (!cancelled && !busyRef.current) handlerRef.current(response.credential ?? "");
          },
        });
        const render = () => {
          if (cancelled) return;
          const width = Math.min(Math.floor(container.getBoundingClientRect().width), 400);
          if (width <= 0 || width === lastWidth) return;
          try {
            container.replaceChildren();
            googleId.renderButton(container, {
              type: "standard", theme: "outline", size: "large",
              shape: "rectangular", text: "signin_with", locale: "vi", width,
            });
            lastWidth = width;
            window.clearTimeout(timer);
            if (script?.dataset.healthcareGis) script.dataset.healthcareGis = "ready";
            setStatus("ready");
          } catch { failed(); }
        };
        render();
        observer = new ResizeObserver(render);
        observer.observe(container);
      } catch { failed(); }
    };
    const cleanup = () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      script?.removeEventListener("load", initialize);
      script?.removeEventListener("error", failed);
    };
    if (window.google?.accounts?.id) {
      initialize();
    } else {
      script = document.querySelector<HTMLScriptElement>('script[src^="https://accounts.google.com/gsi/client"]');
      // Only replace our own failed script; other GIS users retain ownership.
      if (script?.dataset.healthcareGis === "failed") {
        script.remove();
        script = null;
      }
      const newScript = !script;
      if (!script) {
        script = document.createElement("script");
        script.src = GIS_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.dataset.healthcareGis = "loading";
      }
      script.addEventListener("load", initialize, { once: true });
      script.addEventListener("error", failed, { once: true });
      if (newScript) document.head.appendChild(script);
    }
    return cleanup;
  }, [loadAttempt]);

  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className={styles.provider}>
      <div className={styles.buttonSlot} data-state={status}>
        <div className={styles.googleButton} ref={containerRef} inert={busy || status !== "ready"} aria-hidden={status !== "ready"} />
        {status === "loading" ? <p className={styles.loading} role="status">Đang tải đăng nhập Google…</p> : null}
      </div>
      {status === "ready" && !busy ? <p className={styles.hint}>Chọn tài khoản Google trong cửa sổ mở ra để tiếp tục.</p> : null}
      {status === "failed" ? (
        <div className={styles.unavailable}>
          <p role="status">Chưa kết nối được với Google. Bạn có thể thử lại hoặc dùng email và mật khẩu.</p>
          <button className={styles.retry} type="button" disabled={busy} onClick={() => { setStatus("loading"); setLoadAttempt(value => value + 1); }}>Thử tải lại Google</button>
        </div>
      ) : null}
    </div>
  );
}
