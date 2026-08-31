import type { ReactElement, ReactNode } from "react";
import { isSafeCmsUrl, type CmsContent } from "../../lib/cms-client";

export type CmsRendererHeadingLevel = "h2" | "none";

function CmsTitle({
  children,
  headingLevel = "h2",
}: {
  children: ReactNode;
  headingLevel?: CmsRendererHeadingLevel;
}): ReactElement {
  if (headingLevel === "none") {
    return <p className="cms-renderer__title cms-renderer__title--non-heading">{children}</p>;
  }

  return <h2 className="cms-renderer__title">{children}</h2>;
}

function SafeLink({ label, href }: { label: string; href: string }): ReactElement {
  if (!isSafeCmsUrl(href)) {
    return <span className="text-sm text-red-700" role="alert">Liên kết chưa được hiển thị vì URL không an toàn.</span>;
  }
  return (
    <a
      className="cms-renderer__link cms-renderer__link--primary"
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
      className="cms-renderer__image"
      decoding="async"
      loading="lazy"
      src={src}
    />
  );
}

function CmsContentBody({
  content,
  headingLevel = "h2",
}: {
  content: CmsContent;
  headingLevel?: CmsRendererHeadingLevel;
}): ReactElement {
  switch (content.componentType) {
    case "HERO":
      return (
        <div className="cms-renderer cms-renderer--hero">
          <div className="cms-renderer__content">
            {content.payload.eyebrow ? <p className="cms-renderer__eyebrow">{content.payload.eyebrow}</p> : null}
            <CmsTitle headingLevel={headingLevel}>{content.payload.title}</CmsTitle>
            {content.payload.body ? <p className="cms-renderer__body">{content.payload.body}</p> : null}
            {content.payload.ctaLabel && content.payload.ctaHref ? (
              <div className="cms-renderer__action"><SafeLink href={content.payload.ctaHref} label={content.payload.ctaLabel} /></div>
            ) : null}
          </div>
          {content.payload.imageUrl ? <SafeImage alt={content.payload.title} src={content.payload.imageUrl} /> : null}
        </div>
      );
    case "RICH_TEXT":
      return (
        <article className="cms-renderer cms-renderer--rich-text">
          <CmsTitle headingLevel={headingLevel}>{content.payload.title}</CmsTitle>
          <p className="cms-renderer__body">{content.payload.body}</p>
        </article>
      );
    case "CTA_BANNER":
      return (
        <section className="cms-renderer cms-renderer--cta">
          <CmsTitle headingLevel={headingLevel}>{content.payload.title}</CmsTitle>
          <p className="cms-renderer__body">{content.payload.body}</p>
          <div className="cms-renderer__action"><SafeLink href={content.payload.ctaHref} label={content.payload.ctaLabel} /></div>
        </section>
      );
    case "NOTICE":
      return (
        <aside className="cms-renderer cms-renderer--notice" role="note">
          <CmsTitle headingLevel={headingLevel}>{content.payload.title}</CmsTitle>
          <p className="cms-renderer__body">{content.payload.body}</p>
        </aside>
      );
    case "IMAGE_CARD":
      return (
        <article className="cms-renderer cms-renderer--image-card">
          <SafeImage alt={content.payload.title} src={content.payload.imageUrl} />
          <div className="cms-renderer__content">
            <CmsTitle headingLevel={headingLevel}>{content.payload.title}</CmsTitle>
            {content.payload.body ? <p className="cms-renderer__body">{content.payload.body}</p> : null}
            {content.payload.href ? <div className="cms-renderer__action"><SafeLink href={content.payload.href} label="Xem thêm" /></div> : null}
          </div>
        </article>
      );
  }
}

export interface CmsSlotRendererProps {
  slotKey: string;
  content?: CmsContent | null;
  className?: string;
  headingLevel?: CmsRendererHeadingLevel;
}

export function CmsSlotRenderer({
  slotKey,
  content,
  className = "",
  headingLevel = "h2",
}: CmsSlotRendererProps): ReactElement {
  return (
    <section
      aria-label={slotKey === "hero" ? "Thông tin nổi bật từ bệnh viện" : "Thông tin hỗ trợ từ bệnh viện"}
      className={`cms-slot-renderer ${className}`}
      data-cms-slot={slotKey}
      data-cms-version={content?.version ?? undefined}
    >
      {content ? <CmsContentBody content={content} headingLevel={headingLevel} /> : null}
    </section>
  );
}

export function CmsContentRenderer({
  content,
  headingLevel = "h2",
}: {
  content: CmsContent;
  headingLevel?: CmsRendererHeadingLevel;
}): ReactElement {
  return <CmsContentBody content={content} headingLevel={headingLevel} />;
}
