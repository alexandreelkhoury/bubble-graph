import { describe, expect, it } from "vitest";
import { createRng } from "../../src/engine/rng";

describe("rng (mulberry32)", () => {
  it("matches the §4.6 vectors for seed 42", () => {
    const r = createRng(42);
    expect(r.next()).toBe(0.6011037519201636);
    expect(r.state).toBe(1831565855);
    expect(r.next()).toBe(0.44829055899754167);
    expect(r.state).toBe(3663131668);
    expect(r.next()).toBe(0.8524657934904099);
    expect(r.state).toBe(1199730185);
  });
  it("int(n) is in 0..n-1 and state stays uint32", () => {
    const r = createRng(-1);
    expect(r.state).toBe(0xffffffff);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      expect(Number.isInteger(r.state) && r.state >= 0 && r.state <= 0xffffffff).toBe(true);
    }
  });
  it("is reproducible from a stored state", () => {
    const a = createRng(7);
    a.next();
    const b = createRng(a.state);
    expect(b.next()).toBe(a.next());
  });
});
