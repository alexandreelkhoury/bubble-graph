import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// The content package lives in word-packs/ until lane D's `git mv` to content/ (JAMAA-PLATFORM §5.1); test whichever exists.
const contentDir = existsSync(new URL("./content/package.json", import.meta.url)) ? "content" : "word-packs";

export default defineConfig({
  test: {
    projects: ["shared", "server", "web-client", contentDir, "tools/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/src/games/*/engine/**", "shared/src/room/**"],
      thresholds: { branches: 90, lines: 90, functions: 90, statements: 90 },
    },
  },
});
