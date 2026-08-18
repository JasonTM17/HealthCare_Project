import type { ReactElement } from "react";
import { isSafeCmsUrl, type CmsContent } from "../../lib/cms-client";

function SafeLink({ label, href }: { label: string; href: string }): ReactElement {
  if (!isSafeCmsUrl(href)) {
    return <span className="text-sm text-red-700" role="alert">Liên kết chưa được hiển thị vì URL không an toàn.</span>;
  }
  return (
    <a
      className="inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-800"
      href={href}
    >
      {label}
    </a>
  );
}

function SafeImage({ alt, src }: { alt: string; src: string }): ReactElement | null {
  if (!isSafeCmsUrl(src)) {
    return <p className="text-sm text-red-700" role="alert">Hình ảnh chưa được hiển thị vì URL không an toàn.</p>;
  }
  return (
    // The URL was checked against the same relative/HTTPS rule as the backend.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className="h-auto max-h-96 w-full rounded-2xl object-cover"
      decoding="async"
      loading="lazy"
      src={src}
    />
  );
}

function CmsContentBody({ content }: { content: CmsContent }): ReactElement {
  switch (content.componentType) {
    case "HERO":
      return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)] lg:items-center">
          <div>
            {content.payload.eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">{content.payload.eyebrow}</p> : null}
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{content.payload.title}</h2>
            {content.payload.body ? <p className="mt-4 whitespace-pre-line text-base leading-7 text-slate-700">{content.payload.body}</p> : null}
            {content.payload.ctaLabel && content.payload.ctaHref ? (
              <div className="mt-5"><SafeLink href={content.payload.ctaHref} label={content.payload.ctaLabel} /></div>
            ) : null}
          </div>
          {content.payload.imageUrl ? <SafeImage alt={content.payload.title} src={content.payload.imageUrl} /> : null}
        </div>
      );
    case "RICH_TEXT":
      return (
        <article>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{content.payload.title}</h2>
          <p className="mt-3 whitespace-pre-line text-base leading-7 text-slate-700">{content.payload.body}</p>
        </article>
      );
    case "CTA_BANNER":
      return (
        <section className="rounded-2xl bg-teal-800 p-5 text-white sm:p-6">
          <h2 className="text-2xl font-bold tracking-tight">{content.payload.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-teal-50">{content.payload.body}</p>
          <div className="mt-4"><SafeLink href={content.payload.ctaHref} label={content.payload.ctaLabel} /></div>
        </section>
      );
    case "NOTICE":
      return (
        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="note">
          <h2 className="font-bold">{content.payload.title}</h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">{content.payload.body}</p>
        </aside>
      );
    case "IMAGE_CARD":
      return (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SafeImage alt={content.payload.title} src={content.payload.imageUrl} />
          <div className="p-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">{content.payload.title}</h2>
            {content.payload.body ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{content.payload.body}</p> : null}
            {content.payload.href ? <div className="mt-4"><SafeLink href={content.payload.href} label="Xem thêm" /></div> : null}
          </div>
        </article>
      );
  }
}

export interface CmsSlotRendererProps {
  slotKey: string;
  content?: CmsContent | null;
  className?: string;
}

export function CmsSlotRenderer({
  slotKey,
  content,
  className = "",
}: CmsSlotRendererProps): ReactElement {
  return (
    <section
      aria-label={`Nội dung CMS: ${slotKey}`}
      className={`grid gap-4 ${className}`}
      data-cms-slot={slotKey}
      data-cms-version={content?.version ?? undefined}
    >
      {content ? <CmsContentBody content={content} /> : null}
    </section>
  );
}

export function CmsContentRenderer({ content }: { content: CmsContent }): ReactElement {
  return <CmsContentBody content={content} />;
}
