import type { ReactElement } from "react";

export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;
  id?: string;
}

/**
 * Safely renders JSON-LD structured data inside a `<script type="application/ld+json">` tag.
 * Automatically escapes HTML special characters (`<`, `>`, `&`, line/paragraph separators)
 * to prevent script injection and XSS vulnerabilities.
 */
export function JsonLd({ data, id }: JsonLdProps): ReactElement | null {
  if (!data) return null;
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(data) }}
    />
  );
}
