// JAMAA-PLATFORM §7.3: the client error reporter — throttle (MAX_REPORTS per page load), dedupe, noise filter, context.
import { afterEach, describe, expect, it } from "vitest";
import { errorReport, installReporter, MAX_REPORTS, reportError, resetReporter, setReportContext } from "../src/lib/report";

afterEach(() => resetReporter());

describe("client error reporter", () => {
  it("sends each distinct error once and at most MAX_REPORTS per page load", () => {
    const sent: string[] = [];
    const send = (b: string): void => void sent.push(b);
    for (let i = 0; i < 3; i++) reportError(new TypeError("same"), send);
    expect(sent).toHaveLength(1);
    for (let i = 0; i < 20; i++) reportError(new Error(`e${i}`), send);
    expect(sent).toHaveLength(MAX_REPORTS);
  });

  it('drops errors without information (the server drops "Script error.")', () => {
    expect(errorReport(undefined)).toBeNull();
    expect(errorReport("")).toBeNull();
  });

  it("a compact body: platform, name, truncated message and stack, plus the screen and room context", () => {
    const w = { addEventListener: () => undefined } as unknown as Window;
    installReporter(w);
    expect(errorReport(new Error("plain"))).toMatchObject({ p: "phone" });
    setReportContext(() => ({ p: "tv-pixi", s: "tv:PLAYING:likely", r: "KXRT" }));
    const e = new RangeError("x".repeat(500));
    const r = errorReport(e)!;
    expect(r).toMatchObject({ p: "tv-pixi", n: "RangeError", s: "tv:PLAYING:likely", r: "KXRT" });
    expect((r.m as string).length).toBe(300);
    expect((r.st as string).length).toBeLessThanOrEqual(1500);
    expect(JSON.stringify(r).length).toBeLessThan(8 * 1024); // the server's cap
  });

  it("listens to error and unhandledrejection", () => {
    const types: string[] = [];
    installReporter({ addEventListener: (t: string) => void types.push(t) } as unknown as Window);
    expect(types).toEqual(["error", "unhandledrejection"]);
  });
});
