import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.wrangler/**",
      "coverage/**",
      "tv-app/**",
      "web-client/test-results/**",
      "web-client/playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly", setTimeout: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  // PAYMENTS-SPEC §3.9: billing code logs only through billingLog (log.ts), which redacts every free-form string.
  {
    files: ["server/src/billing/**/*.ts"],
    ignores: ["server/src/billing/log.ts"],
    rules: { "no-console": "error" },
  },
  // PAYMENTS-SPEC §3.2: only billing code may read the Play service-account secret (the Room DO never does).
  {
    files: ["server/src/**/*.ts"],
    ignores: ["server/src/billing/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='PLAY_SERVICE_ACCOUNT_JSON']",
          message: "Only server/src/billing/** may read PLAY_SERVICE_ACCOUNT_JSON (PAYMENTS-SPEC §3.2).",
        },
      ],
    },
  },
);
