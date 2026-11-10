import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The e2e run talks to a real `wrangler dev` serving the built client (§14.3).
// E2E_BASE_URL points the tests at an already-running server instead.
const PORT = 8788;
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const NOBILL_PORT = 8789;
const noBillURL = process.env.E2E_NOBILL_URL ?? `http://127.0.0.1:${NOBILL_PORT}`;

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
    for (const sub of ["chrome-linux", "chrome-linux64"]) {
      const exe = join(root, d, sub, "chrome");
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}
const executablePath = chromiumExecutable();
// JAMAA-PLATFORM §2.5: the main e2e server lists every game, so each game's spec runs once its registry entry is enabled
// (a stub stays hidden: room.games = GAMES_ENABLED ∩ registry enabled). The billing-off server keeps the production
// default from wrangler.jsonc. E2E_GAMES_ENABLED overrides the list.
const E2E_GAMES = process.env.E2E_GAMES_ENABLED ?? "mishana,bluff,likely,trivia";

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
    : [
        {
          // PAYMENTS-SPEC §3.10 / §5.3: fake billing for e2e. The Worker still decides fake mode per request (the host is
          // 127.0.0.1) and never with a service account configured; specs that need no billing are unaffected.
          command: `pnpm --filter @jamaa/web-client build && pnpm --filter @jamaa/server exec wrangler dev --port ${PORT} --ip 127.0.0.1 --show-interactive-dev-session=false --var DEBUG_INVARIANTS:1 --var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1 --var BILLING_ENABLED:1 --var GAMES_ENABLED:${E2E_GAMES}`,
          cwd: "..",
          url: `${baseURL}/healthz`,
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: "ignore",
          stderr: "pipe",
        },
        {
          // JAMAA-PLATFORM §6 acceptance 7: the production default, BILLING_ENABLED "0" (wrangler.jsonc), on its own port,
          // inspector and state dir. Started after the first server, so it serves the client that one just built.
          command: `pnpm --filter @jamaa/server exec wrangler dev --port ${NOBILL_PORT} --ip 127.0.0.1 --inspector-port ${NOBILL_PORT + 1000} --persist-to .wrangler/state-e2e-nobilling --show-interactive-dev-session=false --var DEBUG_INVARIANTS:1`,
          cwd: "..",
          url: `${noBillURL}/healthz`,
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: "ignore",
          stderr: "pipe",
        },
      ],
  projects: [
    { name: "chromium", testIgnore: /billing-off\.spec\.ts$/, use: { ...devices["Desktop Chrome"] } },
    // The billing-off server: no Pass UI anywhere, the whole catalog plays (E2E_NOBILL_URL points at a running one).
    { name: "billing-off", testMatch: /billing-off\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: noBillURL } },
  ],
});
