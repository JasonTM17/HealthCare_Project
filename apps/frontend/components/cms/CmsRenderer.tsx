import type { ReactElement } from "react";
import type {
  CmsCalloutTone,
  CmsComponent,
  CmsPage,
  CmsSlotKey,
} from "../../lib/cms-client";
import { isSafeCmsUrl } from "../../lib/cms-client";

const CALLOUT_STYLES: Record<CmsCalloutTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

function CmsComponentView({ component }: { component: CmsComponent }): ReactElement {
  switch (component.componentKey) {
    case "heading": {
      const { level, text } = component.props;
      if (level === 1) return <h1 className="text-3xl font-bold tracking-tight text-slate-950">{text}</h1>;
      if (level === 2) return <h2 className="text-2xl font-bold tracking-tight text-slate-950">{text}</h2>;
      return <h3 className="text-xl font-bold tracking-tight text-slate-950">{text}</h3>;
    }
    case "paragraph":
      return <p className="whitespace-pre-line text-base leading-7 text-slate-700">{component.props.text}</p>;
    case "callout":
      return (
        <aside
          className={`rounded-2xl border p-4 ${CALLOUT_STYLES[component.props.tone]}`}
          role="note"
        >
          <h3 className="font-bold">{component.props.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">{component.props.body}</p>
        </aside>
      );
    case "link":
      if (!isSafeCmsUrl(component.props.href)) {
        return <p className="text-sm text-red-700" role="alert">Liên kết chưa được hiển thị vì URL không an toàn.</p>;
      }
      return (
        <a
          className="inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-800"
          href={component.props.href}
        >
          {component.props.label}
        </a>
      );
    case "image":
      if (!isSafeCmsUrl(component.props.src)) {
        return <p className="text-sm text-red-700" role="alert">Hình ảnh chưa được hiển thị vì URL không an toàn.</p>;
      }
      return (
        // The schema only permits http(s), local paths, and anchors; React also
        // escapes alt text and no HTML string is ever interpreted here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={component.props.alt}
          className="h-auto max-h-96 w-full rounded-2xl object-cover"
          decoding="async"
          loading="lazy"
          src={component.props.src}
        />
      );
  }
}

export interface CmsSlotRendererProps {
  slotKey: CmsSlotKey;
  components?: CmsComponent[];
  className?: string;
}

export function CmsSlotRenderer({
  slotKey,
  components = [],
  className = "",
}: CmsSlotRendererProps): ReactElement {
  return (
    <section
      aria-label={`Nội dung CMS: ${slotKey}`}
      className={`grid gap-4 ${className}`}
      data-cms-slot={slotKey}
    >
      {components.map((component) => (
        <div data-cms-component={component.componentKey} key={component.id}>
          <CmsComponentView component={component} />
        </div>
      ))}
    </section>
  );
}

export function CmsPageRenderer({ page }: { page: CmsPage }): ReactElement {
  return (
    <article data-cms-page={page.slug} data-cms-version={page.version}>
      <CmsSlotRenderer className="mb-6" components={page.slots.hero} slotKey="hero" />
      <CmsSlotRenderer className="mb-6" components={page.slots.body} slotKey="body" />
      <CmsSlotRenderer className="mb-6" components={page.slots.sidebar} slotKey="sidebar" />
      <CmsSlotRenderer components={page.slots.footer} slotKey="footer" />
    </article>
  );
}
