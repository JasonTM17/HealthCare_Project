"use client";

import React, { type ReactNode } from "react";
import { renderInlineMarkdown } from "./editor/RichContentRenderer";
import { chatFieldLabel, readableChatLines } from "../lib/chat-message-format";

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

  const lines = readableChatLines(content);
  const renderText = (text: string) => {
    const field = chatFieldLabel(text);
    return field ? <><strong>{field.label}</strong>{field.value ? <> {renderInlineMarkdown(field.value)}</> : null}</>
      : renderInlineMarkdown(text);
  };
  const blocks: ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join("\n").trim();
      if (text) {
        blocks.push(
          <p key={`p-${blocks.length}`} style={{ margin: "0.35rem 0", lineHeight: 1.6, overflowWrap: "anywhere" }}>
            {renderText(text)}
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
          <ul key={`ul-${blocks.length}`} style={{ margin: "0.45rem 0", paddingLeft: "1.25rem", listStyleType: "disc", overflowWrap: "anywhere" }}>
            {currentList.items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "0.3rem", lineHeight: 1.6 }}>
                {renderText(item)}
              </li>
            ))}
          </ul>
        );
      } else {
        blocks.push(
          <ol key={`ol-${blocks.length}`} style={{ margin: "0.45rem 0", paddingLeft: "1.25rem", listStyleType: "decimal", overflowWrap: "anywhere" }}>
            {currentList.items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "0.3rem", lineHeight: 1.6 }}>
                {renderText(item)}
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

    const fence = /^(```|~~~)/.exec(trimmed);
    if (fence) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i]);
      blocks.push(<pre key={`code-${blocks.length}`} style={{ margin: "0.5rem 0", padding: "0.65rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "rgba(0,0,0,0.04)" }}><code>{code.join("\n")}</code></pre>);
      continue;
    }

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
        <strong key={`h-${blocks.length}`} style={{ display: "block", margin: "0.6rem 0 0.25rem", fontWeight: 700, color: "inherit", fontSize: "1.02em" }}>
          {renderInlineMarkdown(headingMatch[1])}
        </strong>
      );
    } else {
      flushList();
      if (chatFieldLabel(trimmed)) flushParagraph();
      currentParagraph.push(trimmed);
      if (chatFieldLabel(trimmed)) flushParagraph();
    }
  }

  flushParagraph();
  flushList();

  return <div className={className}>{blocks}</div>;
}
