import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", ".next-*/**", "test-results/**"] },
  ...nextVitals,
];

export default eslintConfig;
