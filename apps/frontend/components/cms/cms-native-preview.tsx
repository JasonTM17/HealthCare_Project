"use client";

import { useEffect, useRef, useState } from "react";
import { CMS_PREVIEW_PROTOCOL, cmsPreviewUrl, parseCmsPreviewFrameMessage } from "../../lib/cms-preview-bridge";
import { parseCmsPageLayout, type CmsLayoutValue, type CmsPageLayout } from "../../lib/cms-page-layout";
import type { CmsPageIdentity } from "../../lib/cms-page-manifest";
import { randomId } from "../../lib/secure-random";
import styles from "./cms-workspace.module.css";

export function CmsNativePreview({ identity, layout, mode, onSelected, focusFieldId, focusNonce = 0 }: { identity: CmsPageIdentity; layout: CmsPageLayout; mode: "draft" | "published"; onSelected: (id: string, nativeValue: CmsLayoutValue) => void; focusFieldId?: string | null; focusNonce?: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const revision = useRef(0);
  const ready = useRef(false);
  const [channel, setChannel] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [frameReady, setFrameReady] = useState(false);
  const [notice, setNotice] = useState("Đang mở bản xem trước…");
  const manualWidth = useRef(false);
  const [width, setWidth] = useState(375);
  const [available, setAvailable] = useState(600);
  const height = width === 375 ? 812 : width === 768 ? 1024 : 900;
  const scale = Math.min(1, available / width);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) { revision.current = 0; ready.current = false; setFrameReady(false); setChannel(randomId()); setNotice("Đang mở bản xem trước…"); }
    });
    return () => { cancelled = true; };
  }, [epoch]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const chooseDevice = () => {
      if (!manualWidth.current) setWidth(window.innerWidth < 640 ? 375 : window.innerWidth < 1024 ? 768 : 1440);
    };
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(Math.max(1, entry.contentRect.width));
      chooseDevice();
    });
    // Restore a deliberate device choice after hydration; the server never reads browser state.
    try {
      const stored = Number(window.sessionStorage.getItem("cms-preview-width"));
      if ([375, 768, 1440].includes(stored)) { manualWidth.current = true; queueMicrotask(() => setWidth(stored)); }
    } catch { /* A blocked storage policy still allows this session's device controls. */ }
    observer.observe(element);
    window.addEventListener("resize", chooseDevice);
    return () => { observer.disconnect(); window.removeEventListener("resize", chooseDevice); };
  }, []);
  useEffect(() => {
    if (!channel) return;
    const receive = (event: MessageEvent) => {
      const message = parseCmsPreviewFrameMessage(event, { origin: window.location.origin, source: frame.current?.contentWindow ?? null, identity, channel, currentRevision: revision.current });
      if (!message) return;
      if (message.type === "ready") {
        if (ready.current) return;
        ready.current = true; setFrameReady(true); setNotice("Chọn văn bản hoặc ảnh trong trang để chỉnh sửa.");
      } else if (message.type === "selected" && mode === "draft") {
        onSelected(message.fieldId, message.nativeValue);
      } else if (message.type === "blocked") setNotice("Thao tác nghiệp vụ được tắt trong bản xem trước. Mở trang công khai để sử dụng.");
    };
    window.addEventListener("message", receive);
    const timer = window.setTimeout(() => { if (!ready.current) setNotice("Chưa kết nối được bản nháp. Kiểm tra phiên quản trị và thử tải lại."); }, 20_000);
    return () => { window.removeEventListener("message", receive); window.clearTimeout(timer); };
  }, [channel, identity, mode, onSelected]);
  useEffect(() => {
    if (!channel || !frameReady || !ready.current) return;
    try {
      const safe = parseCmsPageLayout(layout, identity);
      revision.current += 1;
      frame.current?.contentWindow?.postMessage({ protocol: CMS_PREVIEW_PROTOCOL, channel, slotKey: identity.slotKey, path: identity.canonicalPath, type: "render", mode, layout: safe, revision: revision.current }, window.location.origin);
    } catch { /* Invalid inspector buffers stay visible in the host, never in the frame. */ }
  }, [channel, frameReady, identity, layout, mode]);
  useEffect(() => {
    if (!channel || !frameReady || !focusFieldId || focusNonce === 0 || !ready.current || mode !== "draft") return;
    revision.current += 1;
    frame.current?.contentWindow?.postMessage({ protocol: CMS_PREVIEW_PROTOCOL, channel, slotKey: identity.slotKey, path: identity.canonicalPath, type: "focus", fieldId: focusFieldId, revision: revision.current }, window.location.origin);
  }, [channel, frameReady, focusFieldId, focusNonce, identity, mode]);
  return <section className={styles.preview} aria-label="Bản xem trước trang thật">
    <div className={styles.previewToolbar}>
      <label>Thiết bị <select data-testid="cms-preview-width" value={width} onChange={(event) => {
        const chosen = Number(event.target.value);
        manualWidth.current = true; setWidth(chosen);
        try { window.sessionStorage.setItem("cms-preview-width", String(chosen)); } catch { /* Optional preference persistence. */ }
      }}><option value={375}>Điện thoại · 375</option><option value={768}>Máy tính bảng · 768</option><option value={1440}>Máy tính · 1440</option></select></label>
      <span>{width}px · {Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => setEpoch((value) => value + 1)}>Tải lại</button>
      <a href={identity.canonicalPath} target="_blank" rel="noreferrer">Mở trang công khai ↗</a>
    </div>
    <p className={styles.previewNotice} role="status">{notice}</p>
    <div className={styles.previewCanvas} ref={container}>
      <div style={{ width: width * scale, height: height * scale, margin: "0 auto", position: "relative" }}>
        {channel ? <iframe key={channel} data-testid="cms-preview-frame" ref={frame} src={cmsPreviewUrl(identity, channel)} title={`Xem trước ${identity.manifest.label}`} sandbox="allow-scripts allow-same-origin" style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, display: "block" }} /> : null}
      </div>
    </div>
  </section>;
}
