#!/usr/bin/env node
// PAYMENTS-SPEC §3.12: owner CLI for admin grants (comped premium / packs for specific TV installs).
//   pnpm grant <installId> [--packs a,b] [--premium] [--expires 2027-01-01] [--note text] [--url URL]
//   pnpm grant list [--url URL]
//   pnpm grant revoke <installId|installHash> [--url URL]
// The server URL comes from --url or MISHANA_URL; the token only from the ADMIN_TOKEN environment variable (never an
// argument, so it stays out of shell history and process lists). Without --packs a grant is premium; with --packs it
// is those packs only, unless --premium is given too.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const USAGE = `usage:
  pnpm grant <installId> [--packs a,b] [--premium] [--expires YYYY-MM-DD|ISO] [--note text] [--url URL]
  pnpm grant list [--url URL]
  pnpm grant revoke <installId|installHash> [--url URL]
env: ADMIN_TOKEN (required), MISHANA_URL (when --url is not given)`;

const INSTALL_ID = /^[0-9a-f]{32}$/;
const INSTALL_HASH = /^[0-9a-f]{64}$/;

/** The TV shows the id in groups ("0123 4567 …"): spaces and dashes are dropped, letters lowercased. */
export function normalizeId(raw) {
  return String(raw).replace(/[\s-]/g, "").toLowerCase();
}

/** `YYYY-MM-DD` (UTC midnight) or any ISO date-time → ms; throws on anything else or a past date. */
export function parseExpires(raw, nowMs) {
  const s = String(raw);
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : /^\d{4}-\d{2}-\d{2}T/.test(s) ? Date.parse(s) : NaN;
  if (!Number.isFinite(ms)) throw new Error(`--expires: not a date: ${s}`);
  if (ms <= nowMs) throw new Error(`--expires: ${s} is in the past`);
  return ms;
}

/**
 * Parses argv (without node and the script) into the HTTP request to make. Throws an Error (message = what is wrong)
 * on bad input. `env` supplies MISHANA_URL and ADMIN_TOKEN.
 */
export function buildRequest(argv, env, nowMs = Date.now()) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--premium") opts.premium = true;
    else if (a === "--packs" || a === "--expires" || a === "--note" || a === "--url") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      opts[a.slice(2)] = v;
      i++;
    } else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else positional.push(a);
  }
  const token = env.ADMIN_TOKEN ?? "";
  if (token === "") throw new Error("ADMIN_TOKEN is not set in the environment");
  const base = (opts.url ?? env.MISHANA_URL ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+/.test(base)) throw new Error("set --url or MISHANA_URL to the server origin (e.g. https://play.example.workers.dev)");
  const url = `${base}/api/admin/grants`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [cmd, arg, ...rest] = positional;
  if (cmd === undefined) throw new Error("missing <installId>, list or revoke");
  if (cmd === "list") {
    if (arg !== undefined || Object.keys(opts).some((k) => k !== "url")) throw new Error("list takes no arguments besides --url");
    return { kind: "list", url, init: { method: "GET", headers } };
  }
  if (cmd === "revoke") {
    const id = normalizeId(arg ?? "");
    if (rest.length > 0 || Object.keys(opts).some((k) => k !== "url")) throw new Error("revoke takes one id and --url only");
    if (INSTALL_ID.test(id)) return { kind: "revoke", url, init: { method: "DELETE", headers, body: JSON.stringify({ installId: id }) } };
    if (INSTALL_HASH.test(id)) return { kind: "revoke", url, init: { method: "DELETE", headers, body: JSON.stringify({ installHash: id }) } };
    throw new Error("revoke: expected a 32-hex install id or a 64-hex install hash (from `pnpm grant list`)");
  }
  if (arg !== undefined) throw new Error(`unexpected argument ${arg}`);
  const installId = normalizeId(cmd);
  if (!INSTALL_ID.test(installId)) throw new Error("installId must be 32 hex characters (Settings → About on the TV)");
  const body = { installId };
  if (opts.packs !== undefined) {
    const packs = opts.packs.split(",").map((p) => p.trim()).filter(Boolean);
    if (packs.length === 0) throw new Error("--packs: give at least one pack id");
    body.packs = packs;
    if (opts.premium) body.premium = true;
  } else {
    body.premium = true;
  }
  if (opts.expires !== undefined) body.expiresAt = parseExpires(opts.expires, nowMs);
  if (opts.note !== undefined) body.note = opts.note;
  return { kind: "grant", url, init: { method: "POST", headers, body: JSON.stringify(body) } };
}

function describeGrant(g) {
  const what = [g.premium ? "premium" : null, g.packs.length > 0 ? `packs ${g.packs.join(",")}` : null].filter(Boolean).join(" + ");
  const until = g.expiresAt === null ? "no end date" : `until ${new Date(g.expiresAt).toISOString()}`;
  return `${g.installHash}  ${what}  ${until}${g.active ? "" : "  (expired)"}${g.note ? `  "${g.note}"` : ""}`;
}

async function main() {
  let req;
  try {
    req = buildRequest(process.argv.slice(2), process.env);
  } catch (e) {
    console.error(`grant: ${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
    process.exit(2);
  }
  let res;
  try {
    res = await globalThis.fetch(req.url, req.init);
  } catch (e) {
    console.error(`grant: request failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  const text = await res.text();
  if (res.status === 404) {
    console.error("grant: 404 — ADMIN_TOKEN is not set on the server (wrangler secret put ADMIN_TOKEN), or the URL is wrong");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`grant: HTTP ${res.status} ${text}`);
    process.exit(1);
  }
  const body = JSON.parse(text);
  if (req.kind === "list") {
    if (body.grants.length === 0) console.log("no grants");
    for (const g of body.grants) console.log(describeGrant(g));
  } else if (req.kind === "revoke") {
    console.log(body.revoked ? `revoked ${body.installHash}` : `no grant for ${body.installHash}`);
  } else {
    console.log(`granted ${describeGrant(body.grant)}`);
    console.log("The TV picks it up on its next entitlement refresh (Store → Restore purchases, or restart the app).");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
