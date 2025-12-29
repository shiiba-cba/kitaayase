import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  // JS 共通
  js.configs.recommended,

  // TypeScript（typescript-eslint 公式推奨）
  ...tseslint.configs.recommended,

  // React
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // React 17+ JSX import 不要
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Prettier（フォーマット系ルール無効化）
  prettier,

  // プロジェクト固有ルール
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["warn"],
    },
  },

  // ============================
  // Node.js tools scripts
  // ============================
  {
    files: ["src/tools/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      // tools では console.log を許可
      "no-console": "off",
    },
  },
];
