import type { CSSProperties } from "react";

interface AssistantMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

/** Code-native launcher mark: Professional healthcare AI assistant with pulse and speech mark. */
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
      {/* Speech bubble silhouette with smooth rounded geometry */}
      <path
        d="M10 8h28a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H20l-7 6v-6h-3a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path
        d="M10 8h28a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H20l-7 6v-6h-3a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Precision ECG Heartbeat pulse waveform */}
      <path
        d="M12 22h5l2.5-6 4 12 3.5-8 2 2h7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* AI Intelligence Sparkle accent */}
      <circle cx="37" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}
