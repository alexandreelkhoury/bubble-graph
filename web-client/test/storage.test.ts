import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearResume, KEYS, loadColor, loadLocale, loadName, loadResume, migrateLegacyKeys, RESUME_MAX_AGE_MS, saveColor, saveLocale, saveResume } from "../src/lib/storage";

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const g = globalThis as { localStorage?: unknown };
const TOKEN = "fedcba9876543210fedcba9876543210";

describe("storage", () => {
  let mem: MemStorage;
  beforeEach(() => { mem = new MemStorage(); g.localStorage = mem; });
  afterEach(() => { delete g.localStorage; });

  it("uses the §8.6 keys", () => {
    expect(KEYS.resume("KXQP")).toBe("jamaa:resume:KXQP");
    expect(KEYS.locale).toBe("jamaa:locale");
    expect(KEYS.name).toBe("jamaa:name");
    expect(KEYS.color).toBe("jamaa:color");
  });
  it("round-trips a resume record", () => {
    saveResume("KXQP", "p_0a1b2c3d4e5f60718293a4b5", TOKEN, 1000);
    expect(loadResume("KXQP", 2000)).toEqual({ playerId: "p_0a1b2c3d4e5f60718293a4b5", resumeToken: TOKEN, savedAt: 1000 });
    clearResume("KXQP");
    expect(loadResume("KXQP")).toBeNull();
  });
  it("ignores and deletes records older than 6 h", () => {
    saveResume("KXQP", "p_x", TOKEN, 0);
    expect(loadResume("KXQP", RESUME_MAX_AGE_MS)).not.toBeNull();
    expect(loadResume("KXQP", RESUME_MAX_AGE_MS + 1)).toBeNull();
    expect(mem.getItem("jamaa:resume:KXQP")).toBeNull();
  });
  it("deletes malformed records", () => {
    mem.setItem("jamaa:resume:KXQP", "{not json");
    expect(loadResume("KXQP")).toBeNull();
    expect(mem.getItem("jamaa:resume:KXQP")).toBeNull();
  });
  it("validates locale and colour", () => {
    saveLocale("ar");
    expect(loadLocale()).toBe("ar");
    mem.setItem("jamaa:locale", "de");
    expect(loadLocale()).toBeNull();
    saveColor("jade");
    expect(loadColor()).toBe("jade");
    mem.setItem("jamaa:color", "black");
    expect(loadColor()).toBeNull();
  });
  it("never throws when storage throws", () => {
    g.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("x"); } };
    expect(() => saveResume("KXQP", "p", TOKEN)).not.toThrow();
    expect(loadResume("KXQP")).toBeNull();
    expect(loadLocale()).toBeNull();
    expect(() => clearResume("KXQP")).not.toThrow();
  });
  it("works with no storage at all", () => {
    delete g.localStorage;
    expect(loadResume("KXQP")).toBeNull();
    expect(() => migrateLegacyKeys()).not.toThrow();
  });
});

// JAMAA-PLATFORM §1.5: the one-time migration from the pre-JAMAA prefix.
describe("migrateLegacyKeys", () => {
  const OLD = "mishana";
  let mem: MemStorage;
  beforeEach(() => { mem = new MemStorage(); g.localStorage = mem; });
  afterEach(() => { delete g.localStorage; });

  it("copies the preferences once, drops resume and billing keys, and is idempotent", () => {
    mem.setItem(`${OLD}:locale`, "fr");
    mem.setItem(`${OLD}:name`, "Rami");
    mem.setItem(`${OLD}:color`, "jade");
    mem.setItem(`${OLD}:tvSound`, "off");
    mem.setItem(`${OLD}:resume:KXQP`, JSON.stringify({ playerId: "p_x", resumeToken: TOKEN, savedAt: Date.now() }));
    for (const k of ["installId", "entToken", "entBody", "fakePurchases", "entVerified", "trialUsed"]) mem.setItem(`${OLD}:${k}`, "x");
    mem.setItem("other:key", "kept");

    migrateLegacyKeys();
    const after = new Map(mem.m);
    expect(Object.fromEntries(after)).toEqual({
      "other:key": "kept", "jamaa:locale": "fr", "jamaa:name": "Rami", "jamaa:color": "jade", "jamaa:tvSound": "off",
    });
    expect(loadLocale()).toBe("fr");
    expect(loadName()).toBe("Rami");
    expect(loadColor()).toBe("jade");
    expect(loadResume("KXQP")).toBeNull();

    migrateLegacyKeys();
    expect(mem.m).toEqual(after);
  });
  it("keeps a new key over an old one, and still removes the old one", () => {
    mem.setItem("jamaa:locale", "ar");
    mem.setItem(`${OLD}:locale`, "en");
    migrateLegacyKeys();
    expect(mem.getItem("jamaa:locale")).toBe("ar");
    expect(mem.getItem(`${OLD}:locale`)).toBeNull();
  });
  it("does nothing when there are no old keys", () => {
    mem.setItem("jamaa:name", "Lea");
    migrateLegacyKeys();
    expect(Object.fromEntries(mem.m)).toEqual({ "jamaa:name": "Lea" });
  });
  it("never throws when storage is blocked, and keeps the old keys when a copy fails", () => {
    g.localStorage = { get length(): number { throw new Error("blocked"); }, key() { throw new Error("blocked"); }, getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
    expect(() => migrateLegacyKeys()).not.toThrow();
    const quota = new (class extends MemStorage { override setItem(): void { throw new Error("quota"); } })();
    quota.m.set(`${OLD}:name`, "Rami");
    g.localStorage = quota;
    expect(() => migrateLegacyKeys()).not.toThrow();
    expect(quota.getItem(`${OLD}:name`)).toBe("Rami");
  });
});
