const { defineConfig } = require("eslint/config");
const raycastConfig = require("@raycast/eslint-config");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = defineConfig([
  ...raycastConfig,
  {
    plugins: {
      "react-hooks": reactHooks,
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
    },
  },
]);
