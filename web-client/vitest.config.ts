import { defineProject } from "vitest/config";
import { i18nSplit } from "./vite.config";
// `include` keeps Playwright's e2e/*.spec.ts out of the Vitest run.
export default defineProject({ plugins: [i18nSplit()], test: { name: "web-client", environment: "node", passWithNoTests: true, include: ["test/**/*.test.ts"] } });
