// Trivia inside the real room (JAMAA-PLATFORM §2.3–§2.8, §2.12): setup extras, the quizId family across content
// languages, access (a free room never receives a Pass-only quiz), a full game over GAME intents with the generic room
// leak checker after every step, stars, REPLAY without carry, the history memory, and late joiners via `join`.
import { describe, expect, it } from "vitest";
import { COLORS } from "../../../src/constants";
import type { TriviaIntent, TriviaState } from "../../../src/games/trivia/engine/types";
import type { TriviaExtras, TriviaPublic } from "../../../src/games/trivia/engine/view";
import { PlayerRoomViewSchema, TvRoomViewSchema } from "../../../src/protocol/v2/views";
import { createRng } from "../../../src/room/rng";
import { TRIVIA_SYNTH_CATALOG, withTrivia } from "../../../src/testing/catalogs/trivia";
import { findRoomLeaks } from "../../../src/testing/room-leaks";
import { RoomHarness } from "../../../src/testing/room";

const FULL = withTrivia(TRIVIA_SYNTH_CATALOG);
const FREE = withTrivia({ packs: TRIVIA_SYNTH_CATALOG.packs.filter((p) => p.tier === "free") });

function room(n: number, o: { premium?: boolean; seed?: number } = {}): RoomHarness {
  const h = new RoomHarness({
    seed: o.seed ?? 9, enabledGames: ["mishana", "trivia"], content: o.premium ? FULL : FREE, fullContent: FULL,
    access: { premium: o.premium ?? false, packs: new Set() },
  });
  for (let i = 0; i < n; i++) h.join(`p${i}`, `P${i}`, COLORS[i]!.id);
  return h;
}
const trivia = (h: RoomHarness): TriviaState => h.state.game!.state as TriviaState;
const extras = (h: RoomHarness): TriviaExtras => h.tvView().room.setup!.extras as TriviaExtras;
const send = (h: RoomHarness, by: string | null, i: TriviaIntent) =>
  h.try({ type: "GAME", gameId: "trivia", i, by: by === null ? { kind: "tv" } : { kind: "player", playerId: by } });

function noLeaks(h: RoomHarness): void {
  const leaks = findRoomLeaks(h);
  if (leaks.length > 0) throw new Error(leaks.slice(0, 5).join("\n"));
  TvRoomViewSchema.parse(h.tvView());
  for (const m of h.state.members) PlayerRoomViewSchema.parse(h.playerView(m.id));
}

/** Plays the active instance to RESULTS: random answers at random times, the clock jumping to each deadline. */
function playToResults(h: RoomHarness, seed = 1): void {
  const rng = createRng(seed);
  for (let guard = 0; guard < 2_000 && trivia(h).phase !== "RESULTS"; guard++) {
    const s = trivia(h);
    if (s.phase === "ANSWER") {
      const p = s.players.find((x) => !x.left && !x.waiting && x.connected && !s.answers[x.id]);
      if (p && rng.next() < 0.9) {
        h.now = Math.min(s.deadline!.at, h.now + rng.int(3_000));
        const r = send(h, p.id, { type: "ANSWER", choice: rng.int(s.cur!.options.length) });
        expect(r.ok).toBe(true);
        noLeaks(h);
        continue;
      }
    }
    h.now = Math.max(h.now, s.deadline!.at);
    h.sys({ type: "TICK" });
    noLeaks(h);
  }
  expect(trivia(h).phase).toBe("RESULTS");
}

describe("trivia in the room", () => {
  it("SETUP: the summary card, the shelf list, available questions; a free room's shelf has no Pass-only quiz", () => {
    const h = room(3);
    h.tv({ type: "OPEN_GAME", gameId: "trivia" });
    expect(extras(h)).toMatchObject({ gameId: "trivia", available: 40, playCount: 10, quiz: { id: "syn-quiz", tier: "free" } });
    expect(extras(h).quizzes.map((q) => q.id)).toEqual(["syn-quiz"]);
    const setup = h.tvView().room.setup!;
    expect(setup.lockedPacks.map((p) => p.family)).toEqual(["syn-world"]);
    expect(h.err({ type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { quizId: "syn-world" }, by: { kind: "tv" } })).toBe("INVALID_SETTINGS");
    noLeaks(h);
    const p = room(3, { premium: true });
    p.tv({ type: "OPEN_GAME", gameId: "trivia" });
    expect(extras(p).quizzes.map((q) => q.id)).toEqual(["syn-quiz", "syn-world"]);
  });

  it("quizId is a family: kept across a content-language change when the family has that locale, reset otherwise", () => {
    const h = room(2, { premium: true });
    h.tv({ type: "OPEN_GAME", gameId: "trivia" });
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { quizId: "syn-world", length: "short" } });
    h.tv({ type: "SET_CONTENT_LOCALE", locale: "fr" });
    expect(h.state.gameSettings.trivia).toEqual({ quizId: "syn-world", length: "short", pace: "normal" });
    expect(extras(h).quiz?.id).toBe("syn-world");
    h.tv({ type: "SET_CONTENT_LOCALE", locale: "ar" });
    expect(h.state.gameSettings.trivia.quizId).toBeNull();
    expect(h.state.gameSettings.trivia.length).toBe("short");
    h.tv({ type: "START_GAME" });
    expect(trivia(h).quiz.packId).toBe("syn-quiz-ar");
  });

  it("a full game through GAME intents: no leak at any step, stars from the ranking, REPLAY starts at 0, memory kept", () => {
    const h = room(4);
    h.tv({ type: "OPEN_GAME", gameId: "trivia" });
    h.tv({ type: "START_GAME" });
    noLeaks(h);
    expect(trivia(h).deadline!.at).toBe(h.now + 2_500 + 4_000);
    // The VIP (first joiner) may skip QUIZ_INTRO; another phone may not.
    expect(send(h, "p1", { type: "HOST_ADVANCE" })).toMatchObject({ ok: false, error: "NOT_HOST" });
    expect(send(h, "p0", { type: "HOST_ADVANCE" }).ok).toBe(true);
    playToResults(h, 3);
    const s = trivia(h);
    const ranking = h.state.cup.last!.ranking;
    expect(h.state.cup.last!.gameId).toBe("trivia");
    if (ranking[0]) for (const id of ranking[0]) expect(h.state.cup.stars[id]).toBe(3);
    expect(h.history.memory.trivia!.usedKeys).toHaveLength(10);
    const played = new Set(s.questionIds);
    h.tv({ type: "REPLAY" });
    const again = trivia(h);
    expect(again.players.every((p) => p.score === 0)).toBe(true);
    for (const id of again.questionIds) expect(played.has(id)).toBe(false);
    noLeaks(h);
  });

  it("a member joining while PLAYING is dealt in by `join` (not benched), waits for the next READ, then answers", () => {
    const h = room(2);
    h.tv({ type: "OPEN_GAME", gameId: "trivia" });
    h.tv({ type: "START_GAME" });
    h.join("late", "Late", "grape");
    expect(h.state.members.find((m) => m.id === "late")!.benched).toBe(false);
    const view = h.playerView("late").game!;
    expect(view.me).toEqual({ myChoice: null, myTimeMs: null, waitingForNext: true });
    expect((view.public as TriviaPublic).waitingIds).toEqual(["late"]);
    noLeaks(h);
    while (trivia(h).phase !== "ANSWER") { h.now = trivia(h).deadline!.at; h.sys({ type: "TICK" }); }
    expect(send(h, "late", { type: "ANSWER", choice: 0 }).ok).toBe(true);
    noLeaks(h);
  });

  it("disconnects reach the game (AWAY/BACK); everyone away → HOLD; LEAVE → left; the host ends a held game", () => {
    const h = room(2);
    h.tv({ type: "OPEN_GAME", gameId: "trivia" });
    h.tv({ type: "START_GAME" });
    h.sys({ type: "DISCONNECT", playerId: "p0" });
    h.sys({ type: "DISCONNECT", playerId: "p1" });
    h.now = trivia(h).deadline!.at;
    h.sys({ type: "TICK" });
    expect(trivia(h).phase).toBe("HOLD");
    noLeaks(h);
    h.sys({ type: "RECONNECT", playerId: "p1" });
    expect(trivia(h).phase).toBe("READ");
    h.p("p1", { type: "LEAVE" });
    expect(trivia(h).players.find((p) => p.id === "p1")!.left).toBe(true);
    noLeaks(h);
    h.now = trivia(h).deadline!.at;
    h.sys({ type: "TICK" });
    h.now = trivia(h).deadline!.at;
    h.sys({ type: "TICK" });
    h.now = trivia(h).deadline!.at;
    h.sys({ type: "TICK" });
    expect(trivia(h).phase).toBe("HOLD");
    expect(send(h, null, { type: "END_GAME" }).ok).toBe(true);
    expect(trivia(h).phase).toBe("RESULTS");
    expect(h.tvView().game!.over).toBe(true);
  });

  it("random rooms (1–12 players, free and Pass): every game ends, with the room leak checker green at every step", () => {
    for (let seed = 1; seed <= 24; seed++) {
      const n = 1 + (seed % 12);
      const h = room(n, { premium: seed % 2 === 0, seed });
      h.tv({ type: "OPEN_GAME", gameId: "trivia" });
      if (seed % 3 === 0) h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { length: "short", pace: "fast" } });
      h.tv({ type: "START_GAME" });
      playToResults(h, seed);
    }
  }, 60_000);
});

describe("rollout (JAMAA-PLATFORM §2.5, §6.2)", () => {
  it("Trivia is registry-enabled (no longer a stub), but only a deploy whose GAMES_ENABLED lists it offers it", async () => {
    const { GAMES, REGISTRY_ENABLED } = await import("../../../src/games/registry");
    expect(GAMES.trivia.enabled).toBe(true);
    expect(REGISTRY_ENABLED).toContain("trivia");
    const off = new RoomHarness({ seed: 3, enabledGames: ["mishana"], content: FREE, fullContent: FULL, access: { premium: false, packs: new Set() } });
    expect(off.tvView().room.games.map((g) => g.id)).not.toContain("trivia");
    expect(off.try({ type: "OPEN_GAME", gameId: "trivia", by: { kind: "tv" } })).toMatchObject({ ok: false, error: "GAME_UNAVAILABLE" });
    expect(room(1).tvView().room.games.map((g) => g.id)).toContain("trivia");
  });
});
