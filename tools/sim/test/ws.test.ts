import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StateSchema } from "@mishana/shared/protocol";
import type { TvView } from "@mishana/shared/protocol";
import { playRoom, tvViewProblems } from "../src/ws-mode";

const fixture = (name: string): TvView => {
  const msg = StateSchema.parse(JSON.parse(readFileSync(new URL(`../../../shared/fixtures/${name}`, import.meta.url), "utf8")));
  if (msg.view.kind !== "tv") throw new Error("not a tv fixture");
  return msg.view;
};

describe("ws mode §5.4 checker", () => {
  it("accepts the TV fixtures", () => {
    for (const f of ["s2c.state.tv.lobby.json", "s2c.state.tv.clues.json", "s2c.state.tv.voting.json", "s2c.state.tv.mr_white_guess.json", "s2c.state.tv.results.json"]) {
      expect(tvViewProblems(fixture(f), new Set(["Cat", "Dog"]))).toEqual([]);
    }
  });
  it("flags secret words, alive revealed roles and guess text before RESULTS", () => {
    const v = fixture("s2c.state.tv.clues.json");
    const leaky = structuredClone(v) as TvView & { extra?: unknown };
    leaky.extra = { text: "Cat" };
    const p0 = leaky.players[0]!;
    leaky.players[0] = { ...p0, alive: true, revealedRole: "UNDERCOVER" };
    leaky.guess = { playerId: p0.id, status: "WRONG", text: "zz", overridden: false };
    const problems = tvViewProblems(leaky, new Set(["Cat"]));
    expect(problems.some((p) => p.includes("secret word"))).toBe(true);
    expect(problems.some((p) => p.includes("revealed role"))).toBe(true);
    expect(problems.some((p) => p.includes("guess.text"))).toBe(true);
  });
});

// Integration (needs a running server): MISHANA_WS_URL=http://127.0.0.1:8787 pnpm test
const WS_URL = process.env.MISHANA_WS_URL;
describe.skipIf(!WS_URL)("ws mode against a live server", () => {
  it("plays full games over the protocol with a mid-game resume", { timeout: 120_000 }, async () => {
    const stats = await playRoom(WS_URL as string, 5, 2, { seed: 3, winRule: "official", tieBreak: "random", verbose: false }, () => {});
    expect(stats.failures).toEqual([]);
    expect(stats.games).toBe(2);
    expect(stats.resumes).toBe(1);
  });
});
