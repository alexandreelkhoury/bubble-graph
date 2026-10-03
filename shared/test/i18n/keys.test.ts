import { describe, expect, it } from "vitest";
import { COLORS } from "../../src/constants";
import { errorKey, MESSAGES } from "../../src/i18n/index";
import { ERROR_CODES } from "../../src/protocol/errors";

type Value = string | Record<string, string>;
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
const placeholders = (s: string): Set<string> => new Set([...s.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)].map((m) => m[1] as string));
const union = (v: Value): Set<string> => (typeof v === "string" ? placeholders(v) : new Set(Object.values(v).flatMap((x) => [...placeholders(x)])));
const sorted = (s: Set<string>): string[] => [...s].sort();

const en = MESSAGES.en as Record<string, Value>;
const others = { fr: MESSAGES.fr as Record<string, Value>, ar: MESSAGES.ar as Record<string, Value> };

describe("i18n keys (§11)", () => {
  it("keys match the key regex", () => {
    for (const k of Object.keys(en)) expect(KEY_RE.test(k), k).toBe(true);
  });
  it.each(Object.entries(others))("%s has exactly the en key set", (_l, m) => {
    expect(Object.keys(m).sort()).toEqual(Object.keys(en).sort());
  });
  it.each(Object.entries(others))("%s placeholder names equal en per key (plural: union rule)", (_l, m) => {
    for (const [k, v] of Object.entries(en)) {
      const o = m[k];
      if (o === undefined) continue;
      expect(sorted(union(o)), k).toEqual(sorted(union(v)));
      if (typeof v === "string") expect(typeof o, k).toBe("string");
    }
  });
  it("plural objects have `other`; no literal percent", () => {
    for (const m of [en, others.fr, others.ar]) {
      for (const [k, v] of Object.entries(m)) {
        if (typeof v !== "string") expect(v.other, k).toBeTypeOf("string");
        const strings = typeof v === "string" ? [v] : Object.values(v);
        for (const s of strings) expect(s.includes("%"), k).toBe(false);
      }
    }
  });
  it("every ErrorCode has an error.* key", () => {
    for (const c of ERROR_CODES) expect(en[errorKey(c)], c).toBeDefined();
  });
  it("color.* keys match COLORS", () => {
    const colorKeys = Object.keys(en).filter((k) => k.startsWith("color.")).map((k) => k.slice(6)).sort();
    expect(colorKeys).toEqual(COLORS.map((c) => c.id).sort());
  });
});
