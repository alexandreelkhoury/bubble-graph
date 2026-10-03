import { describe, expect, it } from "vitest";
import { bytesToHex, randomBytes, randomHex, sha256hex, timingSafeEqualHex } from "../src/tokens";

describe("tokens", () => {
  it("randomHex has 2 lowercase hex chars per byte", () => {
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex(12)).toMatch(/^[0-9a-f]{24}$/);
    expect(randomBytes(4)).toHaveLength(4);
    expect(randomHex(16)).not.toBe(randomHex(16));
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });
  it("sha256hex known vector", async () => {
    expect(await sha256hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("timingSafeEqualHex", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abc")).toBe(false);
    expect(timingSafeEqualHex("", "")).toBe(true);
    expect(timingSafeEqualHex("0".repeat(64), "0".repeat(63) + "1")).toBe(false);
  });
});
