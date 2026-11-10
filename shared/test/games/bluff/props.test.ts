// Property tests (fast-check): random games terminate, invariants and score rules hold after every reduce, no view
// leaks (checked by G after every step), option order is independent of submission order and ids, and the final's
// ballots are anonymous (differential test, as Likely's §2.11 property).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { definition } from "../../../src/games/bluff/definition";
import { slotKind } from "../../../src/games/bluff/engine/reduce";
import type { BluffIntent } from "../../../src/games/bluff/engine/state";
import { G, P, TV, lieFor, pid } from "./harness";

/** BLUFF_PROPS_RUNS raises the run count (acceptance runs use 500+). */
const RUNS = Number(process.env.BLUFF_PROPS_RUNS ?? 40);
const SLOW = { timeout: 600_000 };

type Cmd = { k: number; a: number; b: number; dt: number };
const cmdArb = fc.record({ k: fc.integer({ min: 0, max: 15 }), a: fc.nat(1000), b: fc.nat(1000), dt: fc.integer({ min: 0, max: 20_000 }) });

function textFor(g: G, p: string, b: number): string {
  const pr = g.s.prompt;
  switch (b % 7) {
    case 0: return pr?.truthText ?? "No truth here";               // Spot on / too close probes
    case 1: { const h = g.s.help[p]; return typeof h === "string" ? h : lieFor(p, g.s, "h"); }
    case 2: { const other = Object.values(g.s.lies)[0]; return other ? other.text.toLowerCase() + "!" : lieFor(p, g.s); } // duplicates merge
    case 3: return pr ? pr.houseLies[b % Math.max(1, pr.houseLies.length)] ?? "House echo" : "House echo";
    case 4: return "!!";                                            // invalid
    default: return lieFor(p, g.s, String(b % 3));
  }
}

function apply(g: G, c: Cmd, joined: { n: number }): void {
  const ids = g.ids;
  const p = ids[c.a % ids.length] as string;
  const optId = g.s.options.length ? (g.s.options[c.b % g.s.options.length] as { id: string }).id : "00000000";
  const promptId = g.s.prompt?.id ?? "00000000";
  const host = c.b % 2 === 0 ? TV : P(p);
  g.advance(c.dt % 4000);
  const intent = (i: BluffIntent, by = P(p)) => g.dispatch({ type: "INTENT", intent: i, by });
  switch (c.k) {
    case 0: case 1: case 2: intent({ type: "SUBMIT_LIE", text: textFor(g, p, c.b), promptId }); break;
    case 3: intent({ type: "REQUEST_HELP", promptId }); break;
    case 4: case 5: intent({ type: "VOTE", optionId: optId }); break;
    case 6: intent({ type: "LIKE", optionId: optId, on: c.b % 3 !== 0 }); break;
    case 7: intent({ type: "SKIP_PROMPT", promptId }, host); break;
    case 8: intent({ type: "HIDE_OPTION", optionId: optId }, host); break;
    case 9: intent({ type: "HOST_ADVANCE" }, host); break;
    case 10: g.dispatch({ type: "PLAYER_AWAY", playerId: p }); break;
    case 11: g.dispatch({ type: "PLAYER_BACK", playerId: p }); break;
    case 12: if (c.b % 5 === 0) g.dispatch({ type: "PLAYER_GONE", playerId: p, cause: c.b % 2 ? "LEAVE" : "KICK" }); break;
    case 13: {
      if (joined.n < 2 && c.b % 3 === 0) {
        const r = definition.join!(g.s, { id: `j${joined.n}`, seat: 20 + joined.n, locale: "en", connected: true, carryScore: 0 });
        joined.n++;
        g.s = r.state;
        g.after();
      }
      break;
    }
    case 14: intent({ type: "END_GAME" }, host); break;
    default: if (g.s.deadline !== null) g.tick();
  }
}

/** Drives any state to RESULTS: ticks, brings players back from HOLD, or ends the game. */
function finish(g: G): number {
  let steps = 0;
  while (g.s.phase !== "RESULTS") {
    if (++steps > 400) throw new Error(`did not terminate (phase ${g.s.phase})`);
    if (g.s.phase === "HOLD") {
      const away = g.s.players.find((q) => !q.connected && !q.left);
      if (away) g.dispatch({ type: "PLAYER_BACK", playerId: away.id });
      else g.do({ type: "END_GAME" }, TV);
      continue;
    }
    if (g.s.deadline !== null) g.tick();
  }
  return steps;
}

describe("random games", () => {
  it("terminate; invariants, monotone scores and leak oracles hold after every step", SLOW, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 12 }), fc.nat(), fc.constantFrom("short", "normal", "long"), fc.constantFrom("relaxed", "normal", "fast"),
        fc.array(cmdArb, { maxLength: 160 }),
        (n, seed, length, pace, cmds) => {
          const g = new G({ players: n, seed, settings: { length, pace } });
          const joined = { n: 0 };
          for (const c of cmds) {
            if (g.s.phase === "RESULTS") break;
            apply(g, c, joined);
          }
          finish(g);
          const out = definition.outcome(g.s)!;
          for (const q of g.s.players) expect(out.points[q.id]).toBe(q.left ? 0 : q.score);
          // ranking: groups strictly decreasing, no 0-point or left players
          let prev = Infinity;
          for (const grp of out.ranking) {
            const sc = out.points[grp[0]!]!;
            expect(sc).toBeGreaterThan(0);
            expect(sc).toBeLessThan(prev);
            for (const id of grp) expect(out.points[id]).toBe(sc);
            prev = sc;
          }
          expect(definition.memory(g.s).usedKeys.length).toBeLessThanOrEqual(300);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("bots that always act: every game ends in RESULTS within a bounded number of steps", SLOW, () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 12 }), fc.nat(), (n, seed) => {
        const g = new G({ players: n, seed });
        let steps = 0;
        while (g.s.phase !== "RESULTS") {
          if (++steps > 600) throw new Error("no termination");
          if (g.s.phase === "WRITING") for (const q of g.s.players) if (g.s.phase === "WRITING" && !g.s.lies[q.id] && !g.s.spotOn[q.id]) g.submit(q.id, lieFor(q.id, g.s));
          if (g.s.phase === "VOTING") {
            for (const q of g.s.players) {
              const opts = g.s.options.filter((o) => !o.authors.includes(q.id));
              if (g.s.phase === "VOTING" && !g.s.spotOn[q.id] && opts.length) g.vote(q.id, opts[(seed + q.seat) % opts.length]!.id);
            }
          }
          if ((g.s.phase as string) !== "RESULTS" && g.s.deadline !== null) g.tick();
        }
        expect(steps).toBeLessThan(200);
      }),
      { numRuns: Math.ceil(RUNS / 2) },
    );
  });
});

describe("options independent of submission order and player ids", () => {
  it("same seed + same texts → same option ids and order, whatever the order and the ids", SLOW, () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 8 }), fc.nat(), fc.nat(), (n, seed, perm) => {
        const texts = Array.from({ length: n }, (_, i) => `Lie number ${"abcdefgh"[i]}${"qrstuvwx"[i]}z`);
        const run = (ids: string[], order: number[]) => {
          const g = new G({ ids, seed });
          g.checkLeaks = false;
          for (let i = 0; i < 80 && !(g.s.phase === "WRITING" && slotKind(g.s) === "fact"); i++) g.tick();
          for (const i of order) g.submit(ids[i]!, texts[i]!);
          return g.pub().options;
        };
        const order = Array.from({ length: n }, (_, i) => i);
        const shuffled = [...order].sort((a, b) => ((a * 7919 + perm) % 97) - ((b * 7919 + perm) % 97));
        const a = run(order.map((i) => pid(i + 1)), order);
        const b = run(order.map((i) => `other-${i}`), shuffled);
        expect(b).toEqual(a);
      }),
      { numRuns: Math.ceil(RUNS / 3) },
    );
  });
});

describe("final ballots are anonymous (differential)", () => {
  it("identical per-answer counts, different ballots → byte-identical views for the TV and every phone whose own vote is the same", SLOW, () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 9 }), fc.nat(), fc.array(fc.nat(100), { minLength: 9, maxLength: 9 }), (n, seed, picks) => {
        const ids = Array.from({ length: n }, (_, i) => pid(i + 1));
        const mk = () => {
          const g = new G({ ids, seed, settings: { length: "short" } });
          for (let i = 0; i < 80 && !(g.s.phase === "WRITING" && slotKind(g.s) === "noTruth"); i++) g.tick();
          for (const p of ids) g.submit(p, lieFor(p, g.s, "final"));
          if (g.s.phase === "WRITING") g.tick();
          return g;
        };
        const g1 = mk();
        const g2 = mk();
        expect(g1.s.phase).toBe("VOTING");
        const authorOf = (oid: string) => g1.s.options.find((o) => o.id === oid)!.authors;
        // ballots 1: each player picks a non-own answer
        const b1: Record<string, string> = {};
        ids.forEach((p, i) => {
          const opts = g1.s.options.filter((o) => !o.authors.includes(p));
          b1[p] = opts[picks[i]! % opts.length]!.id;
        });
        // ballots 2: swap two voters' choices when legal (counts preserved)
        const b2 = { ...b1 };
        let swapped: [string, string] | null = null;
        outer: for (const x of ids) for (const y of ids) {
          if (x < y && b1[x] !== b1[y] && !authorOf(b1[y]!).includes(x) && !authorOf(b1[x]!).includes(y)) {
            b2[x] = b1[y]!;
            b2[y] = b1[x]!;
            swapped = [x, y];
            break outer;
          }
        }
        fc.pre(swapped !== null);
        for (const p of ids) g1.vote(p, b1[p]!);
        for (const p of [...ids].reverse()) g2.vote(p, b2[p]!);
        const same = ids.filter((p) => !swapped!.includes(p));
        const status = (g: typeof g1) => JSON.stringify(definition.projectStatus(g.s));
        expect(JSON.stringify(g2.pub())).toBe(JSON.stringify(g1.pub()));
        expect(status(g2)).toBe(status(g1));
        // The VIP hides a VOTED answer (x's pick in g1, y's in g2): the public view and the envelope status must not
        // change differently, i.e. nobody learns who had picked the hidden card (review blocker).
        if (picks[0]! % 2 === 0) {
          const hidden = b1[swapped![0]]!;
          g1.do({ type: "HIDE_OPTION", optionId: hidden }, TV);
          g2.do({ type: "HIDE_OPTION", optionId: hidden }, TV);
          expect(g1.s.phase).toBe("VOTING");
        }
        let guard = 0;
        do {
          expect(JSON.stringify(g2.pub())).toBe(JSON.stringify(g1.pub()));
          expect(status(g2)).toBe(status(g1));
          if (g1.s.phase !== "VOTING") for (const p of same) expect(JSON.stringify(g2.me(p))).toBe(JSON.stringify(g1.me(p)));
          if (g1.s.phase === "RESULTS") break;
          g1.tick();
          g2.tick();
        } while (guard++ < 10);
        expect(g1.s.phase).toBe("RESULTS");
      }),
      { numRuns: Math.ceil(RUNS / 2) },
    );
  });
});
