const raycastConfig = require("@raycast/eslint-config");
const { defineConfig } = require("eslint/config");
const importPlugin = require("eslint-plugin-import");
const promisePlugin = require("eslint-plugin-promise");
const reactHooks = require("eslint-plugin-react-hooks");
const unusedImports = require("eslint-plugin-unused-imports");

module.exports = defineConfig([
  ...raycastConfig,
  {
    plugins: {
      "react-hooks": reactHooks,
      import: importPlugin,
      "unused-imports": unusedImports,
      promise: promisePlugin,
    },
    rules: {
      // Enforce the Rules of Hooks
      "react-hooks/rules-of-hooks": "error",
      // Verify dependencies of hooks for stability; warn to avoid overly noisy failures
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          // Track deps for @raycast/utils hook that accepts a deps array
          additionalHooks: "(useCachedPromise)",
        },
      ],

      // Import hygiene and performance
      "import/no-duplicates": "error",
      "import/no-cycle": ["warn", { maxDepth: 1 }],
      "import/order": [
        "warn",
        {
          groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"], ["type"]],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/newline-after-import": "warn",

      // Unused imports/vars
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],

      // Promise best practices
      "promise/catch-or-return": ["warn", { allowFinally: true }],
      "promise/always-return": "off", // allow fire-and-forget with void
      "promise/no-return-wrap": "error",

      // Restrict browser localStorage; use Raycast LocalStorage instead
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Use Raycast LocalStorage from @raycast/api" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Use Raycast LocalStorage from @raycast/api" },
        { object: "globalThis", property: "localStorage", message: "Use Raycast LocalStorage from @raycast/api" },
      ],

      // Allow void operator to signify intentionally ignored promises
      "no-void": ["error", { allowAsStatement: true }],
    },
  },
]);
