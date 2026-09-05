import type { CSSProperties } from "react";

interface AssistantMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

/** Code-native launcher mark: friendly healthcare chat with a calm heart cue. */
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
      viewBox="0 0 48 48"
      width={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 8.5h27a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H22l-8.5 5.5v-5.5h-3a6 6 0 0 1-6-6v-15a6 6 0 0 1 6-6z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M10.5 8.5h27a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H22l-8.5 5.5v-5.5h-3a6 6 0 0 1-6-6v-15a6 6 0 0 1 6-6z"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 22h4.2l2.1-4.8 3.1 9.3 2.4-4.5H33"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 31.8c2.7 0 5.1-1 6.7-2.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M24 18.3c-1.9-3.2-6.9-1.9-6.9 2.1 0 3.7 6.9 7 6.9 7s6.9-3.3 6.9-7c0-4-5-5.3-6.9-2.1z"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </svg>
  );
}
