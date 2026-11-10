// Most Likely web view model (GAME-LIKELY §8, §12) against lane A's v2 fixtures: secrecy, the phone's own outcome, the
// TV reveal plan (shared layout + safe margin), awards staging, and the reveal step list fitting the server window.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlayerRoomView, TvRoomView } from "@jamaa/shared/protocol/v2";
import { LIKELY_TIMING, likelyJuryArc, likelyRevealMs, likelyRevealPositions, likelyVotingMs } from "@jamaa/shared/games/likely/meta";
import { ENTRANCE_GRACE_MS } from "@jamaa/shared/constants";
import { endMs } from "@jamaa/shared/motion";
import {
  SAFE, activeSeats, awardsOf, awardsStage, canVote, deadlineOf, fmtPercent, likelyModel, myReveal, needsVote, percentLines,
  phaseDurationMs, phoneAwards, ranking, revealExpression, revealPlan, signatureRow, targetsOf, winners,
} from "../../../src/games/likely/model";
import type { LikelyModel } from "../../../src/games/likely/model";
import { REVEAL_TAIL_MS, fitReveal, revealSteps, runStagger } from "../../../src/games/likely/tv/choreo";

const DIR = join(__dirname, "../../../../shared/fixtures/v2/games/likely");
const fx = <T = PlayerRoomView | TvRoomView>(name: string): T => (JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8")) as { view: T }).view;
const model = (name: string): LikelyModel => {
  const m = likelyModel(fx(name));
  if (!m) throw new Error(`${name}: not a likely view`);
  return m;
};

describe("likelyModel", () => {
  it("reads every playing fixture (TV and phones) and orders seats by seat", () => {
    const names = readdirSync(DIR).filter((f) => f.startsWith("s2c.state.") && f.includes(".playing.")).map((f) => f.replace(/\.json$/, ""));
    expect(names.length).toBeGreaterThan(20);
    for (const n of names) {
      const m = model(n);
      expect(m.seats.map((s) => s.seat)).toEqual([...m.seats.map((s) => s.seat)].sort((a, b) => a - b));
      expect(m.seats.length).toBe(m.pub.scores.length);
      if (n.includes(".tv.")) { expect(m.me).toBeNull(); expect(m.myId).toBeNull(); }
    }
  });
  it("is null outside a Most Likely game", () => {
    const v = fx<TvRoomView>("s2c.state.tv.playing.likely.card");
    expect(likelyModel({ ...v, game: null })).toBeNull();
    expect(likelyModel({ ...v, game: { ...v.game!, gameId: "mishana" } as unknown as TvRoomView["game"] })).toBeNull();
  });
});

describe("timers come from the server deadline", () => {
  it("phase durations follow GAME-LIKELY §4.1", () => {
    const card = model("s2c.state.tv.playing.likely.card");
    expect(card.pub.cardIndex).toBe(0);
    expect(phaseDurationMs(card.pub, 4)).toBe(LIKELY_TIMING.CARD_MS + ENTRANCE_GRACE_MS);
    expect(phaseDurationMs({ ...card.pub, cardIndex: 3 }, 4)).toBe(LIKELY_TIMING.CARD_MS);
    const voting = model("s2c.state.tv.playing.likely.voting");
    expect(deadlineOf(voting)).toEqual({ kind: "VOTE", at: voting.pub.deadline, durationMs: likelyVotingMs(activeSeats(voting).length) });
    const rev = model("s2c.state.tv.playing.likely.reveal");
    const r = rev.pub.reveal!;
    expect(phaseDurationMs(rev.pub, 4)).toBe(likelyRevealMs(r.votesCast, r.unanimous, r.topIds.length));
    expect(phaseDurationMs(model("s2c.state.tv.playing.likely.hold").pub, 3)).toBeNull();
  });
});

describe("secrecy (GAME-LIKELY §8.1)", () => {
  it("before REVEAL nothing on a phone or the TV names a pick other than the phone's own", () => {
    for (const n of ["s2c.state.tv.playing.likely.voting.some_voted", "s2c.state.player.playing.likely.voting.voted"]) {
      const m = model(n);
      expect(m.pub.reveal).toBeNull();
      expect(myReveal(m)).toBeNull();
      for (const s of m.seats) expect(revealExpression(m, s.id, "end")).toMatch(/idle|away/);
    }
  });
  it("secret mode: no ballots, no points, no runners and no coins on the TV", () => {
    const m = model("s2c.state.tv.playing.likely.reveal.secret.ar");
    expect(m.pub.reveal!.ballots).toBeNull();
    const plan = revealPlan(m, true);
    expect(plan.runners).toEqual([]);
    expect(plan.coins).toEqual([]);
    expect(Object.keys(plan.gains)).toEqual([]);
    for (const id of Object.keys(plan.arc)) expect(plan.ends[id]).toEqual(plan.arc[id]);
  });
  it("the TV reveal plan depends on public data only (same plan when the room's private fields change)", () => {
    const v = fx<TvRoomView>("s2c.state.tv.playing.likely.reveal");
    const a = revealPlan(likelyModel(v)!, false);
    const b = revealPlan(likelyModel({ ...v, room: { ...v.room, premium: !v.room.premium, cup: { stars: {}, last: null } } })!, false);
    expect(b).toEqual(a);
  });
  it("the vote grid offers every non-left player incl. yourself, minus the card's named player", () => {
    const m = model("s2c.state.player.playing.likely.voting");
    expect(canVote(m)).toBe(true);
    expect(targetsOf(m).map((s) => s.id)).toEqual(m.seats.filter((s) => !s.left).map((s) => s.id));
    expect(targetsOf(m).some((s) => s.id === m.myId)).toBe(true);
    const named = m.seats[1]!.id;
    const withNamed = { ...m, pub: { ...m.pub, card: { ...m.pub.card!, namedPlayerId: named } } };
    expect(targetsOf(withNamed).some((s) => s.id === named)).toBe(false);
    expect(needsVote(m)).toBe(m.me!.myVote === null);
    expect(needsVote(model("s2c.state.player.playing.likely.voting.voted"))).toBe(false);
  });
  it("a late joiner waits for the next card", () => {
    const m = model("s2c.state.player.playing.likely.waiting");
    expect(m.me!.waitingForNext).toBe(true);
    expect(canVote(m)).toBe(false);
  });
});

describe("the phone's own reveal (LK-PH-03)", () => {
  it("public: votes received, agreement and self-aware points, score before/after", () => {
    const m = model("s2c.state.player.playing.likely.reveal");
    const r = myReveal(m)!;
    expect(r).toMatchObject({ votedFor: m.myId, got: 3, percent: 75, top: true, agreed: 2, agreePoints: 100, selfAwarePoints: 100, unanimousPoints: 0, total: 200, scoreBefore: 0, score: 200 });
  });
  it("secret: a percentage and never a point", () => {
    const m = model("s2c.state.player.playing.likely.reveal.secret.ar");
    const r = myReveal(m)!;
    expect(r.total).toBe(0);
    expect(r.agreed).toBe(0);
    expect(r.percent).toBe(20);
  });
});

describe("TV reveal plan (§12.2, shared layout)", () => {
  it("runners join conga lines at the shared layout positions + the safe margin; self-voters stay seated", () => {
    const m = model("s2c.state.tv.playing.likely.reveal");
    const plan = revealPlan(m, false);
    const ids = m.seats.map((s) => s.id);
    const arc = likelyJuryArc(ids.length, false);
    const targeted = new Set(m.pub.reveal!.counts.map((c) => c.playerId));
    const running = m.pub.reveal!.ballots!.filter((b) => b.voterId !== b.targetId && !targeted.has(b.voterId));
    const pos = likelyRevealPositions(arc, ids, running);
    for (const id of plan.runners) expect(plan.ends[id]).toEqual({ x: pos[id]!.x + SAFE.x, y: pos[id]!.y + SAFE.y });
    expect(plan.selfVoters).toEqual(["p_0a1b2c3d4e5f60718293a4b5"]);
    // p0 voted for themself; p1 received a vote, so it heads its own line and stays seated.
    expect(plan.runners).toEqual(["p_2c3d4e5f60718293a4b5c6d7", "p_3d4e5f60718293a4b5c6d7e8"]);
    expect(plan.ends["p_1b2c3d4e5f60718293a4b5c6"]).toEqual(plan.arc["p_1b2c3d4e5f60718293a4b5c6"]);
    expect(plan.coins.map((c) => [c.voterId, c.points])).toEqual([
      ["p_0a1b2c3d4e5f60718293a4b5", 200], ["p_1b2c3d4e5f60718293a4b5c6", 100], ["p_2c3d4e5f60718293a4b5c6d7", 100],
    ]);
    // Coins leave from the head of the voter's pick and land on the voter.
    for (const c of plan.coins) expect(c.from.x).toBe(plan.arc[c.targetId]!.x);
  });
  it("RTL mirrors the arc", () => {
    const m = model("s2c.state.tv.playing.likely.reveal.tie");
    const ltr = revealPlan(m, false), rtl = revealPlan(m, true);
    const first = m.seats[0]!.id;
    expect(ltr.arc[first]!.x + rtl.arc[first]!.x).toBeCloseTo(960, 0);
  });
  it("expressions after the stamp: smug self-voting top, shock when unanimous, shy otherwise", () => {
    const pub = model("s2c.state.tv.playing.likely.reveal");
    expect(revealExpression(pub, "p_0a1b2c3d4e5f60718293a4b5", "stamp")).toBe("smug");
    const un = model("s2c.state.tv.playing.likely.reveal.unanimous");
    expect(revealExpression(un, "p_2c3d4e5f60718293a4b5c6d7", "stamp")).toBe("smug");
    const tie = model("s2c.state.tv.playing.likely.reveal.tie");
    expect(revealExpression(tie, "p_4e5f60718293a4b5c6d7e8f9", "stamp")).toBe("shy");
    expect(revealExpression(tie, "p_0a1b2c3d4e5f60718293a4b5", "run")).toBe("point");
  });
  it("percentage lines: percent desc, then seat", () => {
    const m = model("s2c.state.tv.playing.likely.reveal.secret.ar");
    const l = percentLines(m);
    expect(l.map((x) => x.percent)).toEqual([60, 20, 20]);
    expect(l[1]!.seat.seat).toBeLessThan(l[2]!.seat.seat);
  });
  it("percentages keep Western digits in every locale", () => {
    expect(fmtPercent(50, "en")).toBe("50%");
    for (const l of ["fr", "ar", "es"]) expect(fmtPercent(33, l)).toMatch(/33/);
  });
});

describe("reveal step list (shared sampler)", () => {
  it("the run takes 100 ms per voter and ≤ 2.5 s in all", () => {
    for (let n = 1; n <= 12; n++) expect(520 + runStagger(n) * (n - 1)).toBeLessThanOrEqual(2500);
  });
  it("always ends inside the server's REVEAL window, leaving the hold", () => {
    for (const publicMode of [true, false]) for (const unanimous of [false, true]) for (let votes = 0; votes <= 12; votes++) {
      const shape = { runners: publicMode ? votes : 0, envelopes: publicMode ? 0 : votes, publicMode, chaos: false, none: votes === 0, unanimous, coins: publicMode ? votes : 0 };
      const count = Math.max(votes, 1);
      const window = likelyRevealMs(votes, unanimous, 1);
      const steps = fitReveal(revealSteps(shape), window, count);
      expect(endMs(steps, count)).toBeLessThanOrEqual(window - REVEAL_TAIL_MS + 1);
      expect(steps.map((s) => s.id)).toContain("dim");
      if (!shape.none) expect(steps.some((s) => s.id === (publicMode ? "run" : "env"))).toBe(true);
      if (!publicMode) expect(steps.some((s) => s.id === "coin")).toBe(false);
    }
  });
  it("chaos scrambles and never spotlights", () => {
    const s = revealSteps({ runners: 4, envelopes: 0, publicMode: true, chaos: true, none: false, unanimous: false, coins: 0 });
    expect(s.map((x) => x.id)).toContain("scramble");
    expect(s.map((x) => x.id)).not.toContain("spot");
  });
});

describe("awards (§12.4)", () => {
  it("3 s intro, 4 s per trio, then Mind Reader in public mode only", () => {
    expect(awardsStage(5, true, 0)).toEqual({ kind: "intro" });
    expect(awardsStage(5, true, 3000)).toEqual({ kind: "trio", index: 0 });
    expect(awardsStage(5, true, 7000)).toEqual({ kind: "trio", index: 1 });
    expect(awardsStage(5, true, 11000)).toEqual({ kind: "mindReader" });
    expect(awardsStage(5, false, 11000)).toEqual({ kind: "trio", index: 1 });
  });
  it("every player has exactly one signature or mystery award; extras come after", () => {
    const m = model("s2c.state.tv.playing.likely.awards");
    const rows = signatureRow(m);
    expect(rows.every((r) => r.award !== null)).toBe(true);
    const star = m.pub.awards.find((a) => a.kind === "star")!;
    const mine = awardsOf(m.pub, star.playerIds[0]!);
    expect(mine[0]!.kind === "signature" || mine[0]!.kind === "mystery").toBe(true);
    expect(mine.some((a) => a.kind === "star")).toBe(true);
    expect(ranking(m)[0]!.score).toBeGreaterThanOrEqual(ranking(m)[1]!.score);
  });
  it("secret mode: no Mind Reader, no Self-aware", () => {
    const m = model("s2c.state.tv.playing.likely.awards.secret.ar");
    expect(m.pub.awards.some((a) => a.kind === "mindReader" || a.kind === "selfAware")).toBe(false);
    expect(m.seats.every((s) => s.score === 0)).toBe(true);
  });
  it("a phone keeps the Mind Reader for RESULTS (the TV ceremony reveals it last)", () => {
    const m = model("s2c.state.tv.playing.likely.awards");
    const mr = m.pub.awards.find((a) => a.kind === "mindReader")!;
    const id = mr.playerIds[0]!;
    expect(phoneAwards(m.pub, id, false).some((a) => a.kind === "mindReader")).toBe(false);
    expect(phoneAwards(m.pub, id, true).some((a) => a.kind === "mindReader")).toBe(true);
    expect(phoneAwards(m.pub, id, false)[0]!.kind).toMatch(/signature|mystery/);
  });
});

describe("award holder of a card (phone winner chip, public data only)", () => {
  it("the top target(s) in seat order; nobody on chaos", () => {
    const m = model("s2c.state.player.playing.likely.reveal");
    expect(winners(m).map((s) => s.id)).toEqual(m.pub.reveal!.topIds);
    expect(winners(model("s2c.state.tv.playing.likely.reveal.chaos"))).toEqual([]);
    expect(winners(model("s2c.state.tv.playing.likely.reveal.none"))).toEqual([]);
  });
  it("is identical on every phone and the TV of the same card (no private input)", () => {
    const tv = model("s2c.state.tv.playing.likely.reveal");
    const ph = model("s2c.state.player.playing.likely.reveal");
    if (tv.pub.card?.id === ph.pub.card?.id) expect(winners(tv).map((s) => s.id)).toEqual(winners(ph).map((s) => s.id));
    expect(winners({ ...ph, me: null, myId: null }).map((s) => s.id)).toEqual(winners(ph).map((s) => s.id));
  });
});
