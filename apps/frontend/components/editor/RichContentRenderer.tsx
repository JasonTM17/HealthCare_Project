"use client";

import React, { useMemo, type ReactElement, type ReactNode } from "react";
import UiIcon, { type IconName } from "../UiIcon";

export interface RichContentRendererProps {
  content?: string | null;
  className?: string;
  fallback?: ReactNode;
}

interface CalloutMeta {
  label: string;
  icon: IconName;
  containerClass: string;
  badgeClass: string;
}

const CALLOUT_CONFIG: Record<string, CalloutMeta> = {
  "clinical-warning": {
    label: "Cảnh báo lâm sàng & Chống chỉ định",
    icon: "alert-triangle",
    containerClass: "border-l-4 border-l-amber-500 bg-amber-50/90 border border-amber-200 text-amber-950",
    badgeClass: "bg-amber-100 text-amber-900 border border-amber-300",
  },
  warning: {
    label: "Lưu ý quan trọng",
    icon: "alert-triangle",
    containerClass: "border-l-4 border-l-amber-500 bg-amber-50/90 border border-amber-200 text-amber-950",
    badgeClass: "bg-amber-100 text-amber-900 border border-amber-300",
  },
  "doctor-note": {
    label: "Lời khuyên bác sĩ chuyên khoa",
    icon: "stethoscope",
    containerClass: "border-l-4 border-l-teal-600 bg-teal-50/90 border border-teal-200 text-teal-950",
    badgeClass: "bg-teal-100 text-teal-900 border border-teal-300",
  },
  tip: {
    label: "Mẹo chăm sóc sức khỏe",
    icon: "stethoscope",
    containerClass: "border-l-4 border-l-teal-600 bg-teal-50/90 border border-teal-200 text-teal-950",
    badgeClass: "bg-teal-100 text-teal-900 border border-teal-300",
  },
  "dosage-guide": {
    label: "Chỉ định & Hướng dẫn liều dùng",
    icon: "activity",
    containerClass: "border-l-4 border-l-sky-600 bg-sky-50/90 border border-sky-200 text-sky-950",
    badgeClass: "bg-sky-100 text-sky-900 border border-sky-300",
  },
  "emergency-box": {
    label: "Dấu hiệu khẩn cấp - Cần cấp cứu ngay",
    icon: "alert-triangle",
    containerClass: "border-l-4 border-l-rose-600 bg-rose-50/90 border border-rose-200 text-rose-950",
    badgeClass: "bg-rose-100 text-rose-900 border border-rose-300",
  },
  danger: {
    label: "Dấu hiệu nguy hiểm",
    icon: "alert-triangle",
    containerClass: "border-l-4 border-l-rose-600 bg-rose-50/90 border border-rose-200 text-rose-950",
    badgeClass: "bg-rose-100 text-rose-900 border border-rose-300",
  },
  info: {
    label: "Thông tin tham khảo y khoa",
    icon: "book-open",
    containerClass: "border-l-4 border-l-slate-500 bg-slate-50 border border-slate-200 text-slate-900",
    badgeClass: "bg-slate-200 text-slate-800 border border-slate-300",
  },
};

/**
 * Sanitizes URLs to prevent XSS (blocks javascript:, vbscript:, data: protocols)
 */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("data:")
  ) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  );
}

/**
 * Parses inline markdown: bold, italic, strikethrough, inline code, images, links.
 * Complies with CommonMark intra-word underscore isolation (prevents breaking covid_19_vaccine or ICD_10_CM).
 * Returns an array of safe pure React nodes without raw HTML injection.
 */
export function renderInlineMarkdown(text: string): ReactNode[] {
  if (!text) return [];

  const nodes: ReactNode[] = [];
  // Tokenize using regex:
  // 1. Image: !\[(.*?)\]\((.*?)\)
  // 2. Link: \[(.*?)\]\((.*?)\)
  // 3. Inline Code: `([^`]+)`
  // 4. Bold-Italic: \*\*\*([^*]+)\*\*\*
  // 5. Bold asterisks: \*\*([^*]+)\*\*
  // 6. Bold underscores: __([^_]+)__
  // 7. Strikethrough: ~~([^~]+)~~
  // 8. Italic asterisks: (?<!\*)\*([^*\n]+)\*(?!\*)
  // 9. Italic underscores (CommonMark: only flanked by whitespace or punctuation):
  //    ((?:^|(?<=[\s\p{P}]))_([^_]+)_(?:$|(?=[\s\p{P}])))
  const tokenRegex =
    /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(~~([^~]+)~~)|((?<!\*)\*([^*\n]+)\*(?!\*))|((?:^|(?<=[\s\p{P}]))_([^_]+)_(?:$|(?=[\s\p{P}])))/gu;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [
      ,
      isImg, imgAlt, imgUrl,
      isLink, linkText, linkUrl,
      isCode, codeText,
      isBoldItalic, boldItalicText,
      isBold1, bold1Text,
      isBold2, bold2Text,
      isDel, delText,
      isItalic1, italic1Text,
      isItalic2, italic2Text,
    ] = match;

    const key = `inline-${match.index}-${match[0].slice(0, 8)}`;

    if (isImg && imgUrl) {
      const safe = isSafeUrl(imgUrl);
      if (safe) {
        nodes.push(
          <span className="inline-block my-2" key={key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={imgAlt || "Hình ảnh y khoa"}
              className="max-h-96 max-w-full rounded-[4px] border border-slate-200 object-contain shadow-2xs"
              loading="lazy"
              src={imgUrl}
            />
            {imgAlt && (
              <span className="block mt-1 text-center text-xs text-slate-500 italic">
                {imgAlt}
              </span>
            )}
          </span>,
        );
      } else {
        nodes.push(`[Hình ảnh: ${imgAlt || "Không khả dụng"}]`);
      }
    } else if (isLink && linkUrl) {
      const safe = isSafeUrl(linkUrl);
      const isExternal = linkUrl.startsWith("http://") || linkUrl.startsWith("https://");
      nodes.push(
        <a
          className="font-medium text-teal-800 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-950 hover:decoration-teal-800 transition-colors"
          href={safe ? linkUrl : "#"}
          key={key}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {renderInlineMarkdown(linkText)}
        </a>,
      );
    } else if (isCode) {
      nodes.push(
        <code
          className="rounded-[4px] bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-teal-900 border border-slate-200/80"
          key={key}
        >
          {codeText}
        </code>,
      );
    } else if (isBoldItalic) {
      nodes.push(
        <strong className="font-bold italic text-slate-900" key={key}>
          {renderInlineMarkdown(boldItalicText)}
        </strong>,
      );
    } else if (isBold1 || isBold2) {
      nodes.push(
        <strong className="font-bold text-slate-950" key={key}>
          {renderInlineMarkdown(bold1Text || bold2Text)}
        </strong>,
      );
    } else if (isDel) {
      nodes.push(
        <del className="line-through text-slate-500" key={key}>
          {renderInlineMarkdown(delText)}
        </del>,
      );
    } else if (isItalic1 || isItalic2) {
      nodes.push(
        <em className="italic text-slate-800" key={key}>
          {renderInlineMarkdown(italic1Text || italic2Text)}
        </em>,
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export interface ParsedBlock {
  type:
    | "heading"
    | "paragraph"
    | "callout"
    | "align"
    | "blockquote"
    | "table"
    | "unordered-list"
    | "ordered-list"
    | "checklist"
    | "code"
    | "hr";
  level?: number;
  content?: string;
  language?: string;
  items?: string[];
  checkedItems?: { text: string; checked: boolean }[];
  calloutKind?: string;
  calloutTitle?: string;
  calloutLines?: string[];
  innerBlocks?: ParsedBlock[];
  headers?: string[];
  alignments?: ("left" | "center" | "right")[];
  rows?: string[][];
  start?: number;
  align?: "left" | "center" | "right" | "justify";
}

/**
 * Checks whether a line is a markdown table separator (e.g. | --- | --- | or | --- |)
 */
function isTableSeparator(line: string): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  if (!trimmed.includes("-") || !trimmed.includes("|")) return false;
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(trimmed);
}

/**
 * Checks whether lines starting at index `i` form the start of a valid markdown table.
 */
function isTableStart(lines: string[], i: number): boolean {
  if (i + 1 >= lines.length) return false;
  const current = lines[i].trim();
  const next = lines[i + 1].trim();
  if (!current.includes("|")) return false;
  return isTableSeparator(next);
}

/**
 * Parses markdown blocks, tables, code blocks, and custom healthcare callouts (:::kind [title])
 */
export function parseMarkdownBlocks(rawText: string, depth = 0): ParsedBlock[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // Clinical Callout & Text Alignment Blocks (:::kind [optional title])
    if (trimmed.startsWith(":::") && depth === 0) {
      const match = trimmed.match(/^:::\s*([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
      if (match) {
        const calloutKind = match[1].toLowerCase();
        const calloutTitle = match[2] ? match[2].trim() : undefined;
        const calloutLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(":::")) {
          calloutLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith(":::")) {
          i++; // Skip closing :::
        }

        // Text Alignment blocks
        if (calloutKind === "center" || calloutKind === "align-center") {
          blocks.push({
            type: "align",
            align: "center",
            innerBlocks: parseMarkdownBlocks(calloutLines.join("\n"), depth + 1),
          });
          continue;
        }
        if (calloutKind === "right" || calloutKind === "align-right") {
          blocks.push({
            type: "align",
            align: "right",
            innerBlocks: parseMarkdownBlocks(calloutLines.join("\n"), depth + 1),
          });
          continue;
        }
        if (calloutKind === "justify" || calloutKind === "align-justify") {
          blocks.push({
            type: "align",
            align: "justify",
            innerBlocks: parseMarkdownBlocks(calloutLines.join("\n"), depth + 1),
          });
          continue;
        }
        if (calloutKind === "left" || calloutKind === "align-left") {
          blocks.push({
            type: "align",
            align: "left",
            innerBlocks: parseMarkdownBlocks(calloutLines.join("\n"), depth + 1),
          });
          continue;
        }

        // Recursively parse inner callout blocks (depth = 1) to support lists, bold, and paragraphs inside callout
        const innerBlocks = parseMarkdownBlocks(calloutLines.join("\n"), depth + 1);
        blocks.push({
          type: "callout",
          calloutKind,
          calloutTitle,
          calloutLines,
          innerBlocks,
        });
        continue;
      }
    }

    // Fenced Code Block (```lang)
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // Skip closing ```
      }
      blocks.push({
        type: "code",
        language: language || undefined,
        content: codeLines.join("\n"),
      });
      continue;
    }

    // Horizontal Rule (3 or more *, -, or _)
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Headings (# H1, ## H2, ### H3, #### H4)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({
        type: "heading",
        level,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Blockquote (> line)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: quoteLines.join("\n"),
      });
      continue;
    }

    // Table detection: requires current line to have | AND next line to be a separator (| --- | --- |)
    if (isTableStart(lines, i)) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].includes("|") &&
        lines[i].trim().length > 0
      ) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
        const parseRow = (r: string): string[] => {
          let trimmedRow = r.trim();
          if (trimmedRow.startsWith("|")) trimmedRow = trimmedRow.slice(1);
          if (trimmedRow.endsWith("|")) trimmedRow = trimmedRow.slice(0, -1);
          return trimmedRow.split("|").map((c) => c.trim());
        };

        const headers = parseRow(tableLines[0]);
        const alignments: ("left" | "center" | "right")[] = parseRow(tableLines[1]).map((cell) => {
          const c = cell.trim();
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          return "left";
        });
        const rows = tableLines.slice(2).map(parseRow);
        blocks.push({
          type: "table",
          headers,
          alignments,
          rows,
        });
        continue;
      }
    }

    // Checklist (- [ ] or - [x])
    if (/^[-*+]\s+\[([ xX])\]\s+(.*)$/.test(trimmed)) {
      const checkedItems: { text: string; checked: boolean }[] = [];
      while (i < lines.length) {
        const currentTrim = lines[i].trim();
        const itemMatch = currentTrim.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
        if (itemMatch) {
          let text = itemMatch[2].trim();
          const checked = itemMatch[1].toLowerCase() === "x";
          i++;
          // Accumulate continuation lines indented with 2 or more spaces
          while (
            i < lines.length &&
            /^\s{2,}\S/.test(lines[i]) &&
            !/^[-*+]\s+\[([ xX])\]/.test(lines[i].trim())
          ) {
            text += " " + lines[i].trim();
            i++;
          }
          checkedItems.push({ checked, text });
        } else {
          break;
        }
      }
      blocks.push({
        type: "checklist",
        checkedItems,
      });
      continue;
    }

    // Unordered List (- or * or + followed by space)
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const currentTrim = lines[i].trim();
        if (/^[-*+]\s+/.test(currentTrim)) {
          let itemText = currentTrim.replace(/^[-*+]\s+/, "");
          i++;
          // Accumulate continuation lines indented with 2 or more spaces
          while (
            i < lines.length &&
            /^\s{2,}\S/.test(lines[i]) &&
            !/^[-*+]\s+/.test(lines[i].trim())
          ) {
            itemText += " " + lines[i].trim();
            i++;
          }
          items.push(itemText);
        } else {
          break;
        }
      }
      blocks.push({
        type: "unordered-list",
        items,
      });
      continue;
    }

    // Ordered List (1. 2. etc.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      const startMatch = trimmed.match(/^(\d+)\.\s+/);
      const start = startMatch ? parseInt(startMatch[1], 10) : 1;
      while (i < lines.length) {
        const currentTrim = lines[i].trim();
        if (/^\d+\.\s+/.test(currentTrim)) {
          let itemText = currentTrim.replace(/^\d+\.\s+/, "");
          i++;
          // Accumulate continuation lines indented with 2 or more spaces
          while (
            i < lines.length &&
            /^\s{2,}\S/.test(lines[i]) &&
            !/^\d+\.\s+/.test(lines[i].trim())
          ) {
            itemText += " " + lines[i].trim();
            i++;
          }
          items.push(itemText);
        } else {
          break;
        }
      }
      blocks.push({
        type: "ordered-list",
        start,
        items,
      });
      continue;
    }

    // Paragraph: collect lines until a blank line or a line starting a new block
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pTrim = lines[i].trim();
      if (!pTrim) break;
      if (paraLines.length > 0) {
        if (depth === 0 && /^:::\s*[a-zA-Z0-9_-]+/.test(pTrim)) break;
        if (pTrim.startsWith("```")) break;
        if (pTrim.startsWith(">")) break;
        if (/^(#{1,6})\s+/.test(pTrim)) break;
        if (/^[-*+]\s+/.test(pTrim)) break;
        if (/^\d+\.\s+/.test(pTrim)) break;
        if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(pTrim)) break;
        if (isTableStart(lines, i)) break;
      }
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: paraLines.join("\n"),
      });
    } else {
      // Guaranteed forward progress
      i++;
    }
  }

  return blocks;
}

/**
 * Internal component to render an array of ParsedBlocks
 */
function RenderBlockList({
  blocks,
  inCallout = false,
}: {
  blocks: ParsedBlock[];
  inCallout?: boolean;
}): ReactElement {
  return (
    <>
      {blocks.map((block, index) => {
        const blockKey = `block-${index}-${block.type}`;

        switch (block.type) {
          case "heading": {
            const level = block.level ?? 2;
            const headingText = block.content || "";
            if (level <= 2) {
              return (
                <h2
                  className="mt-6 mb-3 text-xl sm:text-2xl font-bold tracking-tight text-teal-950 border-b border-slate-100 pb-2 flex items-center gap-2"
                  key={blockKey}
                >
                  <span className="inline-block w-1.5 h-5 bg-teal-800 rounded-[2px]" />
                  <span>{renderInlineMarkdown(headingText)}</span>
                </h2>
              );
            }
            if (level === 3) {
              return (
                <h3
                  className="mt-5 mb-2 text-lg sm:text-xl font-bold text-teal-900 flex items-center gap-2"
                  key={blockKey}
                >
                  <span className="inline-block w-1 h-4 bg-teal-600 rounded-[2px]" />
                  <span>{renderInlineMarkdown(headingText)}</span>
                </h3>
              );
            }
            return (
              <h4
                className="mt-4 mb-1.5 text-base font-bold text-slate-900"
                key={blockKey}
              >
                {renderInlineMarkdown(headingText)}
              </h4>
            );
          }

          case "paragraph":
            return (
              <p
                className={
                  inCallout
                    ? "my-1.5 text-xs sm:text-sm leading-relaxed text-inherit font-medium whitespace-pre-line"
                    : "my-3 text-sm sm:text-base leading-relaxed text-slate-700 whitespace-pre-line"
                }
                key={blockKey}
              >
                {renderInlineMarkdown(block.content || "")}
              </p>
            );

          case "align": {
            const alignClass =
              block.align === "center"
                ? "text-center"
                : block.align === "right"
                  ? "text-right"
                  : block.align === "justify"
                    ? "text-justify"
                    : "text-left";
            return (
              <div className={`my-2.5 ${alignClass}`} key={blockKey}>
                <RenderBlockList blocks={block.innerBlocks || []} inCallout={inCallout} />
              </div>
            );
          }

          case "callout": {
            const kind = block.calloutKind || "info";
            const config = CALLOUT_CONFIG[kind] || CALLOUT_CONFIG.info;
            const title = block.calloutTitle || config.label;
            const innerBlocks = block.innerBlocks || [];
            const rawFallbackText = (block.calloutLines || []).join("\n").trim();

            return (
              <div
                className={`my-4 p-4 rounded-[4px] shadow-2xs ${config.containerClass}`}
                key={blockKey}
                role="region"
                aria-label={title}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-xs font-bold uppercase tracking-wider ${config.badgeClass}`}>
                    <UiIcon name={config.icon} size={13} />
                    <span>{title}</span>
                  </span>
                </div>
                {innerBlocks.length > 0 ? (
                  <div className="text-xs sm:text-sm leading-relaxed space-y-2">
                    <RenderBlockList blocks={innerBlocks} inCallout={true} />
                  </div>
                ) : rawFallbackText ? (
                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium">
                    {renderInlineMarkdown(rawFallbackText)}
                  </div>
                ) : null}
              </div>
            );
          }

          case "blockquote":
            return (
              <blockquote
                className="my-4 border-l-4 border-l-teal-700 bg-teal-50/40 pl-4 py-2 text-sm sm:text-base italic text-slate-700 rounded-r-[4px]"
                key={blockKey}
              >
                {renderInlineMarkdown(block.content || "")}
              </blockquote>
            );

          case "code":
            return (
              <div
                className="my-4 overflow-hidden rounded-[4px] border border-slate-700 bg-slate-900 text-slate-100 shadow-2xs"
                key={blockKey}
              >
                {block.language && (
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3 py-1.5 font-mono text-xs text-slate-400">
                    <span>{block.language}</span>
                  </div>
                )}
                <pre className="overflow-x-auto p-3.5 font-mono text-xs sm:text-sm leading-relaxed text-slate-100">
                  <code>{block.content}</code>
                </pre>
              </div>
            );

          case "table": {
            const headers = block.headers || [];
            const rows = block.rows || [];
            const alignments = block.alignments || [];
            const getAlignClass = (idx: number) => {
              const a = alignments[idx];
              if (a === "center") return "text-center";
              if (a === "right") return "text-right";
              return "text-left";
            };
            return (
              <div
                className="my-5 overflow-x-auto rounded-[4px] border border-slate-200 bg-white shadow-2xs"
                key={blockKey}
              >
                <table className="w-full text-xs sm:text-sm border-collapse">
                  {headers.length > 0 && (
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        {headers.map((h, hIdx) => (
                          <th className={`px-4 py-3 ${getAlignClass(hIdx)}`} key={`th-${hIdx}`}>
                            {renderInlineMarkdown(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {rows.map((row, rIdx) => (
                      <tr
                        className={rIdx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}
                        key={`tr-${rIdx}`}
                      >
                        {row.map((cell, cIdx) => (
                          <td className={`px-4 py-2.5 ${getAlignClass(cIdx)}`} key={`td-${rIdx}-${cIdx}`}>
                            {renderInlineMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case "unordered-list":
            return (
              <ul
                className={
                  inCallout
                    ? "my-1.5 space-y-1 pl-4 list-disc text-xs sm:text-sm text-inherit marker:text-current"
                    : "my-2.5 space-y-1.5 pl-5 list-disc text-sm sm:text-base text-slate-700 marker:text-teal-700"
                }
                key={blockKey}
              >
                {(block.items || []).map((item, itemIdx) => (
                  <li className="leading-relaxed" key={`ul-${itemIdx}`}>
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol
                className={
                  inCallout
                    ? "my-1.5 space-y-1 pl-4 list-decimal text-xs sm:text-sm text-inherit marker:text-current font-medium"
                    : "my-2.5 space-y-1.5 pl-5 list-decimal text-sm sm:text-base text-slate-700 marker:font-bold marker:text-teal-900"
                }
                key={blockKey}
                start={block.start || 1}
              >
                {(block.items || []).map((item, itemIdx) => (
                  <li className="leading-relaxed" key={`ol-${itemIdx}`}>
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ol>
            );

          case "checklist":
            return (
              <div
                className={
                  inCallout
                    ? "my-1.5 space-y-1.5 text-xs sm:text-sm text-inherit"
                    : "my-2.5 space-y-2 text-sm sm:text-base"
                }
                key={blockKey}
              >
                {(block.checkedItems || []).map((item, chkIdx) => (
                  <div
                    className={`flex items-start gap-2.5 ${inCallout ? "text-inherit" : "text-slate-700"}`}
                    key={`chk-${chkIdx}`}
                  >
                    <span
                      className={`inline-flex items-center justify-center mt-0.5 w-4 h-4 rounded-[2px] border text-[10px] font-bold ${
                        item.checked
                          ? "bg-teal-800 border-teal-800 text-white"
                          : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      {item.checked ? "✓" : ""}
                    </span>
                    <span className={item.checked ? "line-through text-slate-500" : ""}>
                      {renderInlineMarkdown(item.text)}
                    </span>
                  </div>
                ))}
              </div>
            );

          case "hr":
            return <hr className="my-6 border-slate-200" key={blockKey} />;

          default:
            return null;
        }
      })}
    </>
  );
}

const HTML_NAMED_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  "#39": "'",
  mdash: "—",
  ndash: "–",
  Agrave: "À",
  Aacute: "Á",
  Acirc: "Â",
  Atilde: "Ã",
  Auml: "Ä",
  Aring: "Å",
  Ccedil: "Ç",
  Egrave: "È",
  Eacute: "É",
  Ecirc: "Ê",
  Euml: "Ë",
  Igrave: "Ì",
  Iacute: "Í",
  Icirc: "Î",
  Iuml: "Ï",
  Ntilde: "Ñ",
  Ograve: "Ò",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Ouml: "Ö",
  Ugrave: "Ù",
  Uacute: "Ú",
  Ucirc: "Û",
  Uuml: "Ü",
  Yacute: "Ý",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  aring: "å",
  ccedil: "ç",
  egrave: "è",
  eacute: "é",
  ecirc: "ê",
  euml: "ë",
  igrave: "ì",
  iacute: "í",
  icirc: "î",
  iuml: "ï",
  ntilde: "ñ",
  ograve: "ò",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  ugrave: "ù",
  uacute: "ú",
  ucirc: "û",
  uuml: "ü",
  yacute: "ý",
  yuml: "ÿ",
};

export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_NAMED_ENTITY_MAP[entity] ?? match;
  });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ""));
}

/**
 * Converts rich HTML (e.g. from TinyMCE) into markdown blocks and callouts
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  let md = html;

  // Defensive sanitization: remove script, style, iframe tags
  md = md.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  md = md.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Clinical callouts with data-callout or class="clinical-warning" etc.
  md = md.replace(
    /<div[^>]*class=["'][^"']*?(clinical-warning|doctor-note|dosage-guide|emergency-box)[^"']*?["'][^>]*data-title=["']([^"']*)["'][^>]*>([\s\S]*?)<\/div>/gi,
    (_m, kind, title, content) => {
      const inner = htmlToMarkdown(content).trim();
      return `\n:::${kind} ${title}\n${inner}\n:::\n`;
    }
  );
  md = md.replace(
    /<div[^>]*class=["'][^"']*?(clinical-warning|doctor-note|dosage-guide|emergency-box)[^"']*?["'][^>]*>([\s\S]*?)<\/div>/gi,
    (_m, kind, content) => {
      let calloutTitle = "";
      const titleMatch = content.match(/<strong[^>]*>([^\n<]+)<\/strong>/i);
      if (titleMatch) {
        calloutTitle = titleMatch[1].replace(/^[⚠️💡📋🚨]\s*/, "").trim();
      }
      const inner = htmlToMarkdown(content).trim();
      return `\n:::${kind}${calloutTitle ? ` ${calloutTitle}` : ""}\n${inner}\n:::\n`;
    }
  );

  // Alignments: <div style="text-align: (center|right|justify)"...>...</div> or <p style="...">
  md = md.replace(
    /<(?:div|p)[^>]*style=["'][^"']*?text-align:\s*(center|right|justify)[^"']*?["'][^>]*>([\s\S]*?)<\/(?:div|p)>/gi,
    (_m, align, content) => {
      const inner = htmlToMarkdown(content).trim();
      return `\n:::${align}\n${inner}\n:::\n`;
    }
  );

  // Headings
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, content) => {
    const hashes = "#".repeat(Math.min(6, parseInt(level, 10)));
    return `\n${hashes} ${stripTags(content).trim()}\n`;
  });

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, content) => {
    const text = htmlToMarkdown(content).trim();
    return "\n" + text.split("\n").map((l) => `> ${l}`).join("\n") + "\n";
  });

  // Code blocks: <pre><code>...</code></pre>
  md = md.replace(/<pre[^>]*><code(?:[^>]*class=["']language-([^"']*)["'])?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_m, lang, code) => {
    return `\n\`\`\`${lang || ""}\n${decodeHtmlEntities(stripTags(code))}\n\`\`\`\n`;
  });

  // Tables: convert <table>...</table> to markdown table
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableHtml) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(stripTags(cellMatch[1]).trim());
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return "";
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const colCount = Math.max(...rows.map((r) => r.length));
    const normalizedHeaders = Array.from({ length: colCount }, (_, idx) => headers[idx] || "");
    const headerLine = `| ${normalizedHeaders.join(" | ")} |`;
    const separatorLine = `| ${normalizedHeaders.map(() => "---").join(" | ")} |`;
    const rowLines = dataRows.map((r) => {
      const normalizedRow = Array.from({ length: colCount }, (_, idx) => r[idx] || "");
      return `| ${normalizedRow.join(" | ")} |`;
    });
    return `\n${headerLine}\n${separatorLine}\n${rowLines.join("\n")}\n`;
  });

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, listHtml) => {
    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(listHtml)) !== null) {
      items.push(`- ${htmlToMarkdown(liMatch[1]).trim()}`);
    }
    return `\n${items.join("\n")}\n`;
  });

  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, listHtml) => {
    const items: string[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    let idx = 1;
    while ((liMatch = liRegex.exec(listHtml)) !== null) {
      items.push(`${idx++}. ${htmlToMarkdown(liMatch[1]).trim()}`);
    }
    return `\n${items.join("\n")}\n`;
  });

  // Paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, content) => {
    return `\n\n${content}\n\n`;
  });

  // Horizontal rules
  md = md.replace(/<hr[^>]*\/?>/gi, "\n\n---\n\n");

  // Inline formatting
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");
  md = md.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, "~~$1~~");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, "![]($1)");
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining HTML tags and decode entities
  md = stripTags(md);

  // Normalize duplicate newlines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

/**
 * Converts markdown text to clean HTML for TinyMCE initialization
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "";
  if (/<(?:p|div|h[1-6]|table|ul|ol|blockquote)[^>]*>/i.test(md)) {
    return md;
  }

  const lines = md.split(/\r?\n/);
  const htmlParts: string[] = [];
  let i = 0;

  const formatInline = (text: string): string => {
    let s = text;
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Callouts: :::kind [title]
    if (trimmed.startsWith(":::")) {
      const match = trimmed.match(/^:::\s*([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
      if (match) {
        const kind = match[1].toLowerCase();
        const title = match[2] ? match[2].trim() : "";
        const calloutLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(":::")) {
          calloutLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith(":::")) {
          i++;
        }
        const innerHtml = markdownToHtml(calloutLines.join("\n"));
        if (kind === "center" || kind === "align-center") {
          htmlParts.push(`<div style="text-align: center;">${innerHtml}</div>`);
        } else if (kind === "right" || kind === "align-right") {
          htmlParts.push(`<div style="text-align: right;">${innerHtml}</div>`);
        } else if (kind === "justify" || kind === "align-justify") {
          htmlParts.push(`<div style="text-align: justify;">${innerHtml}</div>`);
        } else {
          const defaultTitles: Record<string, string> = {
            "clinical-warning": "⚠️ Cảnh báo lâm sàng & Chống chỉ định",
            "doctor-note": "💡 Lời khuyên bác sĩ chuyên khoa",
            "dosage-guide": "📋 Chỉ định & Hướng dẫn liều dùng",
            "emergency-box": "🚨 Dấu hiệu khẩn cấp - Cần cấp cứu ngay",
          };
          const displayTitle = title || defaultTitles[kind] || "Lưu ý chuyên môn";
          htmlParts.push(
            `<div class="${kind}" data-callout="${kind}" data-title="${displayTitle}"><p><strong>${displayTitle}</strong></p>${innerHtml}</div>`
          );
        }
        continue;
      }
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const lvl = hMatch[1].length;
      htmlParts.push(`<h${lvl}>${formatInline(hMatch[2].trim())}</h${lvl}>`);
      i++;
      continue;
    }

    // Horizontal Rule
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      htmlParts.push("<hr />");
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      htmlParts.push(`<blockquote><p>${formatInline(qLines.join(" "))}</p></blockquote>`);
      continue;
    }

    // Table
    if (isTableStart(lines, i)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().length > 0) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
        const parseRow = (r: string) => {
          let tr = r.trim();
          if (tr.startsWith("|")) tr = tr.slice(1);
          if (tr.endsWith("|")) tr = tr.slice(0, -1);
          return tr.split("|").map((c) => c.trim());
        };
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);
        const ths = headers.map((h) => `<th>${formatInline(h)}</th>`).join("");
        const trs = rows.map((r) => `<tr>${r.map((c) => `<td>${formatInline(c)}</td>`).join("")}</tr>`).join("");
        htmlParts.push(`<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
        continue;
      }
    }

    // Lists
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInline(lines[i].trim().replace(/^[-*+]\s+/, ""))}</li>`);
        i++;
      }
      htmlParts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      htmlParts.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph
    const pLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const pTrim = lines[i].trim();
      if (
        pTrim.startsWith(":::") ||
        pTrim.startsWith("```") ||
        pTrim.startsWith(">") ||
        /^(#{1,6})\s+/.test(pTrim) ||
        /^[-*+]\s+/.test(pTrim) ||
        /^\d+\.\s+/.test(pTrim) ||
        isTableStart(lines, i)
      ) {
        break;
      }
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      htmlParts.push(`<p>${formatInline(pLines.join(" "))}</p>`);
    } else {
      i++;
    }
  }

  return htmlParts.join("\n");
}

export function RichContentRenderer({
  content,
  className = "",
  fallback = null,
}: RichContentRendererProps): ReactElement {
  const blocks = useMemo(() => {
    if (!content || !content.trim()) return [];
    const normalized = /<[a-z][\s\S]*>/i.test(content) ? htmlToMarkdown(content) : content;
    return parseMarkdownBlocks(normalized);
  }, [content]);

  if (blocks.length === 0) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="text-slate-400 italic text-sm py-4">
        Chưa có nội dung chi tiết.
      </div>
    );
  }

  return (
    <div className={`space-y-4 text-slate-800 leading-relaxed ${className}`}>
      <RenderBlockList blocks={blocks} />
    </div>
  );
}

export default RichContentRenderer;
