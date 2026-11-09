// G4 lane B unit tests (JAMAA-PLATFORM §6.7, GAME-TRIVIA §8 / §12, DESIGN-JAMAA §5.4): the Trivia view model the phone
// and /tv screens read, the TV studio geometry (never-mirrored tiles, bulb ring, crowd stacks for 12, coin paths), the
// reveal timeline on the shared sampler, the sound cue rules, and the character secrecy rule (a function of the public
// view only), checked against lane A's v2 fixtures.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlayerRoomView, TvRoomView } from "@jamaa/shared/protocol/v2";
import { endMs, sample } from "@jamaa/shared/motion";
import {
  activePlayers, biggestClimb, excerpt, expressionFor, flameLevel, gapAhead, leftMs, letterOf, playersOf, podiumOf, questionNumber,
  resultsStats, secs, sharedPlace, standings, tokensOf, triviaOfPhone, triviaOfTv, verdictOf,
} from "../../../src/games/trivia/model";
import type { Player, Trivia } from "../../../src/games/trivia/model";
import {
  BOARD_STEPS, CANVAS, CARD_H, CARD_Y, CROWD_CHAR, PODIUM_STEPS, REVEAL_END_MS, REVEAL_STEPS, bulbs, bulbsLit, cardRect, coinPoint, crowdSlot,
  hopPoint, mainRect, podiumSlots, tileRect, towerBox, towerRect, towerRowRect, towerScorePoint,
} from "../../../src/games/trivia/layout";
import { LOCK_GAP_MS, answerTickCue, introMarks, revealMarks, viewCues } from "../../../src/games/trivia/cues";

const DIR = join(__dirname, "../../../../shared/fixtures/v2/games/trivia");
const fixture = <T>(name: string): T => (JSON.parse(readFileSync(join(DIR, name), "utf8")) as { view: T }).view;
const tvFix = (n: string): TvRoomView => fixture<TvRoomView>(`s2c.state.tv.playing.trivia.${n}.json`);
const phFix = (n: string): PlayerRoomView => fixture<PlayerRoomView>(`s2c.state.player.playing.trivia.${n}.json`);
const tvOf = (n: string): { tr: Trivia; ps: Player[] } => {
  const v = tvFix(n);
  const tr = triviaOfTv(v)!;
  return { tr, ps: playersOf(v.room, tr.pub) };
};

describe("view model (§8, §13.2)", () => {
  it("reads only trivia envelopes", () => {
    const v = tvFix("answer");
    expect(triviaOfTv(v)?.pub.phase).toBe("ANSWER");
    expect(triviaOfTv({ ...v, game: null })).toBeNull();
    expect(triviaOfPhone(phFix("answer.pad"))?.me?.myChoice).toBeNull();
  });
  it("joins members and scores in seat order; a dropped member keeps a neutral identity", () => {
    const v = tvFix("leaderboard");
    const tr = triviaOfTv(v)!;
    const ps = playersOf(v.room, tr.pub);
    expect(ps.map((p) => p.seat)).toEqual([...ps.map((p) => p.seat)].sort((a, b) => a - b));
    const lost = playersOf({ ...v.room, members: v.room.members.slice(1) }, tr.pub);
    expect(lost.length).toBe(ps.length);
    expect(lost.find((p) => p.id === v.room.members[0]!.id)?.connected).toBe(false);
  });
  it("orders the tower by rank (shared places by seat), left players last; `before` uses the previous ranks", () => {
    const { ps } = tvOf("reveal");
    const after = standings(ps).map((p) => p.row.rank);
    expect(after).toEqual([...after].sort((a, b) => (a ?? 99) - (b ?? 99)));
    const before = standings(ps, true);
    expect(before.every((p) => p.row.rankBefore === 1)).toBe(true);
    const left = ps.map((p, i) => (i === 0 ? { ...p, row: { ...p.row, left: true, rank: null } } : p));
    expect(standings(left).at(-1)!.row.left).toBe(true);
  });
  it("question counter is 1-based", () => {
    expect(questionNumber(tvOf("read").tr.pub)).toEqual({ index: 1, total: 7 });
  });
  it("tokens: A–D for mc4, True/False for tf; Latin letters only for A–D", () => {
    expect(tokensOf("mc4")).toEqual(["a", "b", "c", "d"]);
    expect(tokensOf("tf")).toEqual(["true", "false"]);
    expect(letterOf("c")).toBe("C");
    expect(letterOf("true")).toBeNull();
  });
});

describe("phone verdict (§8.3 REVEAL, TR-PH-03)", () => {
  it("correct: points, streak bonus, rank, fastest; never before REVEAL", () => {
    const v = phFix("reveal.correct");
    const tr = triviaOfPhone(v)!;
    const out = verdictOf(tr.pub, tr.me, v.me!.id);
    expect(out).toMatchObject({ kind: "correct", points: 940, streakBonus: 0, rank: 1, fastest: true, final: false });
    const pad = phFix("answer.pad");
    const p = triviaOfPhone(pad)!;
    expect(verdictOf(p.pub, p.me, pad.me!.id)).toBeNull();
  });
  it("wrong: the right answer's position, my rank; no answer and a late joiner have their own kinds", () => {
    const v = phFix("reveal.wrong");
    const tr = triviaOfPhone(v)!;
    const out = verdictOf(tr.pub, tr.me, v.me!.id)!;
    expect(out.kind).toBe("wrong");
    if (out.kind === "wrong") expect(out.right).toBe(tr.pub.reveal!.correct);
    const none = { ...tr.pub, reveal: { ...tr.pub.reveal!, choices: tr.pub.reveal!.choices.map((c) => (c.id === v.me!.id ? { ...c, choice: null } : c)) } };
    expect(verdictOf(none, tr.me, v.me!.id)!.kind).toBe("none");
    expect(verdictOf(tr.pub, { ...tr.me!, waitingForNext: true }, v.me!.id)!.kind).toBe("waiting");
    expect(verdictOf({ ...tr.pub, reveal: { ...tr.pub.reveal!, voided: true } }, tr.me, v.me!.id)!.kind).toBe("voided");
  });
  it("final reveal flags the ×2", () => {
    const v = phFix("reveal.final");
    const tr = triviaOfPhone(v)!;
    const out = verdictOf(tr.pub, tr.me, v.me!.id)!;
    if (out.kind === "correct") expect(out.final).toBe(true);
    else expect(tr.pub.isFinal).toBe(true);
  });
  it("gap to the player ahead, leading, shared places", () => {
    const { ps } = tvOf("leaderboard");
    const order = standings(ps);
    expect(gapAhead(ps, order[0]!.id)).toEqual({ leading: true });
    const second = gapAhead(ps, order[1]!.id);
    expect(second).toEqual({ leading: false, points: order[0]!.row.score - order[1]!.row.score, name: order[0]!.name });
    expect(gapAhead(ps, "nobody")).toBeNull();
    const tied = ps.map((p) => ({ ...p, row: { ...p.row, rank: 1, score: 100 } }));
    expect(gapAhead(tied, tied[2]!.id)).toEqual({ leading: true });
    expect(sharedPlace(tied, tied[0]!.id)).toBe(true);
    expect(sharedPlace(ps, order[0]!.id)).toBe(false);
  });
});

describe("results and leaderboard (§12.4, §12.5)", () => {
  it("podium steps share a step on a tie (rank 1, 1, 3)", () => {
    const { ps } = tvOf("results");
    expect(podiumOf(ps).map((s) => s.step)).toEqual([1, 2, 3]);
    const tied = ps.map((p, i) => ({ ...p, row: { ...p.row, rank: i < 2 ? 1 : i + 1 } }));
    const pod = podiumOf(tied);
    expect(pod[0]!.players.length).toBe(2);
    expect(pod.length).toBe(3);
  });
  it("stat cards: most fastest, longest streak, most correct", () => {
    const { ps } = tvOf("results");
    const s = resultsStats(ps);
    expect(s.map((x) => x.key)).toEqual(["fastest", "streak", "correct"]);
    expect(s[0]!.count).toBe(4);
    expect(s[1]!.count).toBe(4);
    expect(resultsStats(ps.map((p) => ({ ...p, row: { ...p.row, fastest: 0, bestStreak: 0, correct: 0 } })))).toEqual([]);
  });
  it("biggest climber needs a previous board and at least one place", () => {
    const { ps } = tvOf("leaderboard");
    expect(biggestClimb(ps)).toBeNull(); // first board: rankBefore null
    const moved = ps.map((p, i) => ({ ...p, row: { ...p.row, rankBefore: ps.length - i, rank: i + 1 } }));
    expect(biggestClimb(moved)).toEqual({ id: moved[0]!.id, places: ps.length - 1 });
  });
  it("flame grows at 3, 5, 7", () => {
    expect([0, 2, 3, 4, 5, 6, 7, 12].map(flameLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe("characters: a function of the public view only (DESIGN-JAMAA §4.3, §9)", () => {
  it("ANSWER: done when answered, think when awaited; identical whatever this phone picked", () => {
    const v = phFix("answer.pad");
    const tr = triviaOfPhone(v)!;
    const ps = playersOf(v.room, tr.pub);
    const exp = ps.map((p) => expressionFor(tr, p));
    expect(exp.filter((e) => e === "done").length).toBe(tr.pub.answeredIds.length);
    expect(exp.every((e) => e === "done" || e === "think")).toBe(true);
    for (const choice of [0, 1, 2, 3, null]) {
      const t2 = { ...tr, me: { ...tr.me!, myChoice: choice, myTimeMs: choice === null ? null : 1234 } };
      expect(ps.map((p) => expressionFor(t2, p))).toEqual(exp);
    }
  });
  it("never shows right or wrong before REVEAL, in any fixture", () => {
    for (const f of readdirSync(DIR).filter((x) => x.startsWith("s2c.state.") && x.includes(".playing.trivia."))) {
      const v = fixture<TvRoomView | PlayerRoomView>(f);
      const tr = v.kind === "tv" ? triviaOfTv(v) : triviaOfPhone(v);
      if (!tr) continue;
      if (tr.pub.phase !== "REVEAL") expect(tr.pub.reveal, f).toBeNull();
      if (tr.pub.phase === "REVEAL" || tr.pub.phase === "LEADERBOARD" || tr.pub.phase === "RESULTS") continue;
      for (const p of playersOf(v.room, tr.pub)) expect(["cheer", "sad", "shock"]).not.toContain(expressionFor(tr, p));
    }
  });
  it("REVEAL: cheer on the right tile, sad (or shock when alone) on a wrong one, away without an answer", () => {
    const { tr, ps } = tvOf("reveal");
    const r = tr.pub.reveal!;
    for (const p of ps) {
      const c = r.choices.find((x) => x.id === p.id)!;
      const e = expressionFor(tr, p);
      if (c.correct) expect(e).toBe("cheer");
      else if (c.choice !== null) expect(["sad", "shock"]).toContain(e);
    }
    const st = tvOf("reveal.stumped");
    for (const p of st.ps) expect(expressionFor(st.tr, p)).toMatch(/shock|away|idle/);
  });
});

describe("TV studio geometry (§8.2, §12.7)", () => {
  it("tiles: A top-left, B top-right, C/D below, never mirrored in RTL; tf True left", () => {
    for (const rtl of [false, true]) {
      const [a, b, c, d] = [0, 1, 2, 3].map((i) => tileRect(i, "mc4", rtl));
      expect(a!.x).toBeLessThan(b!.x);
      expect(c!.x).toBe(a!.x);
      expect(c!.y).toBeGreaterThan(a!.y);
      expect(d!.x).toBe(b!.x);
      expect(tileRect(0, "tf", rtl).x).toBeLessThan(tileRect(1, "tf", rtl).x);
      for (const r of [a!, b!, c!, d!]) {
        expect(r.x).toBeGreaterThanOrEqual(mainRect(rtl).x);
        expect(r.x + r.w).toBeLessThanOrEqual(mainRect(rtl).x + mainRect(rtl).w + 0.01);
      }
    }
  });
  it("the tower moves to the start side in RTL and never overlaps the tiles", () => {
    expect(towerRect(false).x).toBeGreaterThan(mainRect(false).x);
    expect(towerRect(true).x).toBeLessThan(mainRect(true).x);
    for (const rtl of [false, true]) {
      const t = towerRect(rtl), m = mainRect(rtl);
      expect(t.x + t.w <= m.x || m.x + m.w <= t.x).toBe(true);
      for (const n of [1, 4, 8, 12]) {
        const last = towerRowRect(n - 1, rtl, n);
        expect(last.y + last.h).toBeLessThanOrEqual(towerBox(rtl, n).y + towerBox(rtl, n).h);
      }
    }
  });
  it("20 bulbs around the card, clockwise from the top-left; lit count follows the deadline", () => {
    const pts = bulbs(cardRect(false));
    expect(pts.length).toBe(20);
    expect(pts[1]!.x).toBeGreaterThan(pts[0]!.x);
    expect(pts[0]!.y).toBe(CARD_Y - 8);
    expect(bulbsLit(10_000, 10_000)).toBe(20);
    expect(bulbsLit(5_000, 10_000)).toBe(10);
    expect(bulbsLit(1, 10_000)).toBe(1);
    expect(bulbsLit(0, 10_000)).toBe(0);
    expect(bulbsLit(100, 0)).toBe(0);
  });
  it("podium slots fit the canvas for 1..12 and mirror in RTL", () => {
    for (let n = 1; n <= 12; n++) {
      const s = podiumSlots(n, false);
      expect(s.every((p) => p.x > 0 && p.x < CANVAS.w)).toBe(true);
      expect(podiumSlots(n, true).map((p) => p.x)).toEqual([...s.map((p) => p.x)].reverse());
    }
  });
  it("12 characters on one tile stack in 2 rows of 6 inside the tile (no overlap with the card)", () => {
    for (const type of ["mc4", "tf"] as const) {
      const t = tileRect(0, type, false);
      const pts = Array.from({ length: 12 }, (_, k) => crowdSlot(t, k, 12));
      expect(new Set(pts.map((p) => p.y)).size).toBe(2);
      for (const p of pts) {
        expect(p.x - CROWD_CHAR / 2).toBeGreaterThanOrEqual(t.x);
        expect(p.x + CROWD_CHAR / 2).toBeLessThanOrEqual(t.x + t.w);
        expect(p.y + CROWD_CHAR / 2).toBeLessThanOrEqual(t.y + t.h);
        expect(p.y - CROWD_CHAR / 2).toBeGreaterThan(CARD_Y + CARD_H);
      }
    }
  });
  it("coin and hop paths start and end where they should; the coin arcs (90 dp control point)", () => {
    const a = { x: 100, y: 300 }, b = { x: 800, y: 120 };
    expect(coinPoint(a, b, 0)).toEqual(a);
    expect(coinPoint(a, b, 1)).toEqual(b);
    expect(coinPoint(a, b, 0.5).y).toBeLessThan((a.y + b.y) / 2);
    expect(hopPoint(a, b, 0)).toEqual(a);
    expect(hopPoint(a, b, 1).x).toBeCloseTo(b.x, 6);
    expect(hopPoint(a, b, 1).y).toBeCloseTo(b.y, 6);
    expect(hopPoint(a, a, 0.5).y).toBe(a.y - 100);
    const top = coinPoint({ x: 0, y: 100 }, { x: 400, y: 100 }, 0.5);
    expect(top.y).toBeGreaterThan(100); // both ends in the top half: the arc dips below
    expect(towerScorePoint(0, false).x).toBeGreaterThan(towerScorePoint(0, true).x);
  });
});

describe("timelines on the shared sampler (§12.3, §12.4, §12.5)", () => {
  it("the reveal script fits its 6 s and keeps GAME-TRIVIA's order", () => {
    const at = (id: string): number => REVEAL_STEPS.find((s) => s.id === id)!.startMs;
    expect(at("time")).toBe(0);
    expect(at("out")).toBe(300);
    expect(at("jump")).toBe(900);
    expect(at("bolt")).toBe(2400);
    expect(at("coin")).toBe(3000);
    expect(at("sort")).toBe(4500);
    expect(endMs(REVEAL_STEPS, 12)).toBeLessThanOrEqual(6000);
    expect(endMs(REVEAL_STEPS, 12)).toBeGreaterThanOrEqual(REVEAL_END_MS);
    for (const s of REVEAL_STEPS) { expect(sample(s, s.startMs + s.durationMs + 12 * (s.staggerMs ?? 0), 0)).toBe(1); expect(sample(s, 0, 11)).toBe(0); }
  });
  it("the board race and the podium end within their phases", () => {
    expect(endMs(BOARD_STEPS)).toBeLessThanOrEqual(6000);
    expect(endMs(PODIUM_STEPS, 3)).toBeLessThan(4000);
  });
});

describe("sound cues (§12.6, DESIGN-JAMAA §5.5)", () => {
  const pub = (n: string) => tvOf(n).tr.pub;
  it("phase changes: slam on READ, A→D flips on ANSWER, drum + stamp on FINAL_INTRO; nothing on the first view", () => {
    expect(viewCues(null, pub("read"))).toEqual([]);
    expect(viewCues(pub("quiz_intro"), pub("read")).map((c) => c.cue)).toEqual(["sfx.stamp"]);
    const flips = viewCues(pub("read"), pub("answer.open"));
    expect(flips.map((c) => c.cue)).toEqual(["sfx.flip", "sfx.flip", "sfx.flip", "sfx.flip"]);
    expect(flips.map((c) => c.delayMs)).toEqual([0, 90, 180, 270]);
    expect(viewCues(pub("leaderboard"), pub("final_intro")).map((c) => c.cue)).toEqual(["sfx.drumroll", "sfx.stamp"]);
  });
  it("answer locks: one buzz per new answer, ≤ 3 per broadcast, ≥ LOCK_GAP_MS apart (never what)", () => {
    const open = pub("answer.open");
    const all = { ...open, answeredIds: open.scores.map((s) => s.playerId) };
    const cues = viewCues(open, all);
    expect(cues.every((c) => c.cue === "answer_lock")).toBe(true);
    expect(cues.length).toBe(Math.min(3, all.answeredIds.length - open.answeredIds.length));
    expect(cues.map((c) => c.delayMs)).toEqual(cues.map((_, i) => i * LOCK_GAP_MS));
  });
  it("the ANSWER countdown ticks the last 5 s and sounds the horn at 0, only on close samples", () => {
    expect(answerTickCue(5_100, 4_900)).toBe("sfx.tick");
    expect(answerTickCue(1_100, 900)).toBe("sfx.tickLast");
    expect(answerTickCue(150, 0)).toBe("sfx.timeUp");
    expect(answerTickCue(7_000, 6_800)).toBeNull();
    expect(answerTickCue(null, 4_000)).toBeNull();
    expect(answerTickCue(9_000, 4_000)).toBeNull(); // a stall never plays a stale tick
  });
  it("the reveal: quiz_correct normally, quiz_wrong on Stumped / Too slow, the crown only on a new leader", () => {
    const r = pub("reveal").reveal!;
    const m = revealMarks(r, 3, false);
    expect(m.find((x) => x.at === 300)?.cue).toBe("quiz_correct");
    expect(m.some((x) => x.cue === "crown_drop")).toBe(false);
    expect(m.map((x) => x.at)).toEqual([...m.map((x) => x.at)].sort((a, b) => a - b));
    expect(revealMarks(pub("reveal.stumped").reveal!, 0, false).find((x) => x.at === 300)?.cue).toBe("quiz_wrong");
    expect(revealMarks(r, 3, true).some((x) => x.cue === "crown_drop")).toBe(true);
    expect(revealMarks({ ...r, voided: true }, 3, true)).toEqual([{ at: 0, cue: "sfx.leave" }]);
    expect(introMarks(2).length).toBe(2);
  });
});

describe("helpers", () => {
  it("secs, excerpt, leftMs", () => {
    expect(secs(3240)).toBe("3.2");
    expect(secs(-5)).toBe("0.0");
    expect(excerpt("short", 10)).toBe("short");
    expect(excerpt("Which singer is known as the neighbour of the moon?", 20)).toBe("Which singer is kno…");
    expect(excerpt("سؤال طويل جداً عن المطبخ اللبناني", 10).endsWith("…")).toBe(true);
    expect(leftMs(null, 0, 0)).toBe(0);
    expect(leftMs(10_000, 4_000, 1_000)).toBe(5_000);
    expect(leftMs(10_000, 12_000, 0)).toBe(0);
  });
  it("activePlayers drops left players only", () => {
    const { ps } = tvOf("answer");
    expect(activePlayers(ps).length).toBe(ps.filter((p) => !p.row.left).length);
  });
});
