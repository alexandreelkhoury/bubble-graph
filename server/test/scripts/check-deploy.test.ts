// PAYMENTS-SPEC §3.2 / §3.10 / §7.2: the deploy guard.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkDeployConfig, stripJsonc } from "../../scripts/check-deploy.mjs";

const REAL = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");

describe("check-deploy", () => {
  it("accepts the shipped wrangler.jsonc", () => {
    expect(checkDeployConfig(REAL)).toEqual([]);
  });
  it("ADMIN_TOKEN stays optional: never a plain var, never a required secret", () => {
    expect(checkDeployConfig(REAL.replace('"DEBUG_INVARIANTS": "0",', '"DEBUG_INVARIANTS": "0", "ADMIN_TOKEN": "x",')).join()).toMatch(/vars.ADMIN_TOKEN/);
    expect(checkDeployConfig(REAL.replace('"ENTITLEMENT_KEYS"]', '"ENTITLEMENT_KEYS", "ADMIN_TOKEN"]')).join()).toMatch(/secrets.required/);
  });
  it("rejects non-google billing vars", () => {
    expect(checkDeployConfig(REAL.replace('"BILLING_MODE": "google"', '"BILLING_MODE": "fake"')).join()).toMatch(/BILLING_MODE/);
    expect(checkDeployConfig(REAL.replace('"ALLOW_FAKE_BILLING": "0"', '"ALLOW_FAKE_BILLING": "1"')).join()).toMatch(/ALLOW_FAKE_BILLING/);
  });
  it("rejects traces that are not explicitly disabled", () => {
    expect(checkDeployConfig(REAL.replace('"traces": { "enabled": false }', '"traces": { "enabled": true }')).join()).toMatch(/traces/);
    expect(checkDeployConfig(REAL.replace(', "traces": { "enabled": false }', "")).join()).toMatch(/traces/);
  });
  it("rejects any `env` block (a named environment could re-enable fake billing or traces)", () => {
    const withEnv = REAL.replace(/\}\s*$/, ', "env": { "staging": { "vars": { "BILLING_MODE": "fake", "ALLOW_FAKE_BILLING": "1" } } } }');
    expect(withEnv).not.toBe(REAL);
    expect(checkDeployConfig(withEnv).join()).toMatch(/env/);
  });
  it("JSONC stripping keeps // inside strings and drops trailing commas", () => {
    expect(JSON.parse(stripJsonc('{ "a": "https://x//y", // c\n "b": [1,2,], /* z */ }'))).toEqual({ a: "https://x//y", b: [1, 2] });
  });
});
