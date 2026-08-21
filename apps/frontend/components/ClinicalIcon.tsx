import type { SVGProps } from "react";

export type ClinicalIconName = "article" | "branch" | "service" | "specialty";

interface ClinicalIconProps extends SVGProps<SVGSVGElement> {
  name: ClinicalIconName;
}

/**
 * Small, dependency-free icon family for public catalog surfaces.
 * Keep icons structural and data-independent so backend text cannot turn into
 * an emoji or an untrusted visual primitive in the UI.
 */
export function ClinicalIcon({ name, ...props }: ClinicalIconProps) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    ...props,
  };

  if (name === "article") {
    return (
      <svg {...common}>
        <path d="M6.25 4.75h8.5a3 3 0 0 1 3 3v11.5h-9.5a2 2 0 0 0-2 2V4.75Z" />
        <path d="M8.25 19.25V7.75a3 3 0 0 1 3-3" />
        <path d="M11 9.5h4M11 13h4" />
      </svg>
    );
  }

  if (name === "branch") {
    return (
      <svg {...common}>
        <path d="M12 21s6.25-5.33 6.25-10.25a6.25 6.25 0 1 0-12.5 0C5.75 15.67 12 21 12 21Z" />
        <circle cx="12" cy="10.75" r="2.1" />
      </svg>
    );
  }

  if (name === "service") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 20.25s-7.25-4.3-7.25-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.25 2.55c0 5.9-7.25 10.2-7.25 10.2Z" />
      <path d="M8.75 12h2l1.1-2.15L13.2 14l1.05-2h1" />
    </svg>
  );
}

export default ClinicalIcon;
