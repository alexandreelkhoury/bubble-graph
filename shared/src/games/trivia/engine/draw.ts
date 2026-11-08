// GAME-TRIVIA §11.4 question draw: freshness (memory.usedKeys, LRU fallback), effective difficulty (easyIn), the
// difficulty curve, the final from difficulty 2, topic spread, tf ≤ 1 in 4, and the per-question display shuffle.
import { EASY_SHARE, HARD_SHARE, LENGTHS, type LengthId } from "../constants";
import { familyOf } from "./quiz";
import type { TriviaPack, TriviaQuestion } from "./types";
import type { Locale } from "../../../constants";
import type { Rng } from "../../../room/rng";

/** Memory keys are `<family>:<questionId>`: question ids (`q001`) repeat across quizzes (open issue: platform says ids only). */
export const memoryKey = (family: string, qid: string): string => `${family}:${qid}`;

export const effectiveDifficulty = (q: TriviaQuestion, locale: Locale): 1 | 2 | 3 => (q.easyIn.includes(locale) ? 1 : q.difficulty);

export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export interface Zones { length: number; easyEnd: number; hardStart: number }
/** Slots [0, easyEnd) easy, [easyEnd, hardStart) medium, [hardStart, length) hard; the last slot is the final. */
export function zones(length: number): Zones {
  const n1 = Math.round(length * EASY_SHARE);
  const n3 = Math.round(length * HARD_SHARE);
  return { length, easyEnd: n1, hardStart: Math.max(n1, length - n3) };
}

/** Preferred difficulty bands per slot, best first (§11.4 rules 3). */
export function bandsFor(slot: number, z: Zones): readonly (1 | 2 | 3)[] {
  if (slot === z.length - 1) return [2, 3, 1];      // the final: the most-answered band
  if (slot < z.easyEnd) return [1, 2, 3];
  if (slot >= z.hardStart) return [3, 2, 1];
  return [2, 1, 3];
}

export interface DrawResult { questions: TriviaQuestion[]; rerun: boolean }

/**
 * Picks min(LENGTHS[length], pool) questions. Priority: freshness (unused before used; used in LRU order: oldest
 * usedKeys first), then the soft rules (relaxed only when nothing fits), then the slot's difficulty band order.
 * Relax levels: 0 all rules; 1 drops topic spread; 2 drops tf ≤ 1 in 4; 3 (last resort, any tier) drops
 * "easyIn never in the last 30 %".
 */
export function drawQuestions(pack: TriviaPack, length: LengthId, usedKeys: readonly string[], locale: Locale, rng: Rng): DrawResult {
  const family = familyOf(pack);
  const pool = pack.questions;
  const L = Math.min(LENGTHS[length], pool.length);
  const z = zones(L);
  const usedAt = new Map<string, number>();
  usedKeys.forEach((k, i) => usedAt.set(k, i));
  const fresh = shuffle(pool.filter((q) => !usedAt.has(memoryKey(family, q.id))), rng);
  const stale = pool.filter((q) => usedAt.has(memoryKey(family, q.id)))
    .sort((a, b) => (usedAt.get(memoryKey(family, a.id)) as number) - (usedAt.get(memoryKey(family, b.id)) as number));
  const tiers = [fresh, stale];

  const slots: (TriviaQuestion | undefined)[] = new Array<TriviaQuestion | undefined>(L).fill(undefined);
  const taken = new Set<string>();

  const fits = (q: TriviaQuestion, slot: number, level: number): boolean => {
    if (level < 3 && slot >= z.hardStart && q.easyIn.includes(locale)) return false;
    if (level < 1) {
      // never 3 consecutive on the same topic: every window of 3 containing `slot`
      for (let s = slot - 2; s <= slot; s++) {
        if (s < 0 || s + 2 >= L) continue;
        const w = [0, 1, 2].map((d) => (s + d === slot ? q : slots[s + d]));
        if (w.every((x) => x !== undefined && x.topic === q.topic)) return false;
      }
    }
    if (level < 2 && q.type === "tf") {
      // at most 1 tf in any 4 consecutive questions
      for (let s = slot - 3; s <= slot + 3; s++) {
        if (s === slot || s < 0 || s >= L) continue;
        if (slots[s]?.type === "tf") return false;
      }
    }
    return true;
  };

  const pick = (slot: number): void => {
    const tryPick = (tier: readonly TriviaQuestion[], level: number): boolean => {
      for (const band of bandsFor(slot, z)) {
        const q = tier.find((c) => !taken.has(c.id) && effectiveDifficulty(c, locale) === band && fits(c, slot, level));
        if (q) { slots[slot] = q; taken.add(q.id); return true; }
      }
      return false;
    };
    for (const tier of tiers) for (let level = 0; level <= 2; level++) if (tryPick(tier, level)) return;
    for (const tier of tiers) if (tryPick(tier, 3)) return;
    throw new Error("draw: pool exhausted"); // unreachable: L ≤ pool size
  };

  if (L > 0) pick(L - 1);                    // the final first, so a difficulty-2 question is reserved for it
  for (let i = 0; i < L - 1; i++) pick(i);
  const questions = slots as TriviaQuestion[];
  return { questions, rerun: questions.some((q) => usedAt.has(memoryKey(family, q.id))) };
}

/** Display order for one question: order[displayPos] = authored index. mc4 is shuffled; tf stays [True, False] (§8.4). */
export function displayOrder(q: TriviaQuestion, rng: Rng): number[] {
  const idx = q.options.map((_, i) => i);
  return q.type === "mc4" ? shuffle(idx, rng) : idx;
}
