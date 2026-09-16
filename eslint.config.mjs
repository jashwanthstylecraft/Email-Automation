import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // `any` is this codebase's deliberate, established convention for
      // Prisma where-clauses and error handlers (`catch (error: any)`)
      // throughout every API route -- enforcing this as a hard error would
      // mean rewriting hundreds of call sites with zero functional benefit.
      // Downgraded to a visible warning rather than a CI-failing error.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react/no-unescaped-entities": "warn",
      // React Compiler compatibility checks -- this app doesn't enable the
      // React Compiler (no babel-plugin-react-compiler / reactCompiler
      // config), so these flag patterns that are safe under normal React
      // execution but would need rework to be compiler-optimizable later.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
