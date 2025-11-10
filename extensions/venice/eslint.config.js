const raycastConfig = require("@raycast/eslint-config");
const { defineConfig } = require("eslint/config");
const importPlugin = require("eslint-plugin-import");
const promisePlugin = require("eslint-plugin-promise");
const reactHooks = require("eslint-plugin-react-hooks");
const unusedImports = require("eslint-plugin-unused-imports");
const react = require("eslint-plugin-react");
const reactCompiler = require("eslint-plugin-react-compiler");

module.exports = defineConfig([
  ...raycastConfig,
  {
    ignores: ["*.config.js", "babel.config.js"],
  },
  {
    languageOptions: {
      parserOptions: {
        // Required so rules like deprecation/deprecation can access type info
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-compiler": reactCompiler,
      import: importPlugin,
      "unused-imports": unusedImports,
      promise: promisePlugin,
      react,
    },
    rules: {
      // Enforce the Rules of Hooks
      "react-hooks/rules-of-hooks": "error",
      // Verify dependencies of hooks for stability - error to prevent bugs
      "react-hooks/exhaustive-deps": [
        "error",
        {
          // Track deps for @raycast/utils hook that accepts a deps array
          additionalHooks: "(useCachedPromise)",
        },
      ],

      // React Compiler - enforce Rules of React for optimal compilation
      "react-compiler/react-compiler": "error",

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

      // React JSX best practices
      "react/jsx-key": "error",
      "react/jsx-no-useless-fragment": ["warn", { allowExpressions: true }],
      // React Compiler handles memoization automatically, so inline functions are now fine
      "react/jsx-no-bind": "off",

      // Console usage
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Whitespace
      "no-trailing-spaces": "error",
    },
  },
]);
