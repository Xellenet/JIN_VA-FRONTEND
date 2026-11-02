import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // SEC-17: user text renders only as text nodes. No dangerouslySetInnerHTML.
  {
    rules: {
      "react/no-danger": "error",
    },
  },
  // The single reviewed exception: shadcn/ui's chart builds a <style> tag
  // from static config keys and var(--chart-n) colours only (SEC-22).
  {
    files: ["src/components/ui/chart.tsx"],
    rules: {
      "react/no-danger": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
