// GAME-BLUFF §8 / §12 (lane B): the pure Bluff view model, reveal plan and choreography, against lane A's v2 fixtures.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlayerRoomView, TvRoomView } from "@jamaa/shared/protocol/v2";
import { EASINGS, sample } from "@jamaa/shared/motion";
// The client keeps its own copy of the §4.1 timings (engines never reach the client, JAMAA-PLATFORM §2.1); pin them.
import * as C from "../../../../shared/src/games/bluff/engine/constants";
import {
  BEAT_MS, NOMINAL, activeSeats, awardAt, baseExpression, beatAt, beatDeltas, bluffModel, deadlineOf, errorKey, fullMs, graphemes, isFinal,
  letterOf, lieReady, myReveal, needsAction, nominalMs, placeOf, promptLines, propOf, ranked, revealPlan, runningScores, seatExpression,
  votedStep, votingNominalMs,
} from "../../../src/games/bluff/model";
import type { BluffModel, Reveal } from "../../../src/games/bluff/model";
import { CARD, MAX_COINS, bezier, coinsOf, control, hoppers, landing, revealTimeline, seatX } from "../../../src/games/bluff/choreo";

const DIR = join(__dirname, "../../../../shared/fixtures/v2/games/bluff");
const load = <T>(f: string): T => (JSON.parse(readFileSync(join(DIR, f), "utf8")) as { view: T }).view;
const allStates = readdirSync(DIR).filter((f) => f.startsWith("s2c.state.") && f.includes(".playing."));
const model = (f: string): BluffModel => bluffModel(load<PlayerRoomView | TvRoomView>(f))!;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A final ("No truth") reveal built from the round-2 fixture: anonymous ballots, a crown, likes (+20). */
function finalReveal(): BluffModel {
  const m = model("s2c.state.tv.playing.bluff.reveal.json");
  const pub = clone(m.pub);
  const ids = m.seats.map((s) => s.id);
  pub.roundKind = "noTruth";
  pub.round = 3;
  pub.multiplier = 1;
  pub.reveal = {
    final: true,
    steps: [
      { optionId: "aaaaaaa1", kind: "house", quick: false, text: "Meow means rent", authorIds: [], helped: false, voteCount: 1, voterIds: [], likerIds: [], foundEarlyIds: [], spotOnIds: [], top: false, deltas: [] },
      { optionId: "aaaaaaa2", kind: "lie", quick: false, text: "Where is the fish?", authorIds: [ids[1]!], helped: false, voteCount: 3, voterIds: [], likerIds: [ids[2]!], foundEarlyIds: [], spotOnIds: [], top: true,
        deltas: [{ playerId: ids[1]!, points: 450, reason: "fooled" }, { playerId: ids[1]!, points: 400, reason: "convincing" }, { playerId: ids[1]!, points: 20, reason: "like" }] },
    ],
    spotOnDeltas: [],
    unpicked: [{ optionId: "aaaaaaa3", text: "Open the door", authorIds: [ids[3]!], likerIds: [], deltas: [] }],
    truth: null,
    durationMs: 1500 + 2 * 2800 + 3000 + 2000 + 2500 + 1500,
  };
  pub.scores = pub.scores.map((s) => ({ ...s, scoreBefore: s.score, score: s.playerId === ids[1] ? s.score + 870 : s.score }));
  return bluffModel({ ...load<TvRoomView>("s2c.state.tv.playing.bluff.reveal.json"), game: { ...load<TvRoomView>("s2c.state.tv.playing.bluff.reveal.json").game!, public: pub } as TvRoomView["game"] })!;
}

describe("constants mirror the engine (GAME-BLUFF §4.1)", () => {
  it("nominal phase timings", () => {
    expect(NOMINAL.ROUND_INTRO).toBe(C.ROUND_INTRO_MS);
    expect(NOMINAL.ROUND_INTRO_FINAL).toBe(C.ROUND_INTRO_FINAL_MS);
    expect(NOMINAL.WRITING).toBe(C.WRITING_MS);
    expect(NOMINAL.WRITING_FINAL).toBe(C.WRITING_FINAL_MS);
    expect(NOMINAL.SCORES).toBe(C.SCORES_MS);
    expect(NOMINAL.SCORES_VOIDED).toBe(C.SCORES_VOIDED_MS);
    expect(NOMINAL.AWARDS_BASE).toBe(C.AWARDS_BASE_MS);
    expect(NOMINAL.AWARDS_PER_CARD).toBe(C.AWARDS_PER_CARD_MS);
    for (const n of [2, 3, 6, 9, 13]) expect(votingNominalMs(n)).toBe(C.votingMs(n, 1));
  });
});

describe("bluffModel", () => {
  it("reads every playing fixture (TV and phone) without throwing; TV has no `me`", () => {
    for (const f of allStates) {
      const m = model(f);
      expect(m, f).not.toBeNull();
      expect(m.seats.length).toBeGreaterThan(0);
      if (f.includes(".tv.")) { expect(m.me).toBeNull(); expect(m.myId).toBeNull(); }
    }
  });
  it("seats come in seat order with their public scores", () => {
    const m = model("s2c.state.player.playing.bluff.scores.json");
    expect(m.seats.map((s) => s.seat)).toEqual([...m.seats.map((s) => s.seat)].sort((a, b) => a - b));
    expect(activeSeats(m).every((s) => !s.left)).toBe(true);
  });
  it("is null for another game", () => {
    const v = load<TvRoomView>("s2c.state.tv.playing.bluff.writing.json");
    expect(bluffModel({ ...v, game: null })).toBeNull();
  });
});

describe("timers", () => {
  it("nominal durations per phase (first round card includes the entrance grace)", () => {
    const intro = model("s2c.state.tv.playing.bluff.round_intro.json").pub;
    expect(nominalMs(intro)).toBe(intro.promptIndex === 0 ? 4000 + 2500 : 4000);
    const w = model("s2c.state.tv.playing.bluff.writing.json").pub;
    expect(nominalMs(w)).toBe(60_000);
    const v = model("s2c.state.tv.playing.bluff.voting.json").pub;
    expect(nominalMs(v)).toBe(votingNominalMs(v.options.length));
    const r = model("s2c.state.tv.playing.bluff.reveal.json").pub;
    expect(nominalMs(r)).toBe(r.reveal!.durationMs);
    expect(nominalMs(model("s2c.state.tv.playing.bluff.results.json").pub)).toBeNull();
  });
  it("infers the room pace from the first remaining time (the pace is not in the view)", () => {
    const w = model("s2c.state.tv.playing.bluff.writing.json").pub;
    expect(fullMs(w, 59_400)).toBe(60_000);
    expect(fullMs(w, 44_800)).toBe(45_000);
    expect(fullMs(w, 89_000)).toBe(90_000);
    // a deadline moved by the like grace reads as nearly spent
    const v = model("s2c.state.tv.playing.bluff.voting.json").pub;
    expect(fullMs(v, 3_000)).toBeGreaterThan(3_000);
  });
  it("deadlineOf caches the first sight of a deadline", () => {
    const w = clone(model("s2c.state.tv.playing.bluff.writing.json").pub);
    w.deadline = 1_000_000 + 60_000;
    const a = deadlineOf(w, 1_000_000)!;
    const b = deadlineOf(w, 1_030_000)!;
    expect(a.durationMs).toBe(60_000);
    expect(b.durationMs).toBe(60_000);
    expect(deadlineOf({ ...w, deadline: null }, 0)).toBeNull();
  });
});

describe("characters read the public view only (DESIGN-JAMAA §4.3)", () => {
  it("writing: submitted → done + envelope, else think + pencil", () => {
    const m = model("s2c.state.tv.playing.bluff.writing.submitted.json");
    for (const s of m.seats.filter((x) => x.connected)) {
      const inn = m.pub.submittedIds.includes(s.id);
      expect(baseExpression(m, s)).toBe(inn ? "done" : "think");
      expect(propOf(m, s)).toBe(inn ? "envelope" : "pencil");
    }
  });
  it("the same public view gives the same characters whatever `me` holds", () => {
    const a = model("s2c.state.player.playing.bluff.voting.json");
    const b = clone(a);
    (b as { me: unknown }).me = { ...a.me!, myVote: a.pub.options[0]!.id, myLikes: [a.pub.options[1]!.id] };
    for (const s of a.seats) {
      expect(baseExpression(b, s)).toBe(baseExpression(a, s));
      expect(propOf(b, s)).toBe(propOf(a, s));
    }
  });
});

describe("reveal plan (GAME-BLUFF §12.2)", () => {
  const fixtures = allStates.filter((f) => f.includes("reveal"));
  it("matches the server's revealDurationMs formula for every fixture reveal", () => {
    for (const f of fixtures) {
      const r = model(f).pub.reveal!;
      const plan = revealPlan(r);
      expect(plan.total, f).toBe(r.durationMs);
      expect(plan.scale).toBe(1);
    }
  });
  it("lies come first, the truth last; quick hits get 1.2 s; montage and likes follow", () => {
    const r = model("s2c.state.tv.playing.bluff.reveal.json").pub.reveal!;
    const plan = revealPlan(r);
    const kinds = plan.beats.map((b) => b.kind);
    expect(kinds[0]).toBe("intro");
    expect(kinds.indexOf("truth")).toBeGreaterThan(kinds.indexOf("lie"));
    expect(kinds).toContain("montage");
    const lie = plan.beats.find((b) => b.kind === "lie")!;
    expect(lie.dur).toBe(BEAT_MS.lieBase + BEAT_MS.liePerVoter * r.steps[lie.steps[0]!]!.voterIds.length);
    const q = clone(r);
    q.steps[0]!.quick = true;
    q.durationMs = 0;
    expect(revealPlan(q).beats.find((b) => b.kind === "quick")!.dur).toBe(BEAT_MS.quick);
  });
  it("reduced motion halves it; a short server timer squeezes it to fit", () => {
    const r = model("s2c.state.tv.playing.bluff.reveal.json").pub.reveal!;
    expect(revealPlan(r, true).total).toBe(Math.round(r.durationMs / 2));
    expect(revealPlan({ ...r, durationMs: 5000 }).total).toBeLessThanOrEqual(5000);
  });
  it("final: answers (fewest votes first), the crown, the twist; no voter ever named", () => {
    const m = finalReveal();
    const r = m.pub.reveal!;
    const plan = revealPlan(r);
    expect(plan.beats.map((b) => b.kind)).toEqual(["intro", "answer", "answer", "crown", "twist", "montage", "likes"]);
    expect(plan.total).toBe(r.durationMs);
    expect(r.steps.every((s) => s.voterIds.length === 0)).toBe(true);
    expect(votedStep(r, m.seats[0]!.id)).toBeNull();
    for (const b of plan.beats) expect(hoppers(r, b)).toEqual([]);
    // coins come from the neutral ballot box, never from a voter
    for (const b of plan.beats) for (const c of coinsOf(r, b)) expect(["box"]).toContain(c.from);
  });
  it("beatAt walks the beats in order", () => {
    const plan = revealPlan(model("s2c.state.tv.playing.bluff.reveal.json").pub.reveal!);
    expect(beatAt(plan, 0)).toBe(0);
    expect(beatAt(plan, plan.beats[2]!.start + 1)).toBe(2);
    expect(beatAt(plan, plan.total + 10_000)).toBe(plan.beats.length - 1);
  });
});

describe("points add up with the reveal (GAME-BLUFF §13.3 invariant 3)", () => {
  const check = (m: BluffModel): void => {
    const plan = revealPlan(m.pub.reveal!);
    const run = runningScores(m, plan);
    const end = run[run.length - 1]!;
    for (const s of m.seats) expect(end.get(s.id), s.name).toBe(s.score);
    // a beat never takes points away
    for (let i = 1; i < run.length; i++) for (const s of m.seats) expect(run[i]!.get(s.id)!).toBeGreaterThanOrEqual(run[i - 1]!.get(s.id)!);
  };
  it("for every fixture reveal", () => { for (const f of allStates.filter((x) => x.includes("reveal"))) check(model(f)); });
  it("for a final (votes, the +400 crown, +20 likes)", () => {
    const m = finalReveal();
    check(m);
    const plan = revealPlan(m.pub.reveal!);
    const crown = plan.beats.find((b) => b.kind === "crown")!;
    expect([...beatDeltas(m.pub.reveal!, crown).values()]).toEqual([400]);
  });
});

describe("choreography (shared sampler)", () => {
  const r = model("s2c.state.tv.playing.bluff.reveal.json").pub.reveal!;
  const plan = revealPlan(r);
  const tl = revealTimeline(r, plan);
  it("every step has a known easing, a unique id and ends inside its beat", () => {
    const ids = new Set<string>();
    for (const s of tl.steps) {
      expect(EASINGS[s.easing]).toBeDefined();
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      const b = Number(/^b(\d+)\./.exec(s.id)![1]);
      const beat = plan.beats[b]!;
      expect(s.startMs).toBeGreaterThanOrEqual(beat.start);
      expect(s.startMs).toBeLessThanOrEqual(beat.start + beat.dur);
    }
  });
  it("marks are ordered: land ≤ stamp ≤ pop ≤ coins ≤ tick", () => {
    for (const b of tl.beats) {
      expect(b.marks.land).toBeLessThanOrEqual(b.marks.stamp);
      expect(b.marks.stamp).toBeLessThanOrEqual(b.marks.pop);
    }
  });
  it("is deterministic (the same reveal samples the same curve)", () => {
    const again = revealTimeline(clone(r), revealPlan(clone(r)));
    for (const [i, s] of tl.steps.entries()) for (const t of [0, 0.25, 0.5, 1]) expect(sample(s, s.startMs + s.durationMs * t)).toBe(sample(again.steps[i]!, again.steps[i]!.startMs + again.steps[i]!.durationMs * t));
  });
  it("coins fly from each fooled voter to the liar (≤ 24); a house lie pays nobody", () => {
    for (const b of plan.beats) {
      const step = r.steps[b.steps[0] ?? -1];
      const coins = coinsOf(r, b);
      expect(coins.length).toBeLessThanOrEqual(MAX_COINS);
      if (b.kind === "lie" && step) expect(coins.map((c) => c.from).sort()).toEqual([...step.voterIds].sort());
    }
    const house: Reveal = clone(r);
    house.steps[0]!.kind = "house";
    house.steps[0]!.authorIds = [];
    expect(coinsOf(house, revealPlan(house).beats.find((b) => b.kind === "lie")!)).toEqual([]);
  });
});

describe("stage geometry", () => {
  it("seats mirror in RTL and stay on the canvas", () => {
    for (const n of [3, 6, 12]) for (let i = 0; i < n; i++) {
      const x = seatX(n, i, false);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(960);
      expect(seatX(n, i, true)).toBeCloseTo(960 - x);
    }
  });
  it("landing spots sit on the card top, shoulder to shoulder; coins arc above the chord", () => {
    const pts = [0, 1, 2].map((k) => landing(k, 3));
    expect(pts[1]!.x).toBe(CARD.x);
    expect(pts[0]!.x).toBeLessThan(pts[2]!.x);
    const a = { x: 300, y: 150 }, z = { x: 700, y: 500 };
    expect(control(a, z).y).toBeLessThan(Math.min(a.y, z.y));
    expect(bezier(a, control(a, z), z, 0)).toEqual(a);
    expect(bezier(a, control(a, z), z, 1)).toEqual(z);
  });
});

describe("reveal expressions follow the public reveal", () => {
  it("voters facepalm on a lie after the stamp, the author turns smug after the pop", () => {
    const m = model("s2c.state.tv.playing.bluff.reveal.json");
    const r = m.pub.reveal!;
    const plan = revealPlan(r);
    const b = plan.beats.find((x) => x.kind === "lie")!;
    const step = r.steps[b.steps[0]!]!;
    const voter = m.byId.get(step.voterIds[0]!)!;
    const author = m.byId.get(step.authorIds[0]!)!;
    expect(seatExpression(r, b, 0, voter, false)).toBe("think");
    expect(seatExpression(r, b, 2, voter, false)).toBe("facepalm");
    expect(seatExpression(r, b, 2, author, false)).toBe("idle");
    expect(seatExpression(r, b, 3, author, false)).toBe("smug");
    const t = plan.beats.find((x) => x.kind === "truth")!;
    const finder = m.byId.get(r.steps[t.steps[0]!]!.voterIds[0]!)!;
    expect(seatExpression(r, t, 2, finder, false)).toBe("cheer");
  });
});

describe("the phone's own reveal and actions", () => {
  it("myReveal: own fooled count, the lie this phone fell for, the prompt total", () => {
    const m = model("s2c.state.player.playing.bluff.reveal.json");
    const mine = myReveal(m)!;
    const seat = m.byId.get(m.myId!)!;
    expect(mine.total).toBe(seat.score - seat.scoreBefore);
    const authored = m.pub.reveal!.steps.filter((s) => s.authorIds.includes(m.myId!));
    expect(mine.fooled).toBe(authored.reduce((a, s) => a + s.voterIds.length, 0));
  });
  it("needsAction: writing until locked, voting until voted (Spot on never)", () => {
    expect(needsAction(model("s2c.state.player.playing.bluff.writing.json"))).toBe(true);
    expect(needsAction(model("s2c.state.player.playing.bluff.writing.locked.json"))).toBe(false);
    expect(needsAction(model("s2c.state.player.playing.bluff.voting.json"))).toBe(true);
    expect(needsAction(model("s2c.state.player.playing.bluff.voting.voted.json"))).toBe(false);
    expect(needsAction(model("s2c.state.player.playing.bluff.voting.spot_on.json"))).toBe(false);
    expect(needsAction(model("s2c.state.player.playing.bluff.waiting.json"))).toBe(false);
  });
  it("lie input rules mirror §5.1 (2 letters, 60 graphemes)", () => {
    expect(lieReady("a")).toBe(false);
    expect(lieReady("...")).toBe(false);
    expect(lieReady("ok")).toBe(true);
    expect(lieReady("غزال")).toBe(true);
    expect(lieReady("x".repeat(61))).toBe(false);
    expect(graphemes("été")).toBe(3);
  });
  it("game error codes map to this game's copy", () => {
    expect(errorKey("LIE_TOO_CLOSE")).toBe("game.bluff.error.lieTooClose");
    expect(errorKey("CANNOT_VOTE_SPOT_ON")).toBe("game.bluff.error.cannotVoteSpotOn");
  });
});

describe("misc", () => {
  it("ranking shares places on equal scores", () => {
    const m = model("s2c.state.tv.playing.bluff.results.json");
    const list = ranked(m.seats);
    for (const s of list) for (const o of list) if (s.score === o.score) expect(placeOf(list, s.id)).toBe(placeOf(list, o.id));
  });
  it("prompt lines: an Arabic original keeps translit + translation; any other translation replaces the original", () => {
    expect(promptLines({ id: "00000000", type: "proverb_end", original: "القرد بعين إمو…", translit: "il-2ird…", display: "The monkey…", lengthHint: "short", rerun: false }))
      .toEqual({ main: "القرد بعين إمو…", translit: "il-2ird…", sub: "The monkey…" });
    expect(promptLines({ id: "00000000", type: "fact_blank", original: "Wombat…", translit: null, display: "Les crottes…", lengthHint: "short", rerun: false }))
      .toEqual({ main: "Les crottes…", translit: null, sub: null });
  });
  it("final detection, option letters, award timing", () => {
    expect(isFinal(finalReveal().pub)).toBe(true);
    expect(letterOf(0)).toBe("A");
    expect(letterOf(12)).toBe("M");
    expect(awardAt(1) - awardAt(0)).toBe(NOMINAL.AWARDS_PER_CARD);
  });
});
