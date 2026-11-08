import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StateV2Schema } from "@jamaa/shared/protocol/v2";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import type { MishanaPublic } from "@jamaa/shared/games/mishana/protocol";
import { playRoom, tvViewProblems } from "../src/ws-mode";

const fixture = (name: string): TvRoomView => {
  const msg = StateV2Schema.parse(JSON.parse(readFileSync(new URL(`../../../shared/fixtures/v2/${name}`, import.meta.url), "utf8")));
  if (msg.view.kind !== "tv") throw new Error("not a tv fixture");
  return msg.view;
};

describe("ws mode §5.4 checker (protocol v2)", () => {
  it("accepts the v2 TV fixtures", () => {
    for (const f of ["s2c.state.tv.hub.json", "s2c.state.tv.playing.mishana.clues.json", "s2c.state.tv.playing.mishana.elimination.json", "s2c.state.tv.playing.mishana.results.json", "s2c.state.tv.playing.mishana.role_reveal.json"]) {
      expect(tvViewProblems(fixture(f), new Set(["Cat", "Dog"])), f).toEqual([]);
    }
  });
  it("flags secret words, a game me, state-only keys, alive revealed roles and guess text before RESULTS", () => {
    const leaky = structuredClone(fixture("s2c.state.tv.playing.mishana.clues.json")) as TvRoomView & { extra?: unknown };
    leaky.extra = { text: "Cat", rngState: 1 };
    const g = leaky.game!;
    const pub = g.public as MishanaPublic;
    const p0 = pub.players[0]!;
    pub.players[0] = { ...p0, alive: true, revealedRole: "UNDERCOVER" };
    pub.guess = { playerId: p0.id, status: "WRONG", text: "zz", overridden: false };
    (g as { me: unknown }).me = { id: p0.id };
    const problems = tvViewProblems(leaky, new Set(["Cat"]));
    for (const want of ["secret word", "forbidden key", "revealed role", "guess.text", "game me"]) expect(problems.some((p) => p.includes(want)), want).toBe(true);
  });
});

// Integration (needs a running server): JAMAA_WS_URL=http://127.0.0.1:8787 pnpm test
const WS_URL = process.env.JAMAA_WS_URL;
describe.skipIf(!WS_URL)("ws mode against a live server", () => {
  it("plays full games over protocol v2 through the hub, with a mid-game resume and a benched late joiner", { timeout: 180_000 }, async () => {
    const stats = await playRoom(WS_URL as string, 5, 3, { seed: 3, winRule: "official", tieBreak: "random", verbose: false }, () => {});
    expect(stats.failures).toEqual([]);
    expect(stats.games).toBe(3);
    expect(stats.resumes).toBe(1);
    expect(stats.lateJoins).toBe(1);
  });
});
