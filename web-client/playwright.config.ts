import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The e2e run talks to a real `wrangler dev` serving the built client (§14.3).
// E2E_BASE_URL points the tests at an already-running server instead.
const PORT = 8788;
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Environments with a pre-installed Chromium of another revision (never `playwright install` there):
 * PW_CHROMIUM_EXECUTABLE wins; otherwise use the newest chromium-* under PLAYWRIGHT_BROWSERS_PATH
 * when the revision this Playwright expects is not installed.
 */
function chromiumExecutable(): string | undefined {
  if (process.env.PW_CHROMIUM_EXECUTABLE) return process.env.PW_CHROMIUM_EXECUTABLE;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const d of dirs) {
    const exe = join(root, d, "chrome-linux", "chrome");
    if (existsSync(exe)) return exe;
  }
  return undefined;
}
const executablePath = chromiumExecutable();

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // PAYMENTS-SPEC §3.10 / §5.3: fake billing for e2e. The Worker still decides fake mode per request (the host is
        // 127.0.0.1) and never with a service account configured; specs that need no billing are unaffected.
        command: `pnpm --filter @mishana/web-client build && pnpm --filter @mishana/server exec wrangler dev --port ${PORT} --ip 127.0.0.1 --show-interactive-dev-session=false --var DEBUG_INVARIANTS:1 --var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1 --var BILLING_ENABLED:1`,
        cwd: "..",
        url: `${baseURL}/healthz`,
        reuseExistingServer: true,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
