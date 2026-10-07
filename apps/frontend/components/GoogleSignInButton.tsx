"use client";

import { useEffect, useRef, useState } from "react";

// Google Identity Services (GIS). Renders the official sign-in button only
// when a Web client id is configured at build time — an unset env fails
// invisible (the component renders nothing), never a dead button.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

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
  /** While true the button is visually dimmed and click-through is blocked. */
  busy?: boolean;
}

export function isGoogleSignInEnabled(): boolean {
  return GOOGLE_CLIENT_ID !== null;
}

export default function GoogleSignInButton({ onCredential, busy = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  // Stable ref so the GIS callback always sees the latest handler without
  // re-running the loader effect.
  const handlerRef = useRef(onCredential);
  useEffect(() => {
    handlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    const initialize = () => {
      const googleId = window.google?.accounts?.id;
      if (!googleId || cancelled) return;
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: "popup",
        callback: (response) => handlerRef.current(response.credential ?? ""),
      });
      const container = containerRef.current;
      if (container) {
        container.innerHTML = "";
        googleId.renderButton(container, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          locale: "vi",
          width: Math.min(container.offsetWidth || 320, 400),
        });
      }
    };
    if (window.google?.accounts?.id) {
      initialize();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", initialize, { once: true });
      return () => {
        cancelled = true;
        existing.removeEventListener("load", initialize);
      };
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initialize, { once: true });
    script.addEventListener("error", () => setScriptFailed(true), { once: true });
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      script.removeEventListener("load", initialize);
    };
  }, []);

  if (!GOOGLE_CLIENT_ID || scriptFailed) return null;

  return (
    <div
      aria-label="Đăng nhập bằng Google"
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "center",
        minHeight: 44,
        ...(busy ? { pointerEvents: "none", opacity: 0.6 } : {}),
      }}
    />
  );
}
