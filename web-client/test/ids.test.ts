import { describe, expect, it } from "vitest";
import { nextActionId, randomId } from "../src/net/ids";

describe("ids", () => {
  it("randomId is 16 random bytes as lowercase hex and matches the cid regex", () => {
    const a = randomId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(new Set(Array.from({ length: 200 }, () => randomId())).size).toBe(200);
  });
  it("action ids are valid and distinct", () => {
    const a = nextActionId();
    const b = nextActionId();
    expect(a).toMatch(/^[A-Za-z0-9-]{1,36}$/);
    expect(a).not.toBe(b);
  });
});
