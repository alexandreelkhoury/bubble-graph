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
      "growth/**", // marketing tooling (Remotion video, landing site, docs): own configs
      "drafts/**", // archive of tarballs + the per-game workflow script (docs/HANDOFF.md), not product code
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
      // `_`-prefixed names are deliberately unused (stub signatures, destructuring that drops a key).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  // JAMAA-PLATFORM §2.1 phone bundle guard: no engine, registry, content or zod at runtime in the web client
  // (type-only imports stay allowed, e.g. `import type { … } from "@jamaa/shared/protocol"`).
  {
    files: ["web-client/src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "zod", message: "zod stays out of the phone bundle (JAMAA-PLATFORM §2.1).", allowTypeImports: true },
            { name: "@jamaa/shared/games/registry", message: "Server/sim only: use @jamaa/shared/games/meta (JAMAA-PLATFORM §2.1).", allowTypeImports: true },
            { name: "@jamaa/shared/content", message: "Server only (JAMAA-PLATFORM §2.1).", allowTypeImports: true },
            { name: "@jamaa/shared/engine", message: "Engines stay on the server: use games/meta or games/<id>/meta (JAMAA-PLATFORM §2.1).", allowTypeImports: true },
            { name: "@jamaa/shared/room", message: "Server only (JAMAA-PLATFORM §2.1).", allowTypeImports: true },
          ],
          patterns: [
            { group: ["@jamaa/shared/games/*/definition", "**/engine", "**/engine/*", "**/content", "@jamaa/shared/content/*"], message: "Server only (JAMAA-PLATFORM §2.1).", allowTypeImports: true },
          ],
        },
      ],
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
