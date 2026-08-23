import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next-wave-build/**"] },
  { ignores: [".next-fe-retry-action/**", ".next-floating-assistant-build/**", ".next-floating-assistant-build-2/**", ".next-chibi-build/**"] },
  ...nextVitals,
];

export default eslintConfig;
