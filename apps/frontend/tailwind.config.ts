import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary clinical teal (deep → light)
        primary: {
          DEFAULT: "#003336",
          container: "#004b50",
          fixed: "#b1edf2",
          "fixed-dim": "#96d1d6",
        },
        // Amber accent (CTAs, highlights, trust)
        secondary: {
          DEFAULT: "#7c5800",
          container: "#feb700",
          fixed: "#ffdea8",
          "fixed-dim": "#ffba20",
        },
        // Tertiary mint/sand support
        tertiary: {
          DEFAULT: "#20302f",
          container: "#364646",
          fixed: "#d4e6e5",
          "fixed-dim": "#b8cac9",
        },
        // Surfaces
        surface: {
          DEFAULT: "#f9f9fc",
          container: "#eeeef0",
          "container-low": "#f3f3f6",
          "container-lowest": "#ffffff",
          "container-high": "#e8e8ea",
          "container-highest": "#e2e2e5",
          bright: "#f9f9fc",
          dim: "#dadadc",
          variant: "#e2e2e5",
          tint: "#2a676c",
        },
        // Foreground / ink
        background: "#f9f9fc",
        on: {
          background: "#1a1c1e",
          surface: "#1a1c1e",
          "surface-variant": "#404849",
          primary: "#ffffff",
          "primary-container": "#7fbabf",
          "primary-fixed": "#002022",
          "primary-fixed-variant": "#074f54",
          secondary: "#ffffff",
          "secondary-container": "#6b4b00",
          "secondary-fixed": "#271900",
          "secondary-fixed-variant": "#5e4200",
          tertiary: "#ffffff",
          "tertiary-container": "#a2b3b3",
          "tertiary-fixed": "#0e1e1e",
          "tertiary-fixed-variant": "#3a4a49",
          error: "#ffffff",
        },
        // Lines / outlines
        outline: "#707979",
        "outline-variant": "#bfc8c9",
        // Error
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        // Legacy aliases used by existing page markup
        ink: {
          DEFAULT: "#1a1c1e",
          muted: "#404849",
          faint: "#6b7676",
        },
        mint: {
          100: "#d4e6e5",
          200: "#a2b3b3",
        },
        // Modal and legacy catalog aliases. Keep these named tokens in sync
        // with the focus-ring classes used by the booking and AI dialogs.
        brand: {
          50: "#effbfb",
          100: "#d6f1f2",
          200: "#b1edf2",
          300: "#7fbabf",
          400: "#5f9ca2",
          500: "#2a676c",
          600: "#0f5f65",
          700: "#0d5c63",
          800: "#004b50",
          900: "#003336",
          950: "#002022",
        },
        sand: {
          100: "#f3ead8",
          200: "#e6d9b8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Noto Sans", "sans-serif"],
        display: ["var(--font-be-vietnam-pro)", "Noto Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        pill: "9999px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        md: "0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
        lg: "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
