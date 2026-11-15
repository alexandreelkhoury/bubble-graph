import { readFileSync } from "node:fs";
import { defineProject } from "vitest/config";

// The admin page ships as wrangler Text modules (src/monitor/admin-ui/*.txt). Vite would import them as asset URLs;
// load them as strings, like wrangler's Text rule does. (The content-dist modules keep Vite's default: the Node tests
// install the @jamaa/content JSON instead, test/support/setup.ts.)
const adminText = {
  name: "admin-ui-text",
  enforce: "pre" as const,
  load(id: string): string | null {
    const file = id.split("?")[0] ?? id;
    return /[\\/]admin-ui[\\/][^\\/]+\.txt$/.test(file) ? `export default ${JSON.stringify(readFileSync(file, "utf8"))};` : null;
  },
};

export default defineProject({
  plugins: [adminText],
  test: { name: "server", environment: "node", passWithNoTests: true, setupFiles: ["./test/support/setup.ts"] },
});
