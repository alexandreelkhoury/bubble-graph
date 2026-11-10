// PAYMENTS-SPEC §3.2 / §3.10 / §7.2: the deploy guard.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAME_IDS as SHARED_GAME_IDS } from "@jamaa/shared/games/ids";
import { billingOn, checkDeployConfig, deployWarnings, GAME_IDS, missingBillingSecrets, stripJsonc } from "../../scripts/check-deploy.mjs";

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
  it("requires the JAMAA Play package (JAMAA-PLATFORM §1.6 O6)", () => {
    const old = REAL.replace('"PLAY_PACKAGE_NAME": "app.jamaa.tv"', '"PLAY_PACKAGE_NAME": "app.example.tv"');
    expect(old).not.toBe(REAL);
    expect(checkDeployConfig(old).join()).toMatch(/PLAY_PACKAGE_NAME/);
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

  it("GAMES_ENABLED: known ids only (JAMAA-PLATFORM §2.6: the runtime ignores unknown ids, a deploy fails on them)", () => {
    expect(GAME_IDS).toEqual([...SHARED_GAME_IDS]);
    expect(JSON.parse(stripJsonc(REAL)).vars.GAMES_ENABLED).toBe("mishana,bluff,likely,trivia");
    const all = REAL.replace('"GAMES_ENABLED": "mishana,bluff,likely,trivia"', '"GAMES_ENABLED": "mishana, bluff,likely,trivia"');
    expect(all).not.toBe(REAL);
    expect(checkDeployConfig(all)).toEqual([]);
    expect(checkDeployConfig(REAL.replace('"GAMES_ENABLED": "mishana,bluff,likely,trivia"', '"GAMES_ENABLED": "mishana,chess"')).join()).toMatch(/GAMES_ENABLED has unknown game id\(s\) chess/);
    const unset = REAL.replace(' "GAMES_ENABLED": "mishana,bluff,likely,trivia",', "");
    expect(unset).not.toBe(REAL);
    expect(checkDeployConfig(unset)).toEqual([]); // unset → the default
  });

  it("JSONC stripping keeps // inside strings and drops trailing commas", () => {
    expect(JSON.parse(stripJsonc('{ "a": "https://x//y", // c\n "b": [1,2,], /* z */ }'))).toEqual({ a: "https://x//y", b: [1, 2] });
  });
});
