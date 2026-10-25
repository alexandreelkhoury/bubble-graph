#!/usr/bin/env node
// PAYMENTS-SPEC §3.2 / §3.10: deploy guard, run first by `pnpm --filter @mishana/server run deploy` (always `run`:
// bare `pnpm deploy` is pnpm's built-in command, not this script). Refuses to deploy unless wrangler.jsonc ships
// BILLING_MODE "google", ALLOW_FAKE_BILLING "0" and observability.traces.enabled false (traces would record outbound
// Google URLs, which carry raw purchase tokens), and has no `env` block (a named environment could override any of
// these with `wrangler deploy --env`, and is not part of the deploy flow).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Returns the list of problems (empty = OK to deploy). */
export function checkDeployConfig(jsoncText) {
  let cfg;
  try {
    cfg = JSON.parse(stripJsonc(jsoncText));
  } catch (e) {
    return [`wrangler.jsonc does not parse: ${e instanceof Error ? e.message : String(e)}`];
  }
  const errors = [];
  const vars = cfg.vars ?? {};
  if (vars.BILLING_MODE !== "google") errors.push(`vars.BILLING_MODE must be "google" (is ${JSON.stringify(vars.BILLING_MODE)})`);
  if (vars.ALLOW_FAKE_BILLING !== "0") errors.push(`vars.ALLOW_FAKE_BILLING must be "0" (is ${JSON.stringify(vars.ALLOW_FAKE_BILLING)})`);
  if (cfg.observability?.traces?.enabled !== false) errors.push("observability.traces.enabled must be false (traces record outbound URLs with purchase tokens)");
  // PAYMENTS-SPEC §3.12: ADMIN_TOKEN is an OPTIONAL secret (unset = /api/admin/* answers 404). It must never be a plain
  // `vars` entry (that would publish it in the config) nor `secrets.required` (a deploy without it must still work).
  if (Object.prototype.hasOwnProperty.call(vars, "ADMIN_TOKEN")) errors.push("vars.ADMIN_TOKEN must not exist (set it with `wrangler secret put ADMIN_TOKEN`)");
  if ((cfg.secrets?.required ?? []).includes("ADMIN_TOKEN")) errors.push("secrets.required must not list ADMIN_TOKEN (it is optional: unset turns the admin endpoints off)");
  if (cfg.env !== undefined) errors.push("wrangler.jsonc must not define `env` blocks (they could override billing vars or observability; check-deploy validates top-level config only)");
  return errors;
}

/** Billing secrets a deploy needs when BILLING_ENABLED is "1" (PAYMENTS-SPEC §6.2). */
export const BILLING_SECRETS = ["PLAY_SERVICE_ACCOUNT_JSON", "ENTITLEMENT_KEYS"];

/** True when the shipped config turns billing on, so the billing secrets must exist remotely. */
export function billingOn(jsoncText) {
  try {
    return JSON.parse(stripJsonc(jsoncText)).vars?.BILLING_ENABLED === "1";
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

function main() {
  const file = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", "wrangler.jsonc"));
  const text = readFileSync(file, "utf8");
  const errors = checkDeployConfig(text);
  if (errors.length === 0 && billingOn(text)) {
    // Billing on: the Worker needs its secrets. `wrangler secret list` prints names only, never values.
    let out = "";
    try {
      out = execFileSync("npx", ["wrangler", "secret", "list", "--format", "json"], { cwd: dirname(file), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      errors.push("BILLING_ENABLED is \"1\" but `wrangler secret list` failed (run `npx wrangler login`)");
    }
    if (out) for (const n of missingBillingSecrets(out)) errors.push(`BILLING_ENABLED is "1" but secret ${n} is not set (wrangler secret put ${n})`);
  }
  for (const e of errors) console.error(`check-deploy: ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log(`check-deploy: OK (billing ${billingOn(text) ? "ON, secrets present" : "OFF, no billing secrets needed"}; google mode, fake billing off, traces off; ADMIN_TOKEN optional)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
