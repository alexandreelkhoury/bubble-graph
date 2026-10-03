import { describe, expect, it } from "vitest";
import { cleanCodeInput, parseRoute } from "../src/router";

describe("router", () => {
  it("canonicalises room codes to upper case", () => {
    expect(parseRoute("/kxqp")).toEqual({ kind: "room", code: "KXQP", canonical: false });
    expect(parseRoute("/KXQP")).toEqual({ kind: "room", code: "KXQP", canonical: true });
    expect(parseRoute("/KxQp/")).toEqual({ kind: "room", code: "KXQP", canonical: false });
  });
  it("routes home, tv and invalid codes", () => {
    expect(parseRoute("/")).toEqual({ kind: "home", prefill: "" });
    expect(parseRoute("/tv")).toEqual({ kind: "tv" });
    expect(parseRoute("/TV-MOCK")).toEqual({ kind: "tv" });
    expect(parseRoute("/abci").kind).toBe("home"); // I is not in the alphabet
    expect(parseRoute("/abcde").kind).toBe("home");
    expect(parseRoute("/a/b").kind).toBe("home");
  });
  it("cleans typed codes", () => {
    expect(cleanCodeInput("kx q")).toEqual({ code: "KXQ", rejected: false });
    expect(cleanCodeInput("ki1")).toEqual({ code: "K", rejected: true });
    expect(cleanCodeInput("abcdef").code).toBe("ABCD");
    expect(cleanCodeInput("LO").rejected).toBe(true);
  });
});
