// Most Likely web view model (GAME-LIKELY §8, §12) against lane A's v2 fixtures: secrecy, the phone's own outcome (who
// voted for me, no points), the TV reveal plan (one row, vote stacks; shared layout + safe margin), awards staging, and
// the reveal step list fitting the server window.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlayerRoomView, TvRoomView } from "@jamaa/shared/protocol/v2";
import { LIKELY_STAGE, LIKELY_TIMING, likelyPublicTokens, likelyRevealMs, likelyRow, likelyVotingMs } from "@jamaa/shared/games/likely/meta";
import { ENTRANCE_GRACE_MS } from "@jamaa/shared/constants";
import { endMs } from "@jamaa/shared/motion";
import {
  SAFE, activeSeats, awardsOf, awardsStage, canVote, deadlineOf, fmtPercent, likelyModel, myReveal, needsVote, percentLines,
  phaseDurationMs, phoneAwards, revealExpression, revealPlan, signatureRow, targetsOf, winners,
} from "../../../src/games/likely/model";
import type { LikelyModel } from "../../../src/games/likely/model";
import { HOLD_MIN_MS, REVEAL_TAIL_MS, TOKEN_AT, TOKEN_MS, fitReveal, revealSteps, tokenStagger } from "../../../src/games/likely/tv/choreo";

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
  it("secret mode: no ballots; the TV's tokens are anonymous envelopes, one per vote, from the tally", () => {
    const m = model("s2c.state.tv.playing.likely.reveal.secret.ar");
    expect(m.pub.reveal!.ballots).toBeNull();
    const plan = revealPlan(m, true);
    expect(plan.tokens.every((x) => x.voterId === null)).toBe(true);
    expect(plan.tokens).toHaveLength(m.pub.reveal!.votesCast);
    for (const c of m.pub.reveal!.counts) expect(plan.tokens.filter((x) => x.targetId === c.playerId)).toHaveLength(c.count);
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
  it("public: votes received and who cast them, who made the same pick; no points", () => {
    const m = model("s2c.state.player.playing.likely.reveal");
    const r = myReveal(m)!;
    expect(r).toMatchObject({ votedFor: m.myId, got: 3, percent: 75, top: true });
    // Rami voted for themself; Léa and نور voted for Rami too.
    expect(r.voters.map((s) => s.name)).toEqual(["Léa", "نور"]);
    expect(r.samePick.map((s) => s.name)).toEqual(["Léa", "نور"]);
    expect(r).not.toHaveProperty("total");
  });
  it("secret: a percentage, never who voted", () => {
    const m = model("s2c.state.player.playing.likely.reveal.secret.ar");
    const r = myReveal(m)!;
    expect(r.voters).toEqual([]);
    expect(r.samePick).toEqual([]);
    expect(r.percent).toBe(20);
  });
});

describe("TV reveal plan (§12.2, shared layout)", () => {
  it("public: one token per ballot, in ballot order, at the shared stack slots + the safe margin; self-votes included", () => {
    const m = model("s2c.state.tv.playing.likely.reveal");
    const plan = revealPlan(m, false);
    const ids = m.seats.filter((s) => !s.left).map((s) => s.id);
    const want = likelyPublicTokens(likelyRow(ids.length, false, true), ids, m.pub.reveal!.ballots!);
    expect(plan.tokens.map((x) => [x.voterId, x.targetId, x.k])).toEqual(want.map((x) => [x.voterId, x.targetId, x.k]));
    for (const [i, x] of plan.tokens.entries()) expect(x.at).toEqual({ x: want[i]!.at.x + SAFE.x, y: want[i]!.at.y + SAFE.y });
    expect(plan.tokens.some((x) => x.voterId === x.targetId)).toBe(true);
    // The row sits under the shrunk card, inside the canvas; tokens never leave it.
    for (const id of ids) expect(plan.row[id]!.y).toBe(LIKELY_STAGE.revealRowY + SAFE.y);
    for (const x of plan.tokens) expect(x.at.y + plan.cell / 2).toBeLessThanOrEqual(540 - 27 + 0.1);
  });
  it("RTL mirrors the row", () => {
    const m = model("s2c.state.tv.playing.likely.reveal.tie");
    const ltr = revealPlan(m, false), rtl = revealPlan(m, true);
    const first = m.seats[0]!.id;
    expect(ltr.row[first]!.x + rtl.row[first]!.x).toBeCloseTo(960, 0);
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
  it("the votes land one by one, 160–320 ms apart, the whole build ≤ 2.4 s + one flight", () => {
    for (let n = 1; n <= 12; n++) {
      expect(tokenStagger(n)).toBeGreaterThanOrEqual(160);
      expect(tokenStagger(n)).toBeLessThanOrEqual(320);
      expect(tokenStagger(n) * (n - 1)).toBeLessThanOrEqual(2400);
    }
  });
  it("always ends inside the server's REVEAL window, leaving the hold; no point step exists", () => {
    for (const unanimous of [false, true]) for (let votes = 0; votes <= 12; votes++) {
      const shape = { tokens: votes, chaos: false, none: votes === 0, unanimous };
      const count = Math.max(votes, 1);
      const window = likelyRevealMs(votes, unanimous, 1);
      const steps = fitReveal(revealSteps(shape), window, count);
      expect(endMs(steps, count)).toBeLessThanOrEqual(window - REVEAL_TAIL_MS + 1);
      expect(steps.map((s) => s.id)).toContain("dim");
      if (!shape.none) expect(steps.map((s) => s.id)).toEqual(expect.arrayContaining(["token", "count", "spot", "stamp", "hold"]));
      for (const id of ["coin", "tick", "run", "board"]) expect(steps.some((s) => s.id === id)).toBe(false);
    }
  });
  it("the hold fills the rest of the window and gets ≥ 2 s at every room size (natural speed)", () => {
    for (const chaos of [false, true]) for (let votes = 1; votes <= 12; votes++) {
      const shape = { tokens: votes, chaos, none: false, unanimous: false };
      const count = Math.max(votes, 1);
      const window = likelyRevealMs(votes, false, 1);
      const steps = fitReveal(revealSteps(shape), window, count);
      const hold = steps.find((s) => s.id === "hold")!;
      expect(hold.startMs + hold.durationMs).toBeCloseTo(window - REVEAL_TAIL_MS, 5);
      expect(hold.durationMs).toBeGreaterThanOrEqual(HOLD_MIN_MS);
      expect(hold.startMs).toBe(revealSteps(shape).find((s) => s.id === "hold")!.startMs);
    }
    expect(TOKEN_AT + TOKEN_MS).toBeLessThan(1500);
  });
  it("chaos scrambles and never spotlights", () => {
    const s = revealSteps({ tokens: 4, chaos: true, none: false, unanimous: false });
    expect(s.map((x) => x.id)).toContain("scramble");
    expect(s.map((x) => x.id)).not.toContain("spot");
    expect(s.map((x) => x.id)).not.toContain("stamp");
  });
});

describe("awards (§12.4)", () => {
  it("3 s intro, then 4 s per trio (no Mind Reader page: no points)", () => {
    expect(awardsStage(5, 0)).toEqual({ kind: "intro" });
    expect(awardsStage(5, 3000)).toEqual({ kind: "trio", index: 0 });
    expect(awardsStage(5, 7000)).toEqual({ kind: "trio", index: 1 });
    expect(awardsStage(5, 11000)).toEqual({ kind: "trio", index: 1 });
  });
  it("every player has exactly one signature or mystery award; extras come after", () => {
    const m = model("s2c.state.tv.playing.likely.awards");
    const rows = signatureRow(m);
    expect(rows.every((r) => r.award !== null)).toBe(true);
    const star = m.pub.awards.find((a) => a.kind === "star")!;
    const mine = awardsOf(m.pub, star.playerIds[0]!);
    expect(mine[0]!.kind === "signature" || mine[0]!.kind === "mystery").toBe(true);
    expect(mine.some((a) => a.kind === "star")).toBe(true);
    expect(phoneAwards(m.pub, star.playerIds[0]!)).toEqual(mine);
  });
  it("only signature, mystery and star awards exist; every score is 0 (both modes)", () => {
    for (const n of ["s2c.state.tv.playing.likely.awards", "s2c.state.tv.playing.likely.awards.secret.ar"]) {
      const m = model(n);
      expect(m.pub.awards.every((a) => ["signature", "mystery", "star"].includes(a.kind))).toBe(true);
      expect(m.pub.scores.every((x) => x.score === 0)).toBe(true);
    }
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
