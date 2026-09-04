import React from "react";

export type IconName =
  | "activity"
  | "alert-triangle"
  | "arrow-right"
  | "arrow-up-right"
  | "award"
  | "book-open"
  | "brain"
  | "building"
  | "calendar"
  | "check"
  | "chevron-right"
  | "clock"
  | "heart"
  | "eye"
  | "eye-off"
  | "layers"
  | "location"
  | "mail"
  | "menu"
  | "message-square"
  | "phone"
  | "play"
  | "plus"
  | "printer"
  | "search"
  | "shield"
  | "shield-check"
  | "send"
  | "sparkles"
  | "star"
  | "stethoscope"
  | "trash"
  | "user"
  | "x";

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
}) => {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };

  const paths: Record<IconName, React.ReactNode> = {
    activity: <path {...commonProps} d="M3 12h4l2.2-7 4.2 14 2.2-7H21" />,
    "alert-triangle": <path {...commonProps} d="m12 4 9 16H3L12 4Zm0 5v4m0 3h.01" />,
    "arrow-right": <path {...commonProps} d="M4 12h15m-6-6 6 6-6 6" />,
    "arrow-up-right": <path {...commonProps} d="M5 19 19 5m0 0H9m10 0v10" />,
    award: (
      <>
        <circle {...commonProps} cx="12" cy="8" r="6" />
        <path {...commonProps} d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.738.536L12 19.47l-4.254 2.482a.5.5 0 0 1-.738-.536l1.515-8.526" />
      </>
    ),
    "book-open": (
      <path {...commonProps} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22V5.5Z" />
    ),
    brain: (
      <path
        {...commonProps}
        d="M9.3 4.2A3.2 3.2 0 0 0 6 7.3a3.4 3.4 0 0 0 .3 1.4A3.5 3.5 0 0 0 4 12a3.5 3.5 0 0 0 2.3 3.3A3.5 3.5 0 0 0 10 19h2V5.2a3.1 3.1 0 0 0-2.7-1Zm5.4 0A3.2 3.2 0 0 1 18 7.3a3.4 3.4 0 0 1-.3 1.4A3.5 3.5 0 0 1 20 12a3.5 3.5 0 0 1-2.3 3.3A3.5 3.5 0 0 1 14 19h-2V5.2a3.1 3.1 0 0 1 2.7-1ZM8 8.5h2m-4 4h4m4-4h2m-2 4h4m-8 3h2m2 0h2"
      />
    ),
    building: (
      <path {...commonProps} d="M4 21h16M6 21V5l6-3 6 3v16M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" />
    ),
    calendar: (
      <path {...commonProps} d="M6 3v3m12-3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Zm3 8h.01m3.49 0H12m3.5 0h.01M8.5 16h.01m3.49 0H12" />
    ),
    check: <path {...commonProps} d="m5 12 4 4L19 6" />,
    "chevron-right": <path {...commonProps} d="m9 5 7 7-7 7" />,
    clock: <path {...commonProps} d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    heart: <path {...commonProps} d="M20.8 8.6c0 5.2-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.3Z" />,
    eye: <><path {...commonProps} d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z" /><circle {...commonProps} cx="12" cy="12" r="2.2" /></>,
    "eye-off": <><path {...commonProps} d="m3 3 18 18M10.6 6.9A10.8 10.8 0 0 1 12 7c6.2 0 9.5 5 9.5 5a17 17 0 0 1-3.2 3.4M6.2 6.2C3.8 7.5 2.5 12 2.5 12s3.3 5 9.5 5a9 9 0 0 0 2.4-.3" /></>,
    layers: (
      <path {...commonProps} d="m12 3 8 4-8 4-8-4 8-4Zm-8 9 8 4 8-4M4 17l8 4 8-4" />
    ),
    location: <path {...commonProps} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
    mail: <path {...commonProps} d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Zm1 0 7 5 7-5M5 18l5-5m9 5-5-5" />,
    menu: <path {...commonProps} d="M4 7h16M4 12h16M4 17h16" />,
    "message-square": <path {...commonProps} d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-4.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" />,
    phone: <path {...commonProps} d="M6.5 3.5 9 3l2 5-1.8 1.8a15 15 0 0 0 5 5L16 13l5 2 .5 2.5A2 2 0 0 1 19.5 20C10.4 20 4 13.6 4 4.5a2 2 0 0 1 2.5-1Z" />,
    play: <path {...commonProps} d="m8 5 11 7-11 7V5Z" />,
    plus: <path {...commonProps} d="M12 5v14M5 12h14" />,
    printer: <path {...commonProps} d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Zm10-4h.01" />,
    search: <path {...commonProps} d="m20 20-4.5-4.5m2-5.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />,
    shield: <path {...commonProps} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    "shield-check": <path {...commonProps} d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4" />,
    send: <path {...commonProps} d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2" />,
    sparkles: <path {...commonProps} d="m12 3 1.1 4.3L17 9l-3.9 1.7L12 15l-1.1-4.3L7 9l3.9-1.7L12 3Zm6 10 .6 2.4L21 16l-2.4.6L18 19l-.6-2.4L15 16l2.4-.6L18 13ZM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z" />,
    star: <polygon {...commonProps} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    stethoscope: <path {...commonProps} d="M6 3v5a4 4 0 0 0 8 0V3M4 3h4m4 0h4m-4 5v4a5 5 0 0 0 10 0v-1m-1-3h.01" />,
    trash: <path {...commonProps} d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7" />,
    user: <path {...commonProps} d="M19 21a7 7 0 0 0-14 0m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
    x: <path {...commonProps} d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
};

export default Icon;
