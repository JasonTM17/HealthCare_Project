"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { isCmsPreviewRequested } from "../lib/cms-preview-bridge";

const subscribePreview = () => () => {};
const serverPreview = () => false;

// The assistant and CMS toolbar ship a large client bundle to every visitor;
// defer them off the initial JS payload. The toolbar renders null for
// non-admin users anyway; the assistant mounts on first client idle.
// `ssr: false` is only legal inside a Client Component, so the root layout
// mounts this thin wrapper instead of calling next/dynamic itself.
const FloatingHealthAssistant = dynamic(
  () => import("./FloatingHealthAssistant"),
  { ssr: false },
);
const CmsEditModeToolbar = dynamic(
  () => import("./cms/CmsInlineEditor").then((m) => m.CmsEditModeToolbar),
  { ssr: false },
);

export default function DeferredClientWidgets() {
  const preview = useSyncExternalStore(subscribePreview, isCmsPreviewRequested, serverPreview);
  if (preview) return null;
  return (
    <>
      <FloatingHealthAssistant />
      <CmsEditModeToolbar />
    </>
  );
}
