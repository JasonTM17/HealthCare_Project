"use client";

import dynamic from "next/dynamic";

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
  return (
    <>
      <FloatingHealthAssistant />
      <CmsEditModeToolbar />
    </>
  );
}
