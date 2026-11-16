#!/usr/bin/env node
// PAYMENTS-SPEC §3.2 / §3.10 + docs/DEV.md "Production": deploy guard, run first by `pnpm --filter @jamaa/server run
// deploy` / `deploy:preview` (always `run`: bare `pnpm deploy` is pnpm's built-in command, not this script).
// Usage: node scripts/check-deploy.mjs --env preview|production   (no default: the target must be named)
//
// wrangler.jsonc has two Workers: the top level is PREVIEW ("play") and `env.production` is PRODUCTION ("jamaa"). Any
// other `env` entry is refused (a stray environment could re-enable fake billing or traces outside this guard).
// Both targets need: BILLING_MODE "google", ALLOW_FAKE_BILLING "0", PLAY_PACKAGE_NAME "app.jamaa.tv", known
// GAMES_ENABLED ids, traces off (they would record outbound Google URLs, which carry raw purchase tokens), ADMIN_TOKEN
// never a var nor a required secret, AE_DATASET = the EVENTS binding's dataset.
// Production adds: DEBUG_INVARIANTS "0", no placeholder/non-https URL vars, its own Worker name, Durable Objects,
// rate-limit ids and Analytics Engine dataset (never preview's), and NO draft content in server/content-dist (the
// packs the Worker bundles), whatever the lint said.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** = shared/src/games/ids.ts GAME_IDS (server/test/scripts/check-deploy.test.ts checks they agree). */
export const GAME_IDS = ["mishana", "bluff", "likely", "trivia", "taqriban"];

/** The deploy targets: preview = top-level config, production = `env.production`. */
export const TARGETS = ["preview", "production"];
export const PRODUCTION_NAME = "jamaa";
/** Wrangler keys a named environment does NOT inherit (wrangler 4.147 notInheritable; repeated in env.production). */
export const NOT_INHERITED = ["vars", "durable_objects", "ratelimits", "analytics_engine_datasets", "send_email"];

/** Strips // and block comments and trailing commas from JSONC, leaving string contents untouched. */
export function stripJsonc(text) {
  let out = "";
  let i = 0;
  let inStr = false;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
    } else if (c === '"') {
      inStr = true;
      out += c;
      i++;
    } else if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function parse(jsoncText) {
  return JSON.parse(stripJsonc(jsoncText));
}

/**
 * The config wrangler deploys for `target`: the top level for preview; for production, `env.production` over the top
 * level for inherited keys, and `env.production` ALONE for the non-inherited ones (a missing one is a missing binding).
 */
export function resolveTarget(cfg, target) {
  const { env, ...top } = cfg;
  if (target === "preview") return top;
  const e = env?.production ?? {};
  const out = { ...top, ...e, name: e.name ?? `${top.name}-production` };
  for (const k of NOT_INHERITED) out[k] = e[k];
  return out;
}

const PLACEHOLDER_RE = /example\.|<|>|your-|changeme|todo/i;

/** Returns the list of problems with the wrangler.jsonc config for `target` (empty = OK to deploy). */
export function checkDeployConfig(jsoncText, target = "preview") {
  if (!TARGETS.includes(target)) return [`unknown deploy target ${JSON.stringify(target)} (use --env ${TARGETS.join("|")})`];
  let raw;
  try {
    raw = parse(jsoncText);
  } catch (e) {
    return [`wrangler.jsonc does not parse: ${e instanceof Error ? e.message : String(e)}`];
  }
  const errors = [];
  // Whole-file rule: the only named environment is production (anything else escapes this guard).
  const envNames = Object.keys(raw.env ?? {});
  for (const n of envNames) if (n !== "production") errors.push(`env.${n} is not allowed (only env.production; check-deploy validates preview and production only)`);
  if (target === "production" && !envNames.includes("production")) return [...errors, "env.production is missing"];

  const cfg = resolveTarget(raw, target);
  const where = target === "production" ? "env.production." : "";
  const vars = cfg.vars ?? {};
  if (vars.BILLING_MODE !== "google") errors.push(`${where}vars.BILLING_MODE must be "google" (is ${JSON.stringify(vars.BILLING_MODE)})`);
  if (vars.ALLOW_FAKE_BILLING !== "0") errors.push(`${where}vars.ALLOW_FAKE_BILLING must be "0" (is ${JSON.stringify(vars.ALLOW_FAKE_BILLING)})`);
  // JAMAA-PLATFORM §1.6 O6: the Play package is app.jamaa.tv (a new Play app; the old package was never published).
  if (vars.PLAY_PACKAGE_NAME !== "app.jamaa.tv") errors.push(`${where}vars.PLAY_PACKAGE_NAME must be "app.jamaa.tv" (is ${JSON.stringify(vars.PLAY_PACKAGE_NAME)})`);
  // JAMAA-PLATFORM §2.6: GAMES_ENABLED lists known game ids only (the runtime ignores unknown ones; a deploy must not).
  const games = String(vars.GAMES_ENABLED ?? "mishana").split(",").map((x) => x.trim()).filter((x) => x.length > 0);
  const unknownGames = games.filter((x) => !GAME_IDS.includes(x));
  if (unknownGames.length > 0) errors.push(`${where}vars.GAMES_ENABLED has unknown game id(s) ${unknownGames.join(", ")} (known: ${GAME_IDS.join(", ")})`);
  if (cfg.observability?.traces?.enabled !== false) errors.push(`${where}observability.traces.enabled must be false (traces record outbound URLs with purchase tokens)`);
  // PAYMENTS-SPEC §3.12: ADMIN_TOKEN is an OPTIONAL secret (unset = /api/admin/* answers 404). It must never be a plain
  // `vars` entry (that would publish it in the config) nor `secrets.required` (a deploy without it must still work).
  if (Object.prototype.hasOwnProperty.call(vars, "ADMIN_TOKEN")) errors.push(`${where}vars.ADMIN_TOKEN must not exist (set it with \`wrangler secret put ADMIN_TOKEN\`)`);
  if ((cfg.secrets?.required ?? []).includes("ADMIN_TOKEN")) errors.push(`${where}secrets.required must not list ADMIN_TOKEN (it is optional: unset turns the admin endpoints off)`);
  // The /admin history queries AE_DATASET; it must be the dataset this Worker writes.
  const events = (cfg.analytics_engine_datasets ?? []).find((d) => d?.binding === "EVENTS");
  if (events && vars.AE_DATASET !== undefined && vars.AE_DATASET !== events.dataset) {
    errors.push(`${where}vars.AE_DATASET (${JSON.stringify(vars.AE_DATASET)}) must equal the EVENTS dataset (${JSON.stringify(events.dataset)})`);
  }
  if (target === "production") errors.push(...productionRules(raw, cfg, vars));
  return errors;
}

/** Production-only rules: no debug, no placeholders, nothing shared with preview, every binding present. */
function productionRules(raw, cfg, vars) {
  const errors = [];
  const top = resolveTarget(raw, "preview");
  const p = "env.production.";
  if (cfg.name !== PRODUCTION_NAME) errors.push(`${p}name must be "${PRODUCTION_NAME}" (is ${JSON.stringify(cfg.name)})`);
  if (cfg.name === top.name) errors.push(`${p}name must differ from the preview Worker's name`);
  if (vars.DEBUG_INVARIANTS !== "0") errors.push(`${p}vars.DEBUG_INVARIANTS must be "0" (is ${JSON.stringify(vars.DEBUG_INVARIANTS)})`);
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === "string" && PLACEHOLDER_RE.test(v)) errors.push(`${p}vars.${k} looks like a placeholder (${JSON.stringify(v)})`);
  }
  for (const k of ["JOIN_BASE_URL", "RTDN_AUDIENCE"]) {
    const v = vars[k] ?? "";
    if (v !== "" && (!v.startsWith("https://") || v.endsWith("/"))) errors.push(`${p}vars.${k} must be empty or an https:// URL without a trailing slash (is ${JSON.stringify(v)})`);
  }
  for (const r of [...(cfg.routes ?? []), ...(cfg.route ? [cfg.route] : [])]) {
    const pattern = typeof r === "string" ? r : r?.pattern;
    if (typeof pattern !== "string" || PLACEHOLDER_RE.test(pattern)) errors.push(`${p}routes has a placeholder pattern (${JSON.stringify(pattern)})`);
  }
  for (const k of NOT_INHERITED) if (raw.env.production[k] === undefined) errors.push(`${p}${k} is missing (wrangler does not inherit it from the top level)`);
  // Own data: the same Durable Object bindings as preview (the code expects them), own rate-limit counters and dataset.
  const doNames = (c) => (c.durable_objects?.bindings ?? []).map((b) => `${b.name}:${b.class_name}`).sort().join(",");
  if (cfg.durable_objects && doNames(cfg) !== doNames(top)) errors.push(`${p}durable_objects.bindings must match the preview bindings (${doNames(top)})`);
  const rlNames = (c) => (c.ratelimits ?? []).map((r) => r.name).sort().join(",");
  if (cfg.ratelimits && rlNames(cfg) !== rlNames(top)) errors.push(`${p}ratelimits must define the same limiters as preview (${rlNames(top)})`);
  const previewIds = new Set((top.ratelimits ?? []).map((r) => String(r.namespace_id)));
  const shared = (cfg.ratelimits ?? []).filter((r) => previewIds.has(String(r.namespace_id))).map((r) => r.namespace_id);
  if (shared.length > 0) errors.push(`${p}ratelimits namespace_id ${shared.join(", ")} also used by preview (the counters would be shared)`);
  const topEvents = (top.analytics_engine_datasets ?? []).find((d) => d?.binding === "EVENTS")?.dataset;
  const events = (cfg.analytics_engine_datasets ?? []).find((d) => d?.binding === "EVENTS")?.dataset;
  if (cfg.analytics_engine_datasets && !events) errors.push(`${p}analytics_engine_datasets needs the EVENTS binding`);
  if (events && events === topEvents) errors.push(`${p}analytics_engine_datasets EVENTS must not be preview's dataset ${JSON.stringify(topEvents)}`);
  return errors;
}

/** Matches a draft marker in an emitted pack: a pack header `"status":"draft"` or an item `"review":{"status":"draft"}`. */
const DRAFT_RE = /"status":"draft"/g;

/**
 * Production content gate: the packs the Worker bundles (server/content-dist/<game>/*.txt, written by
 * `pnpm lint:content --emit`) must exist and contain no draft pack or item. Returns problems (empty = OK).
 */
export function draftContentProblems(distDir) {
  if (!existsSync(distDir)) return [`${distDir} is missing (run \`pnpm lint:content --emit\`)`];
  const problems = [];
  let n = 0;
  for (const game of GAME_IDS) {
    const dir = join(distDir, game);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".txt")).sort()) {
      n++;
      const hits = (readFileSync(join(dir, f), "utf8").match(DRAFT_RE) ?? []).length;
      if (hits > 0) problems.push(`content-dist/${game}/${f}: ${hits} draft marker(s) (production ships reviewed content only)`);
    }
  }
  if (n === 0) problems.push(`${distDir} has no packs (run \`pnpm lint:content --emit\`)`);
  return problems;
}

/** Billing secrets a deploy needs when BILLING_ENABLED is "1" (PAYMENTS-SPEC §6.2). */
export const BILLING_SECRETS = ["PLAY_SERVICE_ACCOUNT_JSON", "ENTITLEMENT_KEYS"];

/** True when the shipped config for `target` turns billing on, so the billing secrets must exist remotely. */
export function billingOn(jsoncText, target = "preview") {
  try {
    return resolveTarget(parse(jsoncText), target).vars?.BILLING_ENABLED === "1";
  } catch {
    return false;
  }
}

/** Given `wrangler secret list --format json` output, the billing secrets that are missing. */
export function missingBillingSecrets(secretListJson) {
  let names = [];
  try {
    const list = JSON.parse(secretListJson);
    names = Array.isArray(list) ? list.map((x) => x?.name).filter((n) => typeof n === "string") : [];
  } catch {
    return [...BILLING_SECRETS];
  }
  return BILLING_SECRETS.filter((n) => !names.includes(n));
}

/**
 * Non-blocking reminders (printed, never fail the deploy): billing switched on while the RTDN vars are still empty.
 * That deploy is valid (the Play RTDN push answers 503 NOT_CONFIGURED and refunds/cancellations are only picked up by
 * the daily cron and the TV's refreshes), but it should not stay that way (docs/BILLING-LAUNCH.md step 5).
 */
export function deployWarnings(jsoncText, target = "preview") {
  let vars;
  try {
    vars = resolveTarget(parse(jsoncText), target).vars ?? {};
  } catch {
    return [];
  }
  if (vars.BILLING_ENABLED !== "1") return [];
  const empty = ["RTDN_AUDIENCE", "RTDN_SA_EMAIL", "RTDN_SUBSCRIPTION"].filter((k) => !vars[k]);
  return empty.length > 0 ? [`BILLING_ENABLED is "1" but ${empty.join(", ")} empty: Play's RTDN push will answer 503 until set`] : [];
}

/** `--env <target>` or `--env=<target>` from argv; null when absent. */
export function targetFromArgs(argv) {
  const i = argv.indexOf("--env");
  if (i >= 0) return argv[i + 1] ?? "";
  const eq = argv.find((a) => a.startsWith("--env="));
  return eq ? eq.slice("--env=".length) : null;
}

function main() {
  const target = targetFromArgs(process.argv.slice(2));
  if (target === null || !TARGETS.includes(target)) {
    console.error(`check-deploy: name the target: --env ${TARGETS.join("|")} (got ${JSON.stringify(target)}). Use \`pnpm run deploy\` (production) or \`pnpm run deploy:preview\`.`);
    process.exit(1);
  }
  const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const file = join(serverDir, "wrangler.jsonc");
  const text = readFileSync(file, "utf8");
  const errors = checkDeployConfig(text, target);
  if (target === "production") errors.push(...draftContentProblems(join(serverDir, "content-dist")));
  for (const w of deployWarnings(text, target)) console.warn(`check-deploy: warning: ${w}`);
  const on = billingOn(text, target);
  if (errors.length === 0 && on) {
    // Billing on: the Worker needs its secrets. `wrangler secret list` prints names only, never values.
    let out = "";
    const envArgs = target === "production" ? ["--env", "production"] : [];
    try {
      out = execFileSync("npx", ["wrangler", "secret", "list", ...envArgs, "--format", "json"], { cwd: serverDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      errors.push("BILLING_ENABLED is \"1\" but `wrangler secret list` failed (run `npx wrangler login`)");
    }
    const flag = envArgs.length > 0 ? " --env production" : "";
    if (out) for (const n of missingBillingSecrets(out)) errors.push(`BILLING_ENABLED is "1" but secret ${n} is not set (wrangler secret put ${n}${flag})`);
  }
  for (const e of errors) console.error(`check-deploy [${target}]: ${e}`);
  if (errors.length > 0) process.exit(1);
  const extra = target === "production" ? "; no debug, no placeholders, own bindings, no draft content" : "";
  console.log(`check-deploy [${target}]: OK (billing ${on ? "ON, secrets present" : "OFF, no billing secrets needed"}; google mode, fake billing off, traces off; ADMIN_TOKEN optional${extra})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
