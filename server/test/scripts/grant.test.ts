// PAYMENTS-SPEC §3.12: the `pnpm grant` CLI (argument parsing; the HTTP side is covered by admin.test.ts).
import { describe, expect, it } from "vitest";
import { buildRequest, normalizeId, parseExpires } from "../../scripts/grant.mjs";

const ID = "0123456789abcdef0123456789abcdef";
const HASH = "f".repeat(64);
const ENV = { ADMIN_TOKEN: "t".repeat(40), MISHANA_URL: "https://play.example.workers.dev/" };
const NOW = Date.parse("2026-10-04T00:00:00Z");
const body = (r: ReturnType<typeof buildRequest>): unknown => JSON.parse(r.init.body ?? "null");

describe("pnpm grant", () => {
  it("grant: premium by default; the token goes in the Authorization header only", () => {
    const r = buildRequest([ID], ENV, NOW);
    expect(r).toMatchObject({ kind: "grant", url: "https://play.example.workers.dev/api/admin/grants", init: { method: "POST" } });
    expect(r.init.headers.Authorization).toBe(`Bearer ${ENV.ADMIN_TOKEN}`);
    expect(body(r)).toEqual({ installId: ID, premium: true });
    expect(r.url).not.toContain(ENV.ADMIN_TOKEN);
    expect(r.init.body).not.toContain(ENV.ADMIN_TOKEN);
  });

  it("grant: --packs (packs only, or with --premium), --expires (date or ISO), --note, --url overrides MISHANA_URL", () => {
    const r = buildRequest([ID, "--packs", "en-food-01, fr-food-01", "--expires", "2027-01-01", "--note", "owner TV", "--url", "http://localhost:8787"], ENV, NOW);
    expect(r.url).toBe("http://localhost:8787/api/admin/grants");
    expect(body(r)).toEqual({ installId: ID, packs: ["en-food-01", "fr-food-01"], expiresAt: Date.parse("2027-01-01T00:00:00Z"), note: "owner TV" });
    expect(body(buildRequest([ID, "--packs", "en-food-01", "--premium"], ENV, NOW))).toEqual({ installId: ID, packs: ["en-food-01"], premium: true });
    expect(parseExpires("2027-01-01T12:30:00Z", NOW)).toBe(Date.parse("2027-01-01T12:30:00Z"));
  });

  it("the TV's grouped display form is accepted", () => {
    expect(normalizeId("0123 4567 89AB CDEF-0123 4567 89ab cdef")).toBe(ID);
    expect(body(buildRequest(["0123-4567-89ab-cdef-0123-4567-89ab-cdef"], ENV, NOW))).toMatchObject({ installId: ID });
  });

  it("list and revoke (by install id or by the hash `list` prints)", () => {
    expect(buildRequest(["list"], ENV, NOW)).toMatchObject({ kind: "list", init: { method: "GET" } });
    expect(buildRequest(["list"], ENV, NOW).init.body).toBeUndefined();
    expect(body(buildRequest(["revoke", ID], ENV, NOW))).toEqual({ installId: ID });
    expect(buildRequest(["revoke", ID], ENV, NOW).init.method).toBe("DELETE");
    expect(body(buildRequest(["revoke", HASH], ENV, NOW))).toEqual({ installHash: HASH });
  });

  it("refuses bad input", () => {
    const bad: [string[], Record<string, string | undefined>, RegExp][] = [
      [[ID], { MISHANA_URL: ENV.MISHANA_URL }, /ADMIN_TOKEN/],
      [[ID], { ADMIN_TOKEN: ENV.ADMIN_TOKEN }, /MISHANA_URL/],
      [["nothex"], ENV, /32 hex/],
      [[], ENV, /missing/],
      [[ID, "--packs"], ENV, /needs a value/],
      [[ID, "--packs", ""], ENV, /at least one/],
      [[ID, "--expires", "2020-01-01"], ENV, /past/],
      [[ID, "--expires", "soon"], ENV, /not a date/],
      [[ID, "--bogus"], ENV, /unknown option/],
      [["revoke", "abc"], ENV, /revoke/],
      [["list", "--premium"], ENV, /list/],
    ];
    for (const [argv, env, re] of bad) expect(() => buildRequest(argv, env, NOW)).toThrow(re);
  });
});
