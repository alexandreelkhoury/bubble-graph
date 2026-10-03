import { defineProject } from "vitest/config";
// `include` keeps Playwright's e2e/*.spec.ts out of the Vitest run.
export default defineProject({ test: { name: "web-client", environment: "node", passWithNoTests: true, include: ["test/**/*.test.ts"] } });
