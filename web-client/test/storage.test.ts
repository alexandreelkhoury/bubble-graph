import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearResume, KEYS, loadColor, loadLocale, loadResume, RESUME_MAX_AGE_MS, saveColor, saveLocale, saveResume } from "../src/lib/storage";

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const g = globalThis as { localStorage?: unknown };
const TOKEN = "fedcba9876543210fedcba9876543210";

describe("storage", () => {
  let mem: MemStorage;
  beforeEach(() => { mem = new MemStorage(); g.localStorage = mem; });
  afterEach(() => { delete g.localStorage; });

  it("uses the §8.6 keys", () => {
    expect(KEYS.resume("KXQP")).toBe("mishana:resume:KXQP");
    expect(KEYS.locale).toBe("mishana:locale");
    expect(KEYS.name).toBe("mishana:name");
    expect(KEYS.color).toBe("mishana:color");
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
    expect(mem.getItem("mishana:resume:KXQP")).toBeNull();
  });
  it("deletes malformed records", () => {
    mem.setItem("mishana:resume:KXQP", "{not json");
    expect(loadResume("KXQP")).toBeNull();
    expect(mem.getItem("mishana:resume:KXQP")).toBeNull();
  });
  it("validates locale and colour", () => {
    saveLocale("ar");
    expect(loadLocale()).toBe("ar");
    mem.setItem("mishana:locale", "de");
    expect(loadLocale()).toBeNull();
    saveColor("jade");
    expect(loadColor()).toBe("jade");
    mem.setItem("mishana:color", "black");
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
  });
});
