import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    projects: ["shared", "server", "web-client", "word-packs", "tools/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/src/engine/**"],
      thresholds: { branches: 90, lines: 90, functions: 90, statements: 90 },
    },
  },
});
