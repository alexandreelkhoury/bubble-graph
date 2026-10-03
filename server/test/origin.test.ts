import { describe, expect, it } from "vitest";
import { isOriginAllowed, originCheck, parseAllowedOrigins } from "../src/origin";

const req = (origin?: string): Request =>
  new Request("https://mish-ana.example.workers.dev/parties/room/ABCD", origin ? { headers: { Origin: origin } } : {});

describe("origin check (§7.4)", () => {
  it("allows a request without Origin (TV app, sim)", () => {
    expect(isOriginAllowed(req(), "")).toBe(true);
    expect(originCheck(req(), "")).toBeUndefined();
  });
  it("allows the same origin", () => {
    expect(originCheck(req("https://mish-ana.example.workers.dev"), "")).toBeUndefined();
  });
  it("allows allowlisted origins (comma list, trimmed)", () => {
    const list = " http://192.168.1.20:5173 , http://localhost:5173,";
    expect(parseAllowedOrigins(list)).toEqual(["http://192.168.1.20:5173", "http://localhost:5173"]);
    expect(originCheck(req("http://localhost:5173"), list)).toBeUndefined();
    expect(originCheck(req("http://192.168.1.20:5173"), list)).toBeUndefined();
  });
  it("rejects a foreign origin with 403", () => {
    const r = originCheck(req("https://evil.example"), "http://localhost:5173");
    expect(r?.status).toBe(403);
    expect(originCheck(req("http://localhost:5174"), "http://localhost:5173")?.status).toBe(403);
    expect(originCheck(req("null"), "")?.status).toBe(403);
  });
});
