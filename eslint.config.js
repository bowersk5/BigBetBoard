// ESLint is a dev-only tool for contributors — it is not a runtime
// dependency. `npm start`, `npm run dev`, `npm run build:pages`, and
// `npm test` still work with nothing installed; `npm run lint` is the one
// command that needs `npm install` first.
import js from "@eslint/js";
import globals from "globals";

const sharedRules = {
  ...js.configs.recommended.rules,
  "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  "no-console": "off",
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
  "no-var": "error"
};

export default [
  {
    ignores: ["node_modules/**", "public/data/**", "public/nfl/**", "public/ncaaf/**", ".tracking/**"]
  },
  {
    // Server-side code: Node + ES modules.
    files: ["server.js", "src/**/*.js", "scripts/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: sharedRules
  },
  {
    // Browser code, also loaded as an ES module (see public/index.html).
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser }
    },
    rules: sharedRules
  }
];
