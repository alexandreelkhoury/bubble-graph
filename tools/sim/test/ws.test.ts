import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StateV2Schema } from "@jamaa/shared/protocol/v2";
import type { RoomView, TvRoomView } from "@jamaa/shared/protocol/v2";
import type { MishanaMe, MishanaPublic } from "@jamaa/shared/games/mishana/protocol";
import { blankOpensProblem, playRoom, playerViewProblems, tvViewProblems } from "../src/ws-mode";
import type { DealtSecret } from "../src/ws-mode";

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

const playerFixture = (name: string): RoomView => StateV2Schema.parse(JSON.parse(readFileSync(new URL(`../../../shared/fixtures/v2/${name}`, import.meta.url), "utf8"))).view;

describe("ws mode phone §5.4 checker and Blank-first rule", () => {
  const v = playerFixture("s2c.state.player.playing.mishana.clues.json");
  const me = v.game!.me as MishanaMe;
  const pub = v.game!.public as MishanaPublic;
  const others = pub.players.map((p) => p.id).filter((id) => id !== me.id);
  const dealt = new Map<string, DealtSecret>([
    [me.id, { word: me.word, role: me.role, isBlank: me.isBlank }],
    [others[0]!, { word: { text: "Zebra", translit: null }, role: null, isBlank: false }],
    [others[1]!, { word: null, role: null, isBlank: true }],
  ]);
  it("accepts the viewer's own fixture frame", () => {
    expect(playerViewProblems(v, me.id, dealt)).toEqual([]);
  });
  it("flags another player's word, someone else's me and an alive revealed role", () => {
    const leaky = structuredClone(v) as RoomView & { extra?: unknown };
    leaky.extra = { hint: "Zebra" };
    const lp = leaky.game!.public as MishanaPublic;
    lp.players[0] = { ...lp.players[0]!, alive: true, revealedRole: "CIVILIAN" };
    const problems = playerViewProblems(leaky, others[2] ?? "p_nobody", dealt);
    for (const want of ["another player's word", "not the viewer", "revealed role"]) expect(problems.some((p) => p.includes(want)), want).toBe(true);
  });
  it("flags a Blank opening a speaking pass, unless no non-Blank is alive", () => {
    const blank = others[1]!;
    const order = [blank, ...pub.speakingOrder.filter((id) => id !== blank)];
    expect(blankOpensProblem({ ...pub, speakingOrder: order }, dealt)).toMatch(/the Blank/);
    expect(blankOpensProblem({ ...pub, speakingOrder: order.slice(1) }, dealt)).toBeNull();
    const onlyBlank = { ...pub, speakingOrder: order, players: pub.players.map((p) => ({ ...p, alive: p.id === blank })) };
    expect(blankOpensProblem(onlyBlank, dealt)).toBeNull();
    // TIE_BREAK: only the tie candidates can open.
    const tie = { ...pub, phase: "TIE_BREAK" as const, speakingOrder: [blank, others[0]!], tieCandidates: [blank, others[0]!] };
    expect(blankOpensProblem(tie, dealt)).toMatch(/TIE_BREAK/);
    const twoBlanks = new Map(dealt).set(others[0]!, { word: null, role: null, isBlank: true });
    expect(blankOpensProblem(tie, twoBlanks)).toBeNull();
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
    expect(stats.openingsChecked).toBeGreaterThanOrEqual(3);
  });
});
