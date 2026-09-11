"use client";

import React, { type ReactNode } from "react";
import { renderInlineMarkdown } from "./editor/RichContentRenderer";

export interface ChatMessageContentProps {
  content: string;
  className?: string;
}

/**
 * Safely renders chat message content with rich markdown formatting (bold, italic,
 * bullet lists, numbered lists, sub-headings) without innerHTML or XSS vulnerability.
 */
export default function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join("\n").trim();
      if (text) {
        blocks.push(
          <p key={`p-${blocks.length}`} style={{ margin: "0.3rem 0", lineHeight: 1.55, overflowWrap: "anywhere" }}>
            {renderInlineMarkdown(text)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      if (currentList.type === "ul") {
        blocks.push(
          <ul key={`ul-${blocks.length}`} style={{ margin: "0.35rem 0", paddingLeft: "1.25rem", listStyleType: "disc", overflowWrap: "anywhere" }}>
            {currentList.items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "0.2rem", lineHeight: 1.5 }}>
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
      } else {
        blocks.push(
          <ol key={`ol-${blocks.length}`} style={{ margin: "0.35rem 0", paddingLeft: "1.25rem", listStyleType: "decimal", overflowWrap: "anywhere" }}>
            {currentList.items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "0.2rem", lineHeight: 1.5 }}>
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = /^[*\-•]\s+(.*)$/.exec(trimmed);
    const numMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    const headingMatch = /^#{1,4}\s+(.*)$/.exec(trimmed);

    if (bulletMatch) {
      flushParagraph();
      if (currentList && currentList.type !== "ul") flushList();
      if (!currentList) currentList = { type: "ul", items: [] };
      currentList.items.push(bulletMatch[1]);
    } else if (numMatch) {
      flushParagraph();
      if (currentList && currentList.type !== "ol") flushList();
      if (!currentList) currentList = { type: "ol", items: [] };
      currentList.items.push(numMatch[2]);
    } else if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push(
        <strong key={`h-${blocks.length}`} style={{ display: "block", margin: "0.45rem 0 0.2rem", fontWeight: 700, color: "inherit", fontSize: "0.95em" }}>
          {renderInlineMarkdown(headingMatch[1])}
        </strong>
      );
    } else {
      flushList();
      currentParagraph.push(trimmed);
    }
  }

  flushParagraph();
  flushList();

  return <div className={className}>{blocks}</div>;
}
