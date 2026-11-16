// PAYMENTS-SPEC §3.2 / §3.10 / §7.2: the deploy guard.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_IDS as SHARED_GAME_IDS } from "@jamaa/shared/games/ids";
import {
  billingOn, checkDeployConfig, deployWarnings, draftContentProblems, GAME_IDS, missingBillingSecrets, resolveTarget, stripJsonc, targetFromArgs, TARGETS,
} from "../../scripts/check-deploy.mjs";

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
  it("rejects any `env` other than production (a stray environment could re-enable fake billing or traces)", () => {
    const withEnv = mut((c) => {
      (c.env as Record<string, unknown>).staging = { vars: { BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "1" } };
    });
    expect(checkDeployConfig(withEnv).join()).toMatch(/env\.staging is not allowed/);
    expect(checkDeployConfig(withEnv, "production").join()).toMatch(/env\.staging is not allowed/);
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
    expect(JSON.parse(stripJsonc(REAL)).vars.GAMES_ENABLED).toBe("mishana,bluff,likely,trivia,taqriban");
    const all = REAL.replace('"GAMES_ENABLED": "mishana,bluff,likely,trivia,taqriban"', '"GAMES_ENABLED": "mishana, bluff,likely,trivia,taqriban"');
    expect(all).not.toBe(REAL);
    expect(checkDeployConfig(all)).toEqual([]);
    expect(checkDeployConfig(REAL.replace('"GAMES_ENABLED": "mishana,bluff,likely,trivia,taqriban"', '"GAMES_ENABLED": "mishana,chess"')).join()).toMatch(/GAMES_ENABLED has unknown game id\(s\) chess/);
    const unset = REAL.replace(' "GAMES_ENABLED": "mishana,bluff,likely,trivia,taqriban",', "");
    expect(unset).not.toBe(REAL);
    expect(checkDeployConfig(unset)).toEqual([]); // unset → the default
  });

  it("JSONC stripping keeps // inside strings and drops trailing commas", () => {
    expect(JSON.parse(stripJsonc('{ "a": "https://x//y", // c\n "b": [1,2,], /* z */ }'))).toEqual({ a: "https://x//y", b: [1, 2] });
  });
});

describe("check-deploy: preview vs production (docs/DEV.md \"Production\")", () => {
  const cfg = JSON.parse(stripJsonc(REAL)) as Cfg;
  const prodRaw = () => (JSON.parse(stripJsonc(REAL)) as Cfg).env.production;

  it("the target must be named: --env preview|production; anything else is refused", () => {
    expect(targetFromArgs(["--env", "production"])).toBe("production");
    expect(targetFromArgs(["--env=preview"])).toBe("preview");
    expect(targetFromArgs([])).toBeNull();
    expect(TARGETS).toEqual(["preview", "production"]);
    expect(checkDeployConfig(REAL, "staging").join()).toMatch(/unknown deploy target/);
  });

  it("accepts the shipped production config (Worker jamaa, all five games, billing off)", () => {
    expect(checkDeployConfig(REAL, "production")).toEqual([]);
    const p = resolveTarget(cfg, "production");
    expect(p.name).toBe("jamaa");
    expect(p.vars?.GAMES_ENABLED).toBe(GAME_IDS.join(","));
    expect(p.vars?.BILLING_ENABLED).toBe("0");
    expect(billingOn(REAL, "production")).toBe(false);
  });

  it("preview stays the top level: Worker play, preview dataset and rate-limit ids", () => {
    const v = resolveTarget(cfg, "preview");
    expect(v.name).toBe("play");
    expect(v.env).toBeUndefined();
    expect(v.analytics_engine_datasets).toEqual([{ binding: "EVENTS", dataset: "jamaa_events" }]);
    expect((v.ratelimits as { namespace_id: string }[]).map((r) => r.namespace_id)).toEqual(["1001", "1002", "1003", "1004", "1005"]);
  });

  it("production has its own data: DO bindings like preview, own dataset, rate-limit ids disjoint from preview", () => {
    const p = resolveTarget(cfg, "production");
    expect(p.durable_objects).toEqual(cfg.durable_objects);
    expect(p.analytics_engine_datasets).toEqual([{ binding: "EVENTS", dataset: "jamaa_events_prod" }]);
    expect(p.vars?.AE_DATASET).toBe("jamaa_events_prod");
    const prodIds = (p.ratelimits as { namespace_id: string }[]).map((r) => r.namespace_id);
    const prevIds = (cfg.ratelimits as { namespace_id: string }[]).map((r) => r.namespace_id);
    expect(prodIds.filter((x) => prevIds.includes(x))).toEqual([]);
    // Inherited: migrations, assets, crons (wrangler copies them into the environment).
    expect(p.migrations).toEqual(cfg.migrations);
    expect(p.assets).toEqual(cfg.assets);
    expect(p.triggers).toEqual(cfg.triggers);
  });

  it("refuses production configs that share preview's data or lose a non-inherited binding", () => {
    const shared = mut((c) => { (c.env.production.ratelimits as { namespace_id: string }[])[0]!.namespace_id = "1001"; });
    expect(checkDeployConfig(shared, "production").join()).toMatch(/namespace_id 1001 also used by preview/);
    const sameDs = mut((c) => {
      c.env.production.analytics_engine_datasets = [{ binding: "EVENTS", dataset: "jamaa_events" }];
      (c.env.production.vars as Record<string, string>).AE_DATASET = "jamaa_events";
    });
    expect(checkDeployConfig(sameDs, "production").join()).toMatch(/must not be preview's dataset/);
    const noDo = mut((c) => { delete c.env.production.durable_objects; });
    expect(checkDeployConfig(noDo, "production").join()).toMatch(/durable_objects is missing/);
    const noVars = mut((c) => { delete c.env.production.vars; });
    expect(checkDeployConfig(noVars, "production").join()).toMatch(/BILLING_MODE/);
    const sameName = mut((c) => { c.env.production.name = "play"; });
    expect(checkDeployConfig(sameName, "production").join()).toMatch(/name must be "jamaa"/);
    const noEnv = mut((c) => { delete (c as Partial<Cfg>).env; });
    expect(checkDeployConfig(noEnv, "production")).toEqual(["env.production is missing"]);
    expect(checkDeployConfig(noEnv, "preview")).toEqual([]);
  });

  it("production rules: no fake billing, no debug, traces off, known games, no placeholders, https URLs", () => {
    const pv = (k: string, v: string) => mut((c) => { (c.env.production.vars as Record<string, string>)[k] = v; });
    expect(checkDeployConfig(pv("ALLOW_FAKE_BILLING", "1"), "production").join()).toMatch(/env.production.vars.ALLOW_FAKE_BILLING/);
    expect(checkDeployConfig(pv("BILLING_MODE", "fake"), "production").join()).toMatch(/BILLING_MODE/);
    expect(checkDeployConfig(pv("DEBUG_INVARIANTS", "1"), "production").join()).toMatch(/DEBUG_INVARIANTS/);
    expect(checkDeployConfig(pv("GAMES_ENABLED", "mishana,chess"), "production").join()).toMatch(/unknown game id\(s\) chess/);
    expect(checkDeployConfig(pv("JOIN_BASE_URL", "https://jamaa.example.app"), "production").join()).toMatch(/placeholder/);
    expect(checkDeployConfig(pv("JOIN_BASE_URL", "http://jamaa.app"), "production").join()).toMatch(/https/);
    expect(checkDeployConfig(pv("JOIN_BASE_URL", "https://jamaa.app/"), "production").join()).toMatch(/trailing slash/);
    expect(checkDeployConfig(pv("JOIN_BASE_URL", "https://jamaa.app"), "production")).toEqual([]);
    expect(checkDeployConfig(pv("ADMIN_TOKEN", "x"), "production").join()).toMatch(/ADMIN_TOKEN/);
    expect(checkDeployConfig(pv("AE_DATASET", "jamaa_events"), "production").join()).toMatch(/AE_DATASET/);
    const traces = mut((c) => { c.env.production.observability = { enabled: true, traces: { enabled: true } }; });
    expect(checkDeployConfig(traces, "production").join()).toMatch(/traces/);
    // Inherited observability still counts: removing the production copy keeps the top level's traces-off.
    expect(checkDeployConfig(mut((c) => { delete c.env.production.observability; }), "production")).toEqual([]);
    const route = mut((c) => { c.env.production.routes = [{ pattern: "<your-domain>", custom_domain: true }]; });
    expect(checkDeployConfig(route, "production").join()).toMatch(/routes has a placeholder/);
    // The preview target ignores the production block's mistakes (and vice versa for the top-level debug var).
    expect(checkDeployConfig(pv("DEBUG_INVARIANTS", "1"), "preview")).toEqual([]);
  });

  it("billing switches and warnings are per target", () => {
    const on = mut((c) => { (c.env.production.vars as Record<string, string>).BILLING_ENABLED = "1"; });
    expect(billingOn(on, "production")).toBe(true);
    expect(billingOn(on, "preview")).toBe(false);
    expect(deployWarnings(on, "production")).toEqual([expect.stringMatching(/RTDN_AUDIENCE/)]);
    expect(deployWarnings(on, "preview")).toEqual([]);
    expect(prodRaw()).toBeDefined();
  });

  it("production content gate: no draft pack or item in content-dist, and content-dist not empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "jamaa-dist-"));
    try {
      expect(draftContentProblems(join(dir, "nope")).join()).toMatch(/missing/);
      expect(draftContentProblems(dir).join()).toMatch(/no packs/);
      mkdirSync(join(dir, "trivia"));
      writeFileSync(join(dir, "trivia", "ok.txt"), JSON.stringify({ id: "ok", status: "reviewed", items: [{ review: { status: "reviewed" } }] }));
      expect(draftContentProblems(dir)).toEqual([]);
      writeFileSync(join(dir, "trivia", "pack.txt"), JSON.stringify({ id: "pack", status: "draft" }));
      writeFileSync(join(dir, "trivia", "items.txt"), JSON.stringify({ id: "items", items: [{ review: { status: "draft" } }, { review: { status: "draft" } }] }));
      expect(draftContentProblems(dir)).toEqual([
        "content-dist/trivia/items.txt: 2 draft marker(s) (production ships reviewed content only)",
        "content-dist/trivia/pack.txt: 1 draft marker(s) (production ships reviewed content only)",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("package scripts: deploy = production behind the release gate, deploy:preview = the top-level Worker", () => {
    const root = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
    const server = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
    expect(root.scripts.deploy).toMatch(/--release/);
    expect(root.scripts.deploy).toMatch(/run deploy:production$/);
    expect(root.scripts["deploy:preview"]).not.toMatch(/--release|production/);
    expect(server.scripts["deploy:production"]).toMatch(/check-deploy\.mjs --env production .*wrangler deploy --env production$/);
    expect(server.scripts["deploy:preview"]).toMatch(/check-deploy\.mjs --env preview .*wrangler deploy$/);
    // No unguarded server `deploy` script: `pnpm --filter @jamaa/server run deploy` must not pick a target silently.
    expect(server.scripts.deploy ?? "").not.toMatch(/wrangler deploy/);
  });
});

type Cfg = Record<string, unknown> & { env: { production: Record<string, unknown> } };
/** REAL as an object, changed by `f`, back to text (comments dropped). */
function mut(f: (c: Cfg) => void): string {
  const c = JSON.parse(stripJsonc(REAL)) as Cfg;
  f(c);
  return JSON.stringify(c);
}
