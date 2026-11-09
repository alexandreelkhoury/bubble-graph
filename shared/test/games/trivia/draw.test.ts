// GAME-TRIVIA §11.4 / §13.4: the question draw (freshness + LRU, effective difficulty, the curve, the final from
// difficulty 2, topic spread, tf ≤ 1 in 4, pool capping) and the per-question display shuffle.
import { describe, expect, it } from "vitest";
import { LENGTHS } from "../../../src/games/trivia/constants";
import { bandsFor, displayOrder, drawQuestions, effectiveDifficulty, memoryKey, shuffle, zones } from "../../../src/games/trivia/engine/draw";
import type { TriviaQuestion } from "../../../src/games/trivia/engine/types";
import { createRng } from "../../../src/room/rng";
import { synthPack } from "../../../src/testing/catalogs/trivia";

const pack = synthPack({ n: 60 });

describe("zones and bands", () => {
  it("first 30 % easy, last 30 % hard, the final from difficulty 2 (fallback 3, then 1)", () => {
    expect(zones(10)).toEqual({ length: 10, easyEnd: 3, hardStart: 7 });
    expect(zones(7)).toEqual({ length: 7, easyEnd: 2, hardStart: 5 });
    expect(zones(15)).toEqual({ length: 15, easyEnd: 5, hardStart: 10 });
    const z = zones(10);
    expect(bandsFor(0, z)).toEqual([1, 2, 3]);
    expect(bandsFor(4, z)).toEqual([2, 1, 3]);
    expect(bandsFor(8, z)).toEqual([3, 2, 1]);
    expect(bandsFor(9, z)).toEqual([2, 3, 1]);
  });
});

describe("drawQuestions", () => {
  for (const length of ["short", "normal", "long"] as const) {
    it(`${length}: the curve, the final, topic spread and the tf rule hold across 200 seeds`, () => {
      const L = LENGTHS[length];
      const z = zones(L);
      for (let seed = 1; seed <= 200; seed++) {
        const { questions, rerun } = drawQuestions(pack, length, [], "en", createRng(seed));
        expect(rerun).toBe(false);
        expect(questions).toHaveLength(L);
        expect(new Set(questions.map((q) => q.id)).size).toBe(L);
        questions.forEach((q, i) => {
          const d = effectiveDifficulty(q, "en");
          if (i === L - 1) expect(d, `final seed ${seed}`).toBe(2);
          else if (i < z.easyEnd) expect(d).toBe(1);
          else if (i >= z.hardStart) expect(d).toBe(3);
          else expect(d).toBe(2);
        });
        for (let i = 2; i < L; i++) {
          const t = [questions[i - 2]!.topic, questions[i - 1]!.topic, questions[i]!.topic];
          expect(t[0] === t[1] && t[1] === t[2], `3 × ${t[0]} at ${i} seed ${seed}`).toBe(false);
        }
        for (let i = 0; i + 4 <= L; i++) expect(questions.slice(i, i + 4).filter((q) => q.type === "tf").length).toBeLessThanOrEqual(1);
      }
    });
  }

  it("is deterministic per seed and varies across seeds", () => {
    const a = drawQuestions(pack, "normal", [], "en", createRng(7)).questions.map((q) => q.id);
    expect(drawQuestions(pack, "normal", [], "en", createRng(7)).questions.map((q) => q.id)).toEqual(a);
    const seen = new Set<string>();
    for (let s = 1; s <= 20; s++) seen.add(drawQuestions(pack, "normal", [], "en", createRng(s)).questions.map((q) => q.id).join());
    expect(seen.size).toBeGreaterThan(15);
  });

  it("easyIn lowers the effective difficulty and keeps the question out of the last 30 %", () => {
    // Every question of difficulty 3 is trivial in ar; ar rooms then lack hard questions and fall back to 2.
    const p = synthPack({ locale: "ar", n: 60, easyIn: (i) => (i % 8 === 3 || i % 8 === 6 ? ["ar"] : []) });
    for (let seed = 1; seed <= 100; seed++) {
      const qs = drawQuestions(p, "normal", [], "ar", createRng(seed)).questions;
      const z = zones(qs.length);
      qs.forEach((q, i) => {
        if (i >= z.hardStart) expect(q.easyIn).not.toContain("ar");
        if (q.easyIn.includes("ar")) expect(effectiveDifficulty(q, "ar")).toBe(1);
      });
    }
    const q = p.questions[3] as TriviaQuestion;
    expect(q.difficulty).toBe(3);
    expect(effectiveDifficulty(q, "ar")).toBe(1);
    expect(effectiveDifficulty(q, "en")).toBe(3);
  });

  it("prefers questions not in memory.usedKeys; when exhausted, the least recently used first, and flags a rerun", () => {
    const fam = "syn-quiz";
    const all = pack.questions.map((q) => memoryKey(fam, q.id));
    // 55 of 60 used: the 5 fresh ones are all drawn; the rest come from the OLDEST used keys.
    const used = all.slice(0, 55);
    const { questions, rerun } = drawQuestions(pack, "normal", used, "en", createRng(3));
    expect(rerun).toBe(true);
    const ids = questions.map((q) => q.id);
    for (const q of pack.questions.slice(55)) expect(ids).toContain(q.id);
    const staleIdx = ids.filter((id) => used.includes(memoryKey(fam, id))).map((id) => used.indexOf(memoryKey(fam, id)));
    // All reused ones are among the oldest used keys that fit the slots (well before the newest).
    expect(Math.max(...staleIdx)).toBeLessThan(40);
    // Keys of another quiz family never count as used.
    expect(drawQuestions(pack, "normal", pack.questions.map((q) => memoryKey("other", q.id)), "en", createRng(3)).rerun).toBe(false);
  });

  it("caps the length to the pool; a tiny pool still draws every question once", () => {
    const small = synthPack({ n: 4 });
    const r = drawQuestions(small, "long", [], "en", createRng(1));
    expect(r.questions).toHaveLength(4);
    expect(new Set(r.questions.map((q) => q.id)).size).toBe(4);
    const single = synthPack({ n: 1 });
    expect(drawQuestions(single, "short", [], "en", createRng(1)).questions).toHaveLength(1);
  });

  it("relaxes the soft rules rather than failing (all-tf, one-topic pool)", () => {
    const p = synthPack({ n: 12, tfEvery: 1, topics: ["food"] });
    const qs = drawQuestions(p, "normal", [], "en", createRng(5)).questions;
    expect(qs).toHaveLength(10);
  });
});

describe("display order (§11.4 rule 5)", () => {
  it("mc4 options are shuffled per question with the RNG; the right answer lands in every position", () => {
    const q = pack.questions[0] as TriviaQuestion;
    const hits = [0, 0, 0, 0];
    const rng = createRng(11);
    for (let i = 0; i < 400; i++) {
      const order = displayOrder(q, rng);
      expect([...order].sort()).toEqual([0, 1, 2, 3]);
      hits[order.indexOf(q.answer)]! += 1;
    }
    for (const h of hits) expect(h).toBeGreaterThan(60);
  });
  it("tf keeps [True, False] (never mirrored, §8.4)", () => {
    const tf = pack.questions.find((q) => q.type === "tf") as TriviaQuestion;
    expect(displayOrder(tf, createRng(1))).toEqual([0, 1]);
  });
  it("shuffle is a permutation", () => {
    expect(shuffle([1, 2, 3, 4, 5], createRng(9)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
