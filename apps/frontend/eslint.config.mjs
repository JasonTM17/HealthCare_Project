import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", ".next-*/**", "test-results/**", "public/tinymce/**"] },
  ...nextVitals,
];

export default eslintConfig;
