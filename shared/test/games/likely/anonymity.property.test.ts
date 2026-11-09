// JAMAA-PLATFORM §2.11 / GAME-LIKELY §8.1 anonymity differential property: for showVoters=false, two games with identical
// per-card tallies but a different voter→target mapping give byte-identical TV views (and envelope status), and
// byte-identical views for every phone whose own vote is the same in both games, in every phase including AWARDS and
// RESULTS. Decoy votes (changed before the end), skips, AWAY/BACK and a leaver are applied identically to both games.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isTarget } from "../../../src/games/likely/engine/reduce";
import type { LikelyIntent, LikelyState } from "../../../src/games/likely/engine/state";
import type { GameAction } from "../../../src/games/types";
import { findLikelyLeaks } from "../../../src/testing/bots/likely";
import { CATALOG, DEF, T0, ctx, ids, roster, settings } from "./helpers";

interface CardPlan { voters: boolean[]; targets: number[]; permKeys: number[]; decoysA: number[]; decoysB: number[]; skip: boolean; away: number; leave: boolean }
const N12 = { minLength: 12, maxLength: 12 };
const cardPlan = fc.record({
  voters: fc.array(fc.boolean(), N12),
  targets: fc.array(fc.nat(11), N12),
  permKeys: fc.array(fc.nat(1_000), N12),
  decoysA: fc.array(fc.integer({ min: -1, max: 11 }), N12),
  decoysB: fc.array(fc.integer({ min: -1, max: 11 }), N12),
  skip: fc.boolean(),
  away: fc.integer({ min: -1, max: 11 }),
  leave: fc.boolean(),
});

function views(s: LikelyState): { tv: string; status: string; me: Record<string, string> } {
  return {
    tv: JSON.stringify(DEF.projectPublic(s, CATALOG)),
    status: JSON.stringify(DEF.projectStatus(s)),
    me: Object.fromEntries(s.players.map((p) => [p.id, JSON.stringify(DEF.projectMe(s, p.id, CATALOG))])),
  };
}

function compare(a: LikelyState, b: LikelyState, where: string, stats: { same: number; differ: number }): void {
  const va = views(a);
  const vb = views(b);
  expect(va.tv, `${where}: TV view`).toBe(vb.tv);
  expect(va.status, `${where}: status`).toBe(vb.status);
  for (const id of Object.keys(va.me)) {
    const ma = DEF.projectMe(a, id, CATALOG);
    const mb = DEF.projectMe(b, id, CATALOG);
    if (ma?.myVote !== mb?.myVote) {
      stats.differ++;
      continue;
    }
    stats.same++;
    expect(va.me[id], `${where}: me of ${id}`).toBe(vb.me[id]);
  }
  expect(findLikelyLeaks(a, DEF)).toEqual([]);
  expect(findLikelyLeaks(b, DEF)).toEqual([]);
}

describe("anonymity differential property (§2.11)", () => {
  it("same tallies, different voter→target mapping → identical TV and same-vote phone views in every phase", { timeout: 300_000 }, () => {
    let differentMappings = 0;
    const stats = { same: 0, differ: 0 };
    fc.assert(fc.property(
      fc.integer({ min: 3, max: 12 }), fc.integer({ min: 0, max: 2 ** 31 }), fc.constantFrom<"family" | "spicy">("family", "spicy"),
      fc.constantFrom<"en" | "fr" | "ar" | "es">("en", "fr", "ar", "es"),
      fc.array(cardPlan, { minLength: 8, maxLength: 8 }),
      (n, seed, mode, locale, plans: CardPlan[]) => {
        const start = (): LikelyState => {
          const r = DEF.start({ roster: roster(n), settings: settings({ showVoters: false, mode, length: "short" }), locale, memory: { usedKeys: [] }, seed, now: T0, graceMs: 2_500, content: CATALOG });
          if (!r.ok) throw new Error(r.error);
          return r.state;
        };
        let A = start();
        let B = start();
        const red = (s: LikelyState, a: GameAction<LikelyIntent>, now: number): LikelyState => DEF.reduce(s, a, ctx(now)).state;
        const both = (f: (s: LikelyState) => LikelyState, where: string): void => {
          A = f(A);
          B = f(B);
          DEF.assertInvariants(A);
          DEF.assertInvariants(B);
          compare(A, B, where, stats);
        };
        compare(A, B, "start", stats);
        let k = 0;
        for (let guard = 0; A.phase !== "RESULTS"; guard++) {
          if (guard > 400) throw new Error("did not terminate");
          if (A.phase === "HOLD") {
            const away = A.players.find((p) => !p.connected && !p.left);
            both((s) => (away ? red(s, { type: "PLAYER_BACK", playerId: away.id }, T0) : red(s, { type: "INTENT", intent: { type: "END_GAME" }, by: { kind: "tv" } }, T0)), "hold");
            continue;
          }
          if (A.phase !== "CARD") {
            both((s) => red(s, { type: "TICK" }, s.deadline ?? T0), `tick ${A.phase}`);
            continue;
          }
          const plan = plans[k++ % plans.length] as CardPlan;
          if (plan.skip && k % 3 === 0) {
            both((s) => red(s, { type: "INTENT", intent: { type: "SKIP_CARD", cardId: (s.card as { cardId: string }).cardId }, by: { kind: "tv" } }, (s.deadline as number) - 1), "skip");
            continue;
          }
          both((s) => red(s, { type: "TICK" }, s.deadline as number), "open voting");
          const now = (A.deadline as number) - 17_000;
          const targets = A.players.filter((p) => isTarget(A, p.id)).map((p) => p.id);
          const voters = A.players.filter((p, i) => !p.left && !p.waiting && plan.voters[i]).map((p) => p.id);
          const final = voters.map((_, i) => targets[(plan.targets[i] as number) % targets.length] as string);
          // B: the same multiset of targets, dealt to the same voters in another order → identical tallies.
          const order = voters.map((_, i) => i).sort((x, y) => (plan.permKeys[x] as number) - (plan.permKeys[y] as number) || x - y);
          const finalB = order.map((i) => final[i] as string);
          if (finalB.some((t, i) => t !== final[i])) differentMappings++;
          const decoy = (d: number): string | null => (d < 0 ? null : (targets[d % targets.length] as string));
          voters.forEach((v, i) => {
            const by = { kind: "player" as const, playerId: v };
            const cardId = (A.card as { cardId: string }).cardId;
            const dA = decoy(plan.decoysA[i] as number);
            const dB = decoy(plan.decoysB[i] as number);
            if (dA) A = red(A, { type: "INTENT", intent: { type: "VOTE", cardId, targetId: dA }, by }, now + i);
            if (dB) B = red(B, { type: "INTENT", intent: { type: "VOTE", cardId, targetId: dB }, by }, now + i);
            A = red(A, { type: "INTENT", intent: { type: "VOTE", cardId, targetId: final[i] as string }, by }, now + i);
            B = red(B, { type: "INTENT", intent: { type: "VOTE", cardId, targetId: finalB[i] as string }, by }, now + i);
            DEF.assertInvariants(A);
            DEF.assertInvariants(B);
            compare(A, B, `vote ${v}`, stats);
          });
          // The same AWAY and the same leaver in both games (a leaver keeps the votes already cast on them).
          const awayId = plan.away >= 0 ? ids(n)[plan.away % n] : undefined;
          if (awayId) both((s) => red(s, { type: "PLAYER_AWAY", playerId: awayId }, now + 20), "away");
          if (plan.leave && k === 3 && n > 3) both((s) => red(s, { type: "PLAYER_GONE", playerId: ids(n)[n - 1] as string, cause: "LEAVE" }, now + 21), "leave");
          while ((A as LikelyState).phase === "VOTING") both((s) => red(s, { type: "TICK" }, s.deadline as number), "close voting");
          if (awayId) both((s) => red(s, { type: "PLAYER_BACK", playerId: awayId }, now + 22), "back");
        }
        expect(DEF.outcome(A)).toEqual(DEF.outcome(B));
        expect(JSON.stringify(DEF.memory(A))).toBe(JSON.stringify(DEF.memory(B)));
      },
    ), { numRuns: Number(process.env.FC_RUNS ?? 150) });
    expect(differentMappings).toBeGreaterThan(50);   // the property really exercised different mappings
    expect(stats.same).toBeGreaterThan(1_000);
  });

  it("control: in public mode a different mapping IS visible (the property above is sensitive)", () => {
    const play = (b: Record<string, string>): LikelyState => {
      const r = DEF.start({ roster: roster(3), settings: settings({ showVoters: true }), locale: "en", memory: { usedKeys: [] }, seed: 5, now: T0, graceMs: 0, content: CATALOG });
      if (!r.ok) throw new Error(r.error);
      let s = DEF.reduce(r.state, { type: "TICK" }, ctx(r.state.deadline as number)).state;
      for (const [v, t] of Object.entries(b)) s = DEF.reduce(s, { type: "INTENT", intent: { type: "VOTE", cardId: (s.card as { cardId: string }).cardId, targetId: t }, by: { kind: "player", playerId: v } }, ctx(T0 + 5_000)).state;
      return DEF.reduce(s, { type: "TICK" }, ctx(s.deadline as number)).state;
    };
    const a = play({ p1: "p2", p2: "p3", p3: "p3" });
    const b = play({ p1: "p3", p2: "p3", p3: "p2" });
    expect(DEF.projectPublic(a, CATALOG).reveal?.counts).toEqual(DEF.projectPublic(b, CATALOG).reveal?.counts);
    expect(JSON.stringify(DEF.projectPublic(a, CATALOG))).not.toBe(JSON.stringify(DEF.projectPublic(b, CATALOG)));
  });
});
