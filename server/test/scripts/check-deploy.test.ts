// PAYMENTS-SPEC §3.2 / §3.10 / §7.2: the deploy guard.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { billingOn, checkDeployConfig, deployWarnings, missingBillingSecrets, stripJsonc } from "../../scripts/check-deploy.mjs";

const REAL = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");

describe("check-deploy", () => {
  it("accepts the shipped wrangler.jsonc", () => {
    expect(checkDeployConfig(REAL)).toEqual([]);
  });
  it("ADMIN_TOKEN stays optional: never a plain var, never a required secret", () => {
    expect(checkDeployConfig(REAL.replace('"DEBUG_INVARIANTS": "0",', '"DEBUG_INVARIANTS": "0", "ADMIN_TOKEN": "x",')).join()).toMatch(/vars.ADMIN_TOKEN/);
    const withReq = REAL.replace('"vars": {', '"secrets": { "required": ["ADMIN_TOKEN"] }, "vars": {');
    expect(withReq).not.toBe(REAL);
    expect(checkDeployConfig(withReq).join()).toMatch(/secrets.required/);
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
  it("billing secrets are not required by wrangler, so a billing-off deploy works", () => {
    expect(JSON.parse(stripJsonc(REAL)).secrets?.required ?? []).not.toContain("PLAY_SERVICE_ACCOUNT_JSON");
    expect(billingOn(REAL)).toBe(false);
    expect(billingOn(REAL.replace('"BILLING_ENABLED": "0"', '"BILLING_ENABLED": "1"'))).toBe(true);
  });
  it("billing on: reports each missing billing secret from `wrangler secret list` output", () => {
    expect(missingBillingSecrets("[]")).toEqual(["PLAY_SERVICE_ACCOUNT_JSON", "ENTITLEMENT_KEYS"]);
    expect(missingBillingSecrets('[{"name":"ENTITLEMENT_KEYS","type":"secret_text"}]')).toEqual(["PLAY_SERVICE_ACCOUNT_JSON"]);
    expect(missingBillingSecrets('[{"name":"PLAY_SERVICE_ACCOUNT_JSON"},{"name":"ENTITLEMENT_KEYS"}]')).toEqual([]);
    expect(missingBillingSecrets("not json")).toEqual(["PLAY_SERVICE_ACCOUNT_JSON", "ENTITLEMENT_KEYS"]);
  });
  it("warns (never fails) when billing is switched on with empty RTDN vars", () => {
    expect(deployWarnings(REAL)).toEqual([]); // ships BILLING_ENABLED "0"
    const on = REAL.replace('"BILLING_ENABLED": "0"', '"BILLING_ENABLED": "1"');
    expect(on).not.toBe(REAL);
    expect(deployWarnings(on)).toEqual([expect.stringMatching(/RTDN_AUDIENCE, RTDN_SA_EMAIL, RTDN_SUBSCRIPTION/)]);
    expect(checkDeployConfig(on)).toEqual([]);
    const configured = on.replace('"RTDN_AUDIENCE": ""', '"RTDN_AUDIENCE": "https://x/api/billing/rtdn"')
      .replace('"RTDN_SA_EMAIL": ""', '"RTDN_SA_EMAIL": "a@b"').replace('"RTDN_SUBSCRIPTION": ""', '"RTDN_SUBSCRIPTION": "projects/p/subscriptions/s"');
    expect(deployWarnings(configured)).toEqual([]);
  });

  it("JSONC stripping keeps // inside strings and drops trailing commas", () => {
    expect(JSON.parse(stripJsonc('{ "a": "https://x//y", // c\n "b": [1,2,], /* z */ }'))).toEqual({ a: "https://x//y", b: [1, 2] });
  });
});
