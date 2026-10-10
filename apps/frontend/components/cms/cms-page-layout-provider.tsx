"use client";

import Image, { type ImageProps } from "next/image";
import { Children, createContext, createElement, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { hasRole, hydrateAuthSession, readAuthSession } from "../../lib/api-client";
import { cmsLayoutClient, fetchPublishedCmsLayout } from "../../lib/cms-layout-client";
import { createNativeCmsLayout, parseCmsPageLayout, type CmsLayoutValue, type CmsPageLayout } from "../../lib/cms-page-layout";
import { resolveCmsPageIdentity, type CmsPageIdentity } from "../../lib/cms-page-manifest";
import { CMS_PREVIEW_PROTOCOL, isCmsPreviewRequested, parseCmsPreviewHostMessage, readCmsPreviewRequest, type CmsPreviewFramePayload } from "../../lib/cms-preview-bridge";
import RichContentRenderer from "../editor/RichContentRenderer";
import { useAuthSession } from "../useAuthSession";

interface LayoutContext {
  identity: CmsPageIdentity;
  layout: CmsPageLayout;
  editing: boolean;
  selected: string | null;
  select: (fieldId: string, nativeValue: CmsLayoutValue) => void;
  register: (fieldId: string, nativeValue: CmsLayoutValue) => () => void;
}
const Context = createContext<LayoutContext | null>(null);
interface Snapshot { slotKey: string; layout: CmsPageLayout; editing: boolean; selected: string | null; error?: string }

export function CmsPageLayoutProvider({ pathname, entityId, children }: { pathname: string; entityId?: string; children: ReactNode }) {
  const identity = useMemo(() => resolveCmsPageIdentity(pathname, entityId), [pathname, entityId]);
  const session = useAuthSession();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const bridge = useRef<{ channel: string; revision: number; authorized: boolean } | null>(null);
  const nativeFields = useRef(new Map<string, Map<symbol, CmsLayoutValue>>());
  const register = useCallback((fieldId: string, nativeValue: CmsLayoutValue) => {
    const token = Symbol(fieldId);
    const entries = nativeFields.current.get(fieldId) ?? new Map<symbol, CmsLayoutValue>();
    entries.set(token, nativeValue); nativeFields.current.set(fieldId, entries);
    return () => { entries.delete(token); if (entries.size === 0) nativeFields.current.delete(fieldId); };
  }, []);
  const post = useCallback((message: CmsPreviewFramePayload, revision?: number) => {
    const current = bridge.current;
    const activeSession = readAuthSession();
    if (!identity || !current?.authorized || !activeSession || !hasRole(activeSession.user, "ADMIN") || window.parent === window) return;
    window.parent.postMessage({ ...message, protocol: CMS_PREVIEW_PROTOCOL, channel: current.channel, slotKey: identity.slotKey, path: identity.canonicalPath, revision: revision ?? current.revision }, window.location.origin);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    const query = new URLSearchParams(window.location.search);
    let publicReadInFlight = false;
    const refreshPublic = async () => {
      if (controller.signal.aborted || publicReadInFlight) return;
      publicReadInFlight = true;
      try {
        const publication = await fetchPublishedCmsLayout(identity, controller.signal);
        if (!controller.signal.aborted) setSnapshot({ slotKey: identity.slotKey, layout: publication?.payload ?? createNativeCmsLayout(identity), editing: false, selected: null });
      } finally { publicReadInFlight = false; }
    };
    const preview = readCmsPreviewRequest(window.location.search);
    bridge.current = preview ? { channel: preview.channel, revision: -1, authorized: false } : null;
    const initialize = async () => {
      try {
        if (query.has("cmsPreview")) {
          if (!preview || window.parent === window) throw new Error("Mở bản xem trước từ màn hình Nội dung website.");
          const session = await hydrateAuthSession();
          if (controller.signal.aborted) return;
          if (!session || !hasRole(session.user, "ADMIN")) throw new Error("Bản nháp chỉ dành cho quản trị viên đã đăng nhập.");
          const draft = await cmsLayoutClient.getDraft(identity, controller.signal);
          if (controller.signal.aborted || !bridge.current) return;
          bridge.current.authorized = true;
          bridge.current.revision = 0;
          setSnapshot({ slotKey: identity.slotKey, layout: draft.payload, editing: true, selected: null });
          post({ type: "ready", expectedVersion: draft.expectedVersion }, 0);
        } else {
          await refreshPublic();
        }
      } catch {
        if (!controller.signal.aborted) setSnapshot({ slotKey: identity.slotKey, layout: createNativeCmsLayout(identity), editing: false, selected: null, ...(query.has("cmsPreview") ? { error: "Không thể mở bản nháp. Kiểm tra phiên quản trị rồi tải lại bản xem trước." } : {}) });
      }
    };
    void initialize();
    const receive = (event: MessageEvent) => {
      const current = bridge.current;
      const activeSession = readAuthSession();
      if (!current?.authorized || !activeSession || !hasRole(activeSession.user, "ADMIN")) return;
      const message = parseCmsPreviewHostMessage(event, { origin: window.location.origin, source: window.parent, channel: current.channel, identity, lastRevision: current.revision });
      if (!message) return;
      current.revision = message.revision;
      if (message.type === "render") {
        setSnapshot((previous) => ({ slotKey: identity.slotKey, layout: message.layout, editing: message.mode === "draft", selected: previous?.slotKey === identity.slotKey ? previous.selected : null }));
      } else {
        setSnapshot((previous) => previous?.slotKey === identity.slotKey ? { ...previous, selected: message.fieldId } : previous);
        // IDs come from the manifest, never from arbitrary selectors sent across the bridge.
        const element = [...document.querySelectorAll<HTMLElement>("[data-cms-native-field]")].find((node) => node.dataset.cmsNativeField === message.fieldId);
        element?.scrollIntoView({ block: "center", behavior: "auto" });
        element?.focus({ preventScroll: true });
        const values = nativeFields.current.get(message.fieldId);
        if (values?.size === 1) {
          const nativeValue = [...values.values()][0];
          post({ type: "selected", fieldId: message.fieldId, nativeValue });
        }
      }
    };
    const blocked = () => post({ type: "blocked" });
    window.addEventListener("message", receive);
    window.addEventListener("healthcare:cms-preview-blocked", blocked);
    // Follow existing public CMS policy: bounded visible-tab reads, no always-open SSE.
    const pollPublic = () => { if (!query.has("cmsPreview") && !document.hidden) void refreshPublic().catch(() => {}); };
    const publicTimer = query.has("cmsPreview") ? null : window.setInterval(pollPublic, 60_000);
    document.addEventListener("visibilitychange", pollPublic);
    return () => {
      controller.abort(); bridge.current = null;
      if (publicTimer !== null) window.clearInterval(publicTimer);
      document.removeEventListener("visibilitychange", pollPublic);
      window.removeEventListener("message", receive);
      window.removeEventListener("healthcare:cms-preview-blocked", blocked);
    };
  }, [identity, post]);

  const select = useCallback((fieldId: string, nativeValue: CmsLayoutValue) => {
    const activeSession = readAuthSession();
    if (!identity || !activeSession || !hasRole(activeSession.user, "ADMIN") || !bridge.current?.authorized || !snapshot?.editing || snapshot.slotKey !== identity.slotKey) return;
    try {
      parseCmsPageLayout({ ...createNativeCmsLayout(identity), fields: { [fieldId]: nativeValue } }, identity);
      setSnapshot((previous) => previous ? { ...previous, selected: fieldId } : previous);
      post({ type: "selected", fieldId, nativeValue });
    } catch { /* Misannotated native facts cannot become editable fields. */ }
  }, [identity, post, snapshot]);
  if (!identity) return <>{children}</>;
  const current = snapshot?.slotKey === identity.slotKey
    && (!isCmsPreviewRequested() || (session && hasRole(session.user, "ADMIN"))) ? snapshot : null;
  return <Context.Provider value={{ identity, layout: current?.layout ?? createNativeCmsLayout(identity), editing: current?.editing ?? false, selected: current?.selected ?? null, select, register }}>
    {snapshot?.slotKey === identity.slotKey && snapshot.error ? <aside className="cms-native-preview-notice" role="alert">{snapshot.error}</aside> : null}
    {children}
  </Context.Provider>;
}

function useField(fieldId: string, nativeValue: CmsLayoutValue) {
  const context = useContext(Context);
  const field = context?.identity.sections.flatMap((section) => section.fields).find((entry) => entry.id === fieldId && entry.kind === nativeValue.kind);
  const editable = Boolean(field && context?.editing);
  const preview = isCmsPreviewRequested();
  const value = field ? context?.layout.fields[fieldId] ?? nativeValue : nativeValue;
  const register = context?.register;
  useEffect(() => {
    if (!field || !register) return;
    return register(fieldId, nativeValue);
  }, [field, fieldId, nativeValue, register]);
  return {
    value, editable,
    attributes: {
      "data-cms-native-field": field ? fieldId : undefined,
      "data-cms-native-selected": editable && context?.selected === fieldId ? "true" : undefined,
      ...(editable ? { tabIndex: 0, title: `Chỉnh sửa: ${field?.label}` } : {}),
      ...(preview ? { onClick: (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); if (editable) context?.select(fieldId, nativeValue); }, onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); if (editable) context?.select(fieldId, nativeValue); } } } : {}),
    },
  };
}
export function CmsNativeText({ fieldId, value, as = "span", children, renderText, ...props }: { fieldId: string; value: string; as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "strong" | "small"; children?: ReactNode; renderText?: (text: string) => ReactNode } & HTMLAttributes<HTMLElement>) {
  const field = useField(fieldId, { kind: "text", value });
  const text = field.value.kind === "text" ? field.value.value : value;
  // Native typography applies to the effective draft/published copy without
  // turning an editable plain-text field into arbitrary CMS HTML.
  return createElement(as, { ...props, ...field.attributes }, renderText ? renderText(text) : text !== value ? text : children ?? value);
}
export function CmsNativeRich({ fieldId, value, children, ...props }: { fieldId: string; value: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const field = useField(fieldId, { kind: "rich", format: "markdown", value });
  const content = field.value.kind === "rich" ? field.value.value : value;
  return <div {...props} {...field.attributes}>{content === value && children ? children : <RichContentRenderer content={content} />}</div>;
}
export function CmsNativeImage({ fieldId, src, alt, ...props }: { fieldId: string; src: string; alt: string } & Omit<ImageProps, "src" | "alt">) {
  const field = useField(fieldId, { kind: "image", src, alt });
  const value = field.value.kind === "image" ? field.value : { src, alt };
  return <Image {...props} {...field.attributes} unoptimized={props.unoptimized || value.src !== src} src={value.src} alt={value.alt} />;
}
export function CmsNativeSection({ children }: { sectionId: string; children: ReactNode }) { return <>{children}</>; }
export function CmsNativeSections({ children }: { children: ReactNode }) {
  const context = useContext(Context);
  const entries = Children.toArray(children);
  const byId = new Map(entries.flatMap((child) => isValidElement<{ sectionId?: string }>(child) && typeof child.props.sectionId === "string" ? [[child.props.sectionId, child] as const] : []));
  // A native grid may own a subset of page regions. Preserve its DOM boundary;
  // unknown, duplicate or unwrapped children never disappear during ordering.
  if (!context || byId.size !== entries.length || [...byId.keys()].some((id) => !context.identity.sections.some((section) => section.id === id))) return <>{children}</>;
  return <>{context.layout.sectionOrder.filter((id) => byId.has(id)).map((id) => byId.get(id))}</>;
}
