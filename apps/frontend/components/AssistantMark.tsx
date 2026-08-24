import type { CSSProperties } from "react";

interface AssistantMarkProps {
  className?: string;
  size?: number;
  title?: string;
}
/** Code-native launcher mark: a calm chat bubble whose tail becomes a pulse. */
export default function AssistantMark({ className, size = 44, title }: AssistantMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
      focusable="false"
      height={size}
      role={title ? "img" : undefined}
      style={{ "--assistant-mark-size": `${size}px` } as CSSProperties}
      viewBox="0 0 64 64"
      width={size}
    >
      <path d="M10 13.5A9.5 9.5 0 0 1 19.5 4h25A9.5 9.5 0 0 1 54 13.5v20a9.5 9.5 0 0 1-9.5 9.5H31l-12.5 9v-9h-1A9.5 9.5 0 0 1 8 33.5v-20Z" fill="currentColor" opacity=".18" />
      <path d="M13 13.5A6.5 6.5 0 0 1 19.5 7h25a6.5 6.5 0 0 1 6.5 6.5v18a6.5 6.5 0 0 1-6.5 6.5H29.8L21.5 44v-6h-2A6.5 6.5 0 0 1 13 31.5v-18Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M18 27h8l2.5-6 5 13 3-7H46" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <circle cx="46" cy="27" fill="currentColor" r="2" />
    </svg>
  );
}
