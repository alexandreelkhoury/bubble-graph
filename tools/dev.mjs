#!/usr/bin/env node
// Local LAN dev (SPEC §7.10): `pnpm dev`.
// Runs `wrangler dev` (Worker + Room DO + static assets, port 8787) and the Vite dev server (port 5173),
// both bound to 0.0.0.0 so the TV and phones on the same Wi-Fi can reach this machine.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PORT = 8787;
const VITE_PORT = 5173;
const isWin = process.platform === "win32";
const PNPM = isWin ? "pnpm.cmd" : "pnpm";

/** `LAN_HOST` from /.env (a plain KEY=VALUE file; comments and quotes allowed). */
function lanHostFromEnvFile() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*LAN_HOST\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const v = (m[1] ?? "").replace(/^["']|["']$/g, "").trim();
    if (v) return v;
  }
  return null;
}

/** First non-internal IPv4, preferring 192.168.*, then 10.*, then 172.16–31.*, then anything else. */
export function detectLanHost(ifaces = networkInterfaces()) {
  const addrs = [];
  for (const list of Object.values(ifaces)) {
    for (const a of list ?? []) {
      const v4 = a.family === "IPv4" || a.family === 4;
      if (v4 && !a.internal) addrs.push(a.address);
    }
  }
  const rank = (ip) => {
    if (ip.startsWith("192.168.")) return 0;
    if (ip.startsWith("10.")) return 1;
    const m = /^172\.(\d+)\./.exec(ip);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return 2;
    return 3;
  };
  addrs.sort((a, b) => rank(a) - rank(b));
  return addrs[0] ?? null;
}

function main() {
  const envHost = lanHostFromEnvFile();
  const lanHost = envHost ?? detectLanHost();
  if (!lanHost) {
    console.error("Could not detect a LAN IPv4 address. Set LAN_HOST=<your-ip> in .env (see .env.example).");
    process.exit(1);
  }

  const distIndex = join(ROOT, "web-client", "dist", "index.html");
  if (!existsSync(distIndex)) {
    console.log("web-client/dist is missing: building the web client once (wrangler serves it as static assets)…");
    const r = spawnSync(PNPM, ["--filter", "@mishana/web-client", "build"], { cwd: ROOT, stdio: "inherit", shell: isWin });
    if (r.status !== 0) {
      console.error("Web client build failed; fix it or run `pnpm --filter @mishana/web-client build` manually.");
      process.exit(r.status ?? 1);
    }
  }

  const webOrigin = `http://${lanHost}:${VITE_PORT}`;
  const wranglerArgs = [
    "--filter", "@mishana/server", "exec", "wrangler", "dev",
    "--ip", "0.0.0.0", "--port", String(SERVER_PORT),
    "--show-interactive-dev-session=false",
    "--var", `JOIN_BASE_URL:${webOrigin}`,
    "--var", `ALLOWED_ORIGINS:${webOrigin},http://localhost:${VITE_PORT}`,
    "--var", "DEBUG_INVARIANTS:1",
    // PAYMENTS-SPEC §3.10: fake billing for local dev. The Worker still requires a localhost/LAN host per request,
    // and no Play service account may be configured (server/.dev.vars), or every billing route answers 503.
    "--var", "BILLING_MODE:fake",
    "--var", "ALLOW_FAKE_BILLING:1",
  ];
  const viteArgs = ["--filter", "@mishana/web-client", "exec", "vite", "--host", "0.0.0.0", "--port", String(VITE_PORT), "--strictPort"];

  const children = [
    spawn(PNPM, wranglerArgs, { cwd: ROOT, stdio: "inherit", shell: isWin }),
    spawn(PNPM, viteArgs, { cwd: ROOT, stdio: "inherit", shell: isWin }),
  ];

  let stopping = false;
  const stopAll = (code) => {
    if (stopping) return;
    stopping = true;
    for (const c of children) if (c.exitCode === null && !c.killed) c.kill("SIGINT");
    // Give both a moment to shut down cleanly, then make sure they are gone.
    setTimeout(() => {
      for (const c of children) if (c.exitCode === null) c.kill("SIGKILL");
      process.exit(code);
    }, 3000).unref();
  };
  process.on("SIGINT", () => stopAll(0));
  process.on("SIGTERM", () => stopAll(0));
  for (const c of children) {
    c.on("exit", (code) => {
      if (!stopping) {
        console.error(`\n${c === children[0] ? "wrangler" : "vite"} exited (${code ?? "signal"}); stopping the other process.`);
        stopAll(code ?? 1);
      }
    });
  }

  console.log("");
  console.log(`LAN host: ${lanHost}${envHost ? " (from .env)" : " (auto-detected; set LAN_HOST in .env to override)"}`);
  console.log(`TV server URL: http://${lanHost}:${SERVER_PORT}   (Android TV: -PserverUrl=http://${lanHost}:${SERVER_PORT})`);
  console.log(`Phone/TV-mock: ${webOrigin}/tv`);
  console.log(`Join URLs look like: ${webOrigin}/ABCD`);
  console.log("Billing: FAKE (test store, no real payments). See docs/DEV.md \"Billing\".");
  console.log("Press Ctrl+C to stop both.\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
