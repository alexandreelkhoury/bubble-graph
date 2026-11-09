// GAME-BLUFF §4, §5, §7, §13.4 "Flow", "Spot on", "Anti-oracle", "Options build".
import { describe, expect, it } from "vitest";
import { definition } from "../../../src/games/bluff/definition";
import { slotKind } from "../../../src/games/bluff/engine/reduce";
import { G, GRACE, P, T0, TV, item, lieFor, pack, synthCatalog } from "./harness";


describe("phases and deadlines", () => {
  it("first ROUND_INTRO = 4 000 + ENTRANCE_GRACE_MS; host advance inline; non-host refused", () => {
    const g = new G();
    expect(g.s.phase).toBe("ROUND_INTRO");
    expect(g.s.deadline).toBe(T0 + 4000 + GRACE);
    expect(definition.nextWakeAt(g.s)).toBe(T0 + 4000 + GRACE);
    expect(g.err({ type: "HOST_ADVANCE" }, P("p2"))).toBe("NOT_HOST");
    g.advance(1000);
    g.do({ type: "HOST_ADVANCE" }, P("p1"));                  // the VIP phone
    expect(g.s.phase).toBe("WRITING");
    expect(g.s.deadline).toBe(g.now + 60_000);
  });
  it("HOST_ADVANCE is ignored in WRITING and VOTING (same object)", () => {
    const g = new G();
    g.tick();
    const before = g.s;
    const r = definition.reduce(before, { type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: TV }, g.ctx());
    expect(r.ok && r.state).toBe(before);
    g.allSubmit();
    expect(g.s.phase).toBe("VOTING");
    const b2 = g.s;
    const r2 = definition.reduce(b2, { type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: TV }, g.ctx());
    expect(r2.ok && r2.state).toBe(b2);
  });
  it("an early TICK returns the same object; reduce never mutates its input", () => {
    const g = new G();
    const before = g.s;
    const snap = JSON.stringify(before);
    const r = definition.reduce(before, { type: "TICK" }, g.ctx());
    expect(r.state).toBe(before);
    g.tick();
    expect(JSON.stringify(before)).toBe(snap);
  });
  it("pace scales WRITING and VOTING only (relaxed 90 s, fast 45 s)", () => {
    const relaxed = new G({ settings: { pace: "relaxed" } });
    relaxed.tick();
    expect(relaxed.s.deadline! - relaxed.now).toBe(90_000);
    const fast = new G({ settings: { pace: "fast" } });
    fast.tick();
    expect(fast.s.deadline! - fast.now).toBe(45_000);
  });
  it("WRITING ends when every connected player submitted; VOTING clamps; like grace after the last vote", () => {
    const g = new G({ players: 4 });
    g.tick();
    expect(g.pub().prompt?.lengthHint).toBe("few");       // "Ztruth sNN kumquat": 3 words
    g.allSubmit();
    expect(g.s.phase).toBe("VOTING");
    expect(g.s.options).toHaveLength(6);                   // 4 lies + 1 house (≤ 4 players) + truth
    expect(g.s.deadline).toBe(g.now + 35_000);
    for (const p of g.ids) {
      const target = g.s.options.find((o) => !o.authors.includes(p))!;
      g.vote(p, target.id);
    }
    expect(g.s.deadline).toBe(g.now + 3_000);
    g.tick();
    expect(g.s.phase).toBe("REVEAL");
    g.tick();
    expect(g.s.phase).toBe("SCORES");
    expect(g.s.deadline).toBe(g.now + 6_000);
    g.tick();
    expect(g.s.phase).toBe("WRITING");
    expect(g.s.promptIndex).toBe(1);
  });
  it("a full Normal game: 7 prompts, 3 round intros, AWARDS then RESULTS with an outcome", () => {
    const g = new G({ players: 5 });
    const intros: number[] = [];
    let guard = 0;
    while (g.s.phase !== "RESULTS" && guard++ < 300) {
      if (g.s.phase === "ROUND_INTRO") intros.push(g.s.promptIndex);
      if (g.s.phase === "WRITING") g.allSubmit();
      if (g.s.phase === "VOTING") {
        for (const p of g.ids) if (g.s.phase === "VOTING" && !g.s.spotOn[p] && g.s.votes[p] === undefined) g.vote(p, g.s.options.find((o) => !o.authors.includes(p))!.id);
      }
      if ((g.s.phase as string) !== "RESULTS" && g.s.deadline !== null) g.tick();
    }
    expect(g.s.phase).toBe("RESULTS");
    expect(intros).toEqual([0, 3, 6]);
    expect(definition.memory(g.s).usedKeys).toHaveLength(7);
    const out = definition.outcome(g.s)!;
    expect(Object.keys(out.points).sort()).toEqual(g.ids.sort());
    expect(definition.nextWakeAt(g.s)).toBeNull();
  });
  it("outcome is null before RESULTS; ranking is standard competition ranking without 0-point players", () => {
    const g = new G();
    expect(definition.outcome(g.s)).toBeNull();
    g.s = { ...g.s, phase: "RESULTS", deadline: null, prompt: null, players: g.s.players.map((p, i) => ({ ...p, score: [300, 300, 100, 0][i]! })) };
    expect(definition.outcome(g.s)!.ranking).toEqual([["p1", "p2"], ["p3"]]);
  });
});

describe("Spot on (round 1)", () => {
  it("first matching submission scores 150 at VOTING start, locks the entry, no option, no vote", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.submit("p1", g.truth().toLowerCase() + "!");
    expect(g.me("p1")).toMatchObject({ spotOn: true, myLieStatus: "spotOn", myLie: null });
    expect(g.pub().submittedIds).toContain("p1");
    expect(g.pub().spotOnIds).toEqual([]);                  // secret during WRITING
    expect(g.score("p1")).toBe(0);
    expect(g.err({ type: "SUBMIT_LIE", text: "Anything else", promptId: g.promptId() }, P("p1"))).toBe("WRONG_PHASE");
    expect(g.err({ type: "REQUEST_HELP", promptId: g.promptId() }, P("p1"))).toBe("WRONG_PHASE");
    g.allSubmit(["p1"]);
    expect(g.s.phase).toBe("VOTING");
    expect(g.pub().spotOnIds).toEqual(["p1"]);
    expect(g.score("p1")).toBe(150);
    expect(g.s.options.some((o) => o.authors.includes("p1"))).toBe(false);
    expect(g.err({ type: "VOTE", optionId: g.truthOption() }, P("p1"))).toBe("CANNOT_VOTE_SPOT_ON");
    g.do({ type: "LIKE", optionId: g.s.options[0]!.id, on: true }, P("p1"));   // may still like
    expect(definition.projectStatus(g.s).awaitedIds).not.toContain("p1");
  });
  it("first non-match, then a matching edit → too close (recorded, reported in me.tooCloseCount), truth vote pays 0", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.submit("p2", "Wrong guess here");
    const r = g.submit("p2", g.truth());
    // JAMAA-GAP: a failed reduce cannot keep a state change, so the probe is accepted and reported through `me`.
    expect(r.ok).toBe(true);
    expect(g.me("p2")!.tooCloseCount).toBe(1);
    expect(g.s.foundWhileWriting.p2).toBe(true);
    expect(g.me("p2")).toMatchObject({ foundWhileWriting: true, spotOn: false, myLie: "Wrong guess here" });
    expect(g.me("p3")!.foundWhileWriting).toBe(false);
    g.tick();
    g.vote("p2", g.truthOption());
    g.vote("p3", g.truthOption());
    g.tick();
    expect(g.score("p2")).toBe(0);
    expect(g.score("p3")).toBe(100);
  });
  it("everyone connected Spot on → straight to REVEAL (allKnew), no house lies; disconnected liars go unpicked", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.submit("p4", "A lie before leaving");
    g.dispatch({ type: "PLAYER_AWAY", playerId: "p4" });
    for (const p of ["p1", "p2", "p3"]) g.submit(p, g.truth());
    expect(g.s.phase).toBe("REVEAL");
    expect(g.pub().notice).toBe("allKnew");
    expect(g.s.options.some((o) => o.kind === "house")).toBe(false);
    expect(g.s.reveal!.unpicked.map((u) => u.authorIds)).toEqual([["p4"]]);
    expect(g.s.reveal!.spotOnDeltas.map((d) => d.playerId)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("anti-oracle limits", () => {
  it("4th too-close → TOO_MANY_EDITS; 6th submission → TOO_MANY_EDITS", () => {
    const g = new G({ players: 4 });
    g.toWriting("fact");
    for (let i = 0; i < 3; i++) {
      expect(g.submit("p1", g.truth()).ok).toBe(true);
      expect(g.me("p1")!.tooCloseCount).toBe(i + 1);
    }
    const r4 = g.submit("p1", g.truth());
    expect(!r4.ok && r4.error).toBe("TOO_MANY_EDITS");
    const g2 = new G({ players: 4 });
    g2.toWriting("fact");
    for (let i = 0; i < 5; i++) expect(g2.submit("p1", `Edit number ${"abcde"[i]}x`).ok).toBe(true);
    const r6 = g2.submit("p1", "Edit number six");
    expect(!r6.ok && r6.error).toBe("TOO_MANY_EDITS");
    expect(g2.me("p1")!.editsLeft).toBe(0);
  });
  it("round 2: ≥ 50 % first-submission too-close (min 2) swaps the prompt once, without using a skip", () => {
    const g = new G({ players: 4 });
    g.toWriting("fact");
    const id0 = g.promptId();
    const item0 = g.s.prompt!.itemId;
    expect(g.submit("p1", g.truth()).ok).toBe(true);
    expect(g.me("p1")!.tooCloseCount).toBe(1);
    expect(g.promptId()).toBe(id0);
    const r = g.submit("p2", g.truth());
    expect(r.ok).toBe(true);
    expect(g.promptId()).not.toBe(id0);
    expect(g.s.prompt!.itemId).not.toBe(item0);
    expect(g.pub().notice).toBe("tooFamous");
    expect(g.pub().skipsLeft).toBe(2);
    expect(g.me("p1")!.foundWhileWriting).toBe(false);       // flags discarded with the old prompt
    expect(definition.memory(g.s).usedKeys).toContain(item0);
    // At most once per slot.
    g.submit("p1", g.truth());
    const id1 = g.promptId();
    g.submit("p2", g.truth());
    expect(g.promptId()).toBe(id1);
    expect(g.me("p2")!.tooCloseCount).toBe(1);
  });
  it("round 1 never swaps; the final never rejects as too close", () => {
    const g = new G({ players: 4, settings: { length: "short" } });
    g.toWriting("noTruth");
    expect(g.submit("p1", "Anything goes").ok).toBe(true);
  });
});

describe("input validation", () => {
  it("empty, too long, < 2 letters, wrong script, blocked, stale prompt", () => {
    const g = new G();
    g.tick();
    const pidOk = g.promptId();
    const e = (text: string, promptId = pidOk) => g.err({ type: "SUBMIT_LIE", text, promptId }, P("p1"));
    expect(e("   ")).toBe("LIE_EMPTY");
    expect(e("...")).toBe("LIE_EMPTY");
    expect(e("1")).toBe("LIE_EMPTY");
    expect(e("x".repeat(61))).toBe("LIE_TOO_LONG");
    expect(e("غزال حلو")).toBe("LIE_WRONG_SCRIPT");
    expect(e("Total porno night")).toBe("LIE_BLOCKED_WORD");
    expect(e("Fine text", "deadbeef")).toBe("STALE_PROMPT");
    expect(g.me("p1")!.editsLeft).toBe(5);                    // rejected inputs do not use edits
    expect(g.err({ type: "SUBMIT_LIE", text: "ok text", promptId: pidOk }, P("ghost"))).toBe("NOT_IN_GAME");
    expect(g.err({ type: "VOTE", optionId: "x" }, P("p1"))).toBe("WRONG_PHASE");
    expect(g.err({ type: "SUBMIT_LIE", text: "tv text", promptId: pidOk }, TV)).toBe("WRONG_PHASE");
  });
  it("AR room: Latin-only lie rejected; Arabic accepted and shown with tashkeel stripped", () => {
    const ar = item("ar01", "proverb_end", 1, { truth: { ar: "غزال" }, truthAlt: { ar: [] }, houseLies: { ar: ["قمر", "وردة", "نجمة"] }, note: { ar: "معنى" } });
    const facts = [1, 2, 3, 4].map((i) => item(`arf${i}`, "fact_blank", i, { truth: { ar: `حقيقة رقم ${"ابتث"[i - 1]}` }, truthAlt: {}, houseLies: { ar: [`كذبة ${"جحخد"[i - 1]} اولى`, `كذبة ${"جحخد"[i - 1]} تانية`, `كذبة ${"جحخد"[i - 1]} تالتة`] }, note: {} }));
    const fin = item("arn1", "no_truth", 1, { houseLies: { ar: ["جواب اول", "جواب تاني", "جواب تالت"] }, note: {} });
    const cat = { packs: [pack("ar-pack", [ar, ...facts], { sourceLocale: "ar", playableIn: ["ar"] }), pack("ar-fin", [fin], { sourceLocale: "ar", playableIn: ["ar"] })] };
    const g = new G({ cat, locale: "ar", settings: { length: "short" } });
    g.tick();
    expect(g.err({ type: "SUBMIT_LIE", text: "ghazal", promptId: g.promptId() }, P("p1"))).toBe("LIE_WRONG_SCRIPT");
    expect(g.submit("p1", "بيعدّها كتير").ok).toBe(true);
    expect(g.me("p1")!.myLie).toBe("بيعدها كتير");
  });
});

describe("options build", () => {
  it("house-lie count for n = 3..12 and 0..n submissions; ≥ 2 options always", () => {
    for (let n = 3; n <= 12; n++) {
      for (let k = 0; k <= n; k++) {
        const g = new G({ players: n, seed: n * 100 + k });
        g.checkLeaks = false;
        g.toWriting("fact");
        for (let i = 0; i < k; i++) g.submit(g.ids[i]!, lieFor(g.ids[i]!, g.s));
        if (g.s.phase === "WRITING") g.tick();
        expect(g.s.phase).toBe("VOTING");
        const house = g.s.options.filter((o) => o.kind === "house").length;
        expect(house).toBe(Math.max(3 - k, n <= 4 ? 1 : 0));
        expect(g.s.options.length).toBe(k + house + 1);
        expect(g.s.options.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it("a lie identical to a house lie replaces it (the player keeps the credit)", () => {
    const g = new G({ players: 3 });
    g.toWriting("saying");
    const house = [...g.s.prompt!.houseLies];
    expect(house).toHaveLength(3);
    house.forEach((h, i) => g.submit(["p1", "p2", "p3"][i]!, h.toLowerCase()));
    expect(g.s.phase).toBe("VOTING");
    expect(g.s.options.filter((o) => o.kind === "house")).toHaveLength(0);   // all 3 house lies taken by players
    expect(g.s.options.filter((o) => o.kind === "lie")).toHaveLength(3);
  });
  it("nobody submits → house lies fill to 3", () => {
    const g = new G({ players: 6 });
    g.toWriting("fact");
    g.tick();
    expect(g.s.options.filter((o) => o.kind === "house")).toHaveLength(3);
  });
  it("shuffle is deterministic per seed and independent of submission order", () => {
    const run = (order: string[]) => {
      const g = new G({ players: 5, seed: 42 });
      g.toWriting("fact");
      const texts: Record<string, string> = { p1: "Alpha lie text", p2: "Bravo lie text", p3: "Charlie lie text", p4: "Delta lie text", p5: "Echo lie text" };
      for (const p of order) g.submit(p, texts[p]!);
      return g.pub().options;
    };
    const a = run(["p1", "p2", "p3", "p4", "p5"]);
    const b = run(["p5", "p3", "p1", "p4", "p2"]);
    expect(a).toEqual(b);
  });
});

describe("host powers", () => {
  it("SKIP_PROMPT: 2 per slot, stale id refused, non-host refused", () => {
    const g = new G();
    g.tick();
    expect(g.err({ type: "SKIP_PROMPT", promptId: g.promptId() }, P("p2"))).toBe("NOT_HOST");
    expect(g.err({ type: "SKIP_PROMPT", promptId: "00000000" }, TV)).toBe("STALE_PROMPT");
    g.submit("p2", "Will be discarded");
    const first = g.promptId();
    g.do({ type: "SKIP_PROMPT", promptId: first }, TV);
    expect(g.promptId()).not.toBe(first);
    expect(g.s.lies).toEqual({});
    expect(g.pub().skipsLeft).toBe(1);
    const r = g.submit("p2", "x").ok;                          // stale client re-render path
    expect(r).toBe(false);
    expect(g.err({ type: "SUBMIT_LIE", text: "Old prompt lie", promptId: first }, P("p2"))).toBe("STALE_PROMPT");
    g.do({ type: "SKIP_PROMPT", promptId: g.promptId() }, P("p1"));
    expect(g.err({ type: "SKIP_PROMPT", promptId: g.promptId() }, TV)).toBe("WRONG_PHASE");
  });
  it("HIDE_OPTION on a player lie: voters re-vote, deadline ≥ now + 10 s; limits → CANNOT_HIDE", () => {
    const g = new G({ players: 5 });
    g.toWriting("fact");
    g.allSubmit();
    const lie = g.s.options.find((o) => o.authors.includes("p1"))!.id;
    g.vote("p2", lie);
    for (const p of ["p1", "p3", "p4", "p5"]) g.vote(p, g.truthOption());
    expect(g.s.deadline).toBe(g.now + 3000);
    g.do({ type: "HIDE_OPTION", optionId: lie }, TV);
    expect(g.s.options.some((o) => o.id === lie)).toBe(false);
    expect(g.s.votes.p2).toBeUndefined();
    expect(g.s.deadline).toBe(g.now + 10_000);
    expect(g.pub().hidesLeft).toBe(2);
    const others = g.s.options.filter((o) => o.kind !== "truth");
    g.do({ type: "HIDE_OPTION", optionId: others[0]!.id }, TV);
    g.do({ type: "HIDE_OPTION", optionId: others[1]!.id }, TV);
    expect(g.err({ type: "HIDE_OPTION", optionId: g.s.options[0]!.id }, TV)).toBe("CANNOT_HIDE");
  });
  it("hide property: the reply does not depend on option kind", () => {
    // Refused: at 2 options left.
    const g = new G({ players: 3 });
    g.toWriting("fact");
    g.tick();                                                    // 3 house + truth = 4 options
    const house = g.s.options.filter((o) => o.kind === "house");
    g.do({ type: "HIDE_OPTION", optionId: house[0]!.id }, TV);
    g.do({ type: "HIDE_OPTION", optionId: house[1]!.id }, TV);
    expect(g.s.options).toHaveLength(2);
    const codes = g.s.options.map((o) => definition.reduce(g.s, { type: "INTENT", intent: { type: "HIDE_OPTION", optionId: o.id }, by: TV }, g.ctx()));
    expect(new Set(codes.map((r) => (r.ok ? "ok" : r.error)))).toEqual(new Set(["CANNOT_HIDE"]));
    // Allowed: every kind answers ok with the same pre-hide hidesLeft.
    const g2 = new G({ players: 4 });
    g2.toWriting("fact");
    g2.submit("p1", "Alpha player lie");
    g2.tick();
    const results = g2.s.options.map((o) => definition.reduce(g2.s, { type: "INTENT", intent: { type: "HIDE_OPTION", optionId: o.id }, by: TV }, g2.ctx()));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(g2.s.options.map((o) => o.kind))).toEqual(new Set(["lie", "house", "truth"]));
  });
});

describe("players coming and going", () => {
  it("HOLD under 3 connected at prompt start; PLAYER_BACK resumes; END_GAME → AWARDS", () => {
    const g = new G({ players: 3 });
    g.tick();
    g.allSubmit();
    g.dispatch({ type: "PLAYER_AWAY", playerId: "p3" });
    g.tick();                                                    // VOTING → REVEAL
    g.tick();                                                    // → SCORES
    g.tick();                                                    // → next slot: HOLD
    expect(g.s.phase).toBe("HOLD");
    expect(definition.nextWakeAt(g.s)).toBeNull();
    expect(g.err({ type: "HOST_ADVANCE" }, TV)).toBe("WRONG_PHASE");
    g.dispatch({ type: "PLAYER_BACK", playerId: "p3" });
    expect(g.s.phase).toBe("WRITING");
    g.dispatch({ type: "PLAYER_AWAY", playerId: "p3" });
    g.allSubmit();
    g.untilPhase("HOLD");
    g.do({ type: "END_GAME" }, P("p1"));
    expect(g.s.phase).toBe("AWARDS");
    g.tick();
    expect(g.s.phase).toBe("RESULTS");
  });
  it("late joiner waits (waitingForNext), cannot act, enters the next WRITING with 0 and a New ribbon", () => {
    const g = new G({ players: 3 });
    g.tick();
    const r = definition.join!(g.s, { id: "late", seat: 9, locale: "en", connected: true, carryScore: 0 });
    expect(r.ok).toBe(true);
    g.s = r.state;
    g.after();
    expect(g.me("late")!.waitingForNext).toBe(true);
    expect(g.err({ type: "SUBMIT_LIE", text: "I am new here", promptId: g.promptId() }, P("late"))).toBe("WRONG_PHASE");
    g.allSubmit();                                                // WRITING ends without waiting for "late"
    expect(g.s.phase).toBe("VOTING");
    expect(definition.projectStatus(g.s).awaitedIds).not.toContain("late");
    g.untilPhase("WRITING");
    expect(g.me("late")!.waitingForNext).toBe(false);
    expect(g.pub().newIds).toEqual(["late"]);
    expect(g.score("late")).toBe(0);
    expect(definition.join!(g.s, { id: "late", seat: 9, locale: "en", connected: true, carryScore: 0 }).ok).toBe(false);
  });
  it("a joiner during HOLD makes the room resumable on the next TICK", () => {
    const g = new G({ players: 3 });
    g.tick();
    g.allSubmit();
    g.dispatch({ type: "PLAYER_GONE", playerId: "p3", cause: "LEAVE" });
    g.untilPhase("HOLD");
    const r = definition.join!(g.s, { id: "newbie", seat: 5, locale: "en", connected: true, carryScore: 0 });
    g.s = r.state;
    expect(definition.nextWakeAt(g.s)).toBe(0);
    g.dispatch({ type: "TICK" });
    expect(g.s.phase).toBe("WRITING");
    expect(g.me("newbie")!.waitingForNext).toBe(false);
  });
  it("a player who leaves during VOTING keeps their option, which still scores; their own vote is dropped", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.allSubmit();
    const p4opt = g.s.options.find((o) => o.authors.includes("p4"))!.id;
    g.vote("p4", g.truthOption());
    g.dispatch({ type: "PLAYER_GONE", playerId: "p4", cause: "KICK" });
    expect(g.s.votes.p4).toBeUndefined();
    g.vote("p1", p4opt);
    g.tick();
    expect(g.score("p4")).toBe(60);
    g.untilPhase("RESULTS", 200);
    expect(definition.outcome(g.s)!.points.p4).toBe(0);
    expect(definition.outcome(g.s)!.ranking.flat()).not.toContain("p4");
  });
  it("disconnect in WRITING does not block the phase; disconnected players abstain in VOTING", () => {
    const g = new G({ players: 4 });
    g.tick();
    g.dispatch({ type: "PLAYER_AWAY", playerId: "p4" });
    g.allSubmit();
    expect(g.s.phase).toBe("VOTING");
    for (const p of ["p1", "p2", "p3"]) g.vote(p, g.s.options.find((o) => !o.authors.includes(p))!.id);
    expect(g.s.deadline).toBe(g.now + 3000);
  });
});

describe("content draw", () => {
  it("knownIn items are never drawn in that locale; rerun when the pool is exhausted", () => {
    const cat = synthCatalog({ sayings: 3, facts: 4, finals: 1 });
    cat.packs[0]!.items[0]!.knownIn = ["en"];
    const g = new G({ cat, settings: { length: "short" }, players: 3 });
    g.checkLeaks = false;
    const drawn: string[] = [];
    let guard = 0;
    while (g.s.phase !== "RESULTS" && guard++ < 200) {
      if (g.s.phase === "WRITING" && g.s.prompt && !drawn.includes(g.s.prompt.id)) drawn.push(g.s.prompt.itemId);
      g.tick();
    }
    expect(drawn).not.toContain("s01");
    // Second game with the first game's memory: everything used → reruns flagged.
    const g2 = new G({ cat, settings: { length: "short" }, players: 3, usedKeys: definition.memory(g.s).usedKeys });
    g2.checkLeaks = false;
    g2.tick();
    expect(g2.pub().prompt?.rerun).toBe(true);
  });
  it("short pool: round-1 slots borrow round-2 items and keep Spot-on rules", () => {
    const cat = synthCatalog({ sayings: 0, facts: 6, finals: 1 });
    const g = new G({ cat, settings: { length: "short" }, players: 3 });
    g.tick();
    expect(slotKind(g.s)).toBe("saying");
    expect(g.s.prompt!.type).toBe("fact_blank");
    expect(g.s.prompt!.crossRound).toBe(true);
    g.submit("p1", g.truth());
    expect(g.s.spotOn.p1).toBe(true);
  });
  it("round 2 prefers fact_blank and avoids two consecutive prompts of the same type when possible", () => {
    const cat = synthCatalog({ sayings: 4, facts: 8, finals: 1 });
    cat.packs.push(pack("syn-words", [1, 2, 3].map((i) => item(`w0${i}`, "word_meaning", i))));
    const g = new G({ cat, players: 3 });
    g.checkLeaks = false;
    const types = new Map<number, string>();
    let guard = 0;
    while (g.s.phase !== "AWARDS" && guard++ < 200) {
      if (g.s.phase === "WRITING" && slotKind(g.s) === "fact") types.set(g.s.promptIndex, g.s.prompt!.type);
      g.tick();
    }
    expect([...types.values()]).toEqual(["fact_blank", "fact_blank", "fact_blank"]);   // 8 facts ≥ 3 + 2: words stay out
    // A fact-poor pool lets word_meaning fill and alternates types.
    const cat2 = synthCatalog({ sayings: 4, facts: 2, finals: 1 });
    cat2.packs.push(pack("syn-words", [1, 2, 3].map((i) => item(`w0${i}`, "word_meaning", i))));
    const g2 = new G({ cat: cat2, players: 3 });
    g2.checkLeaks = false;
    const t2 = new Map<number, string>();
    guard = 0;
    while (g2.s.phase !== "AWARDS" && guard++ < 200) {
      if (g2.s.phase === "WRITING" && slotKind(g2.s) === "fact") t2.set(g2.s.promptIndex, g2.s.prompt!.type);
      g2.tick();
    }
    const seq = [...t2.values()];
    expect(seq).toHaveLength(3);
    expect(seq.some((t) => t === "word_meaning")).toBe(true);
    for (let i = 1; i < seq.length; i++) if (seq.filter((t) => t === "fact_blank").length > 0 && seq[i] === seq[i - 1]) expect(seq[i]).toBe("word_meaning");
  });
});

describe("awards", () => {
  it("Bluff of the Night, Lie Detector, Crowd Favourite, Hook Line and Sinker", () => {
    const g = new G({ players: 4, settings: { length: "short" } });
    let guard = 0;
    while (g.s.phase !== "AWARDS" && guard++ < 200) {
      if (g.s.phase === "WRITING" && slotKind(g.s) !== "noTruth") g.submit("p1", lieFor("p1", g.s));
      if (g.s.phase === "VOTING" && slotKind(g.s) !== "noTruth") {
        const lie = g.s.options.find((o) => o.authors.includes("p1"))!.id;
        g.vote("p2", lie);
        g.vote("p3", lie);
        g.vote("p4", g.truthOption());
        g.do({ type: "LIKE", optionId: lie, on: true }, P("p4"));
      }
      if ((g.s.phase as string) !== "AWARDS") g.tick();
    }
    const by = Object.fromEntries(g.s.awards.map((a) => [a.id, a]));
    expect(by.bluffOfTheNight!.playerIds).toEqual(["p1"]);
    expect(by.bluffOfTheNight!.value).toBe(2);
    expect(by.bluffOfTheNight!.promptIndex).toBe(3);             // tie → the later prompt
    expect(by.lieDetector!.playerIds).toEqual(["p4"]);
    expect(by.crowdFavourite!.playerIds).toEqual(["p1"]);
    expect(by.hookLineSinker!.playerIds).toEqual(["p2", "p3"]);
    expect(g.s.deadline).toBe(g.now + 2500 + 3500 * 4);
  });
});

describe("settings and setup", () => {
  const d = definition.settings;
  const cat = synthCatalog();
  it("apply validates keys and packs; normalize falls back per key; restrict keeps the same object", () => {
    const s0 = definition.meta.settings.defaults;
    expect(d.apply(s0, { length: "short" }, cat, "en")).toEqual({ packIds: [], length: "short", pace: "normal" });
    expect(d.apply(s0, { packIds: ["syn-facts"] }, cat, "en")!.packIds).toEqual(["syn-facts"]);
    expect(d.apply(s0, { packIds: ["nope"] }, cat, "en")).toBeNull();
    expect(d.apply(s0, { length: "huge" as never }, cat, "en")).toBeNull();
    expect(d.apply(s0, { extra: 1 } as never, cat, "en")).toBeNull();
    expect(d.normalize({ length: "long", pace: 3, junk: true })).toEqual({ packIds: [], length: "long", pace: "normal" });
    expect(d.normalize(null)).toEqual(s0);
    const s1 = { ...s0, packIds: ["syn-facts"] };
    expect(d.restrict(s1, { playableIds: new Set(["syn-facts"]), premium: false }, cat, "en")).toBe(s1);
    expect(d.restrict(s1, { playableIds: new Set(), premium: false }, cat, "en").packIds).toEqual([]);
    expect(d.packIds(s1)).toEqual(["syn-facts"]);
  });
  it("startBlocker and projectSetup", () => {
    const roster = (n: number, connected = true) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, seat: i, locale: "en" as const, connected, carryScore: 0 }));
    const s0 = definition.meta.settings.defaults;
    expect(definition.startBlocker(roster(2), s0, cat, "en")).toBe("NOT_ENOUGH_PLAYERS");
    expect(definition.startBlocker([...roster(2), { id: "x", seat: 5, locale: "en", connected: false, carryScore: 0 }], s0, cat, "en")).toBe("NOT_ENOUGH_PLAYERS");
    expect(definition.startBlocker(roster(3), s0, cat, "en")).toBeNull();
    expect(definition.startBlocker(roster(3), s0, cat, "fr")).toBe("NO_CONTENT_AVAILABLE");
    expect(definition.startBlocker(roster(3), s0, synthCatalog({ sayings: 3, facts: 2, finals: 1 }), "en")).toBe("NO_CONTENT_AVAILABLE");
    expect(definition.startBlocker(roster(3), s0, synthCatalog({ sayings: 6, facts: 6, finals: 0 }), "en")).toBe("NO_CONTENT_AVAILABLE");
    expect(definition.projectSetup(s0, roster(8), cat, { premium: false, packs: new Set() }, "en", { usedKeys: [] })).toEqual({ gameId: "bluff", available: 24, bigGroup: true });
    expect(definition.projectSetup(s0, roster(7), cat, { premium: false, packs: new Set() }, "en", { usedKeys: [] }).bigGroup).toBe(false);
    const r = definition.start({ roster: roster(2), settings: s0, locale: "en", memory: { usedKeys: [] }, seed: 1, now: T0, graceMs: GRACE, content: cat });
    expect(!r.ok && r.error).toBe("NOT_ENOUGH_PLAYERS");
  });
  it("meta follows JAMAA-PLATFORM §2.10", () => {
    const m = definition.meta;
    expect([m.minPlayers, m.maxPlayers, m.carriesScore]).toEqual([3, 12, false]);
    expect(m.settings.basic.map((f) => f.key)).toEqual(["packIds", "length", "pace"]);
    expect(m.settings.advanced).toEqual([]);
    expect(m.settings.premiumKeys).toEqual([]);
    expect(m.rules.world).toBe("hakawati-cafe");
    expect(m.rules.howToKeys).toHaveLength(4);
  });
});
