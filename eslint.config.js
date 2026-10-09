import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import jsxA11y from "eslint-plugin-jsx-a11y";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "docs-site", "coverage"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
      prettierRecommended,
    ],
    files: ["**/*.{ts,tsx}"],
    settings: {
      react: { version: "detect" },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    ...jsdoc.configs["flat/recommended-typescript-error"],
    plugins: {
      ...jsdoc.configs["flat/recommended-typescript-error"].plugins,
      tsdoc,
    },
    files: ["src/**/*.ts"],
    settings: {
      jsdoc: { tagNamePreference: { template: "typeParam" } },
    },
    rules: {
      ...jsdoc.configs["flat/recommended-typescript-error"].rules,
      "jsdoc/tag-lines": "off",
      "tsdoc/syntax": "error",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param": "off",
      "jsdoc/check-param-names": "error",
      "jsdoc/no-types": "error",
      "jsdoc/check-tag-names": "error",
    },
  }
);
