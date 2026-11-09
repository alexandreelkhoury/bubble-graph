// The published Trivia fixtures (shared/fixtures/v2/games/trivia/) are up to date with the scenario, parse with the v2
// protocol schemas, and leak nothing: no answer before REVEAL in any TV frame or in another phone's frame.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ClientMessageV2Schema, ServerMessageV2Schema } from "../../../src/protocol/v2/messages";
import type { TriviaMe, TriviaPublic } from "../../../src/games/trivia/engine/view";
import { generateTriviaFixtures, TRIVIA_FIXTURE_DIR } from "./fixtures-gen";

const generated = generateTriviaFixtures();
const onDisk = readdirSync(TRIVIA_FIXTURE_DIR).filter((f) => f.endsWith(".json")).sort();
const read = (f: string): Record<string, unknown> => JSON.parse(readFileSync(join(TRIVIA_FIXTURE_DIR, f), "utf8")) as Record<string, unknown>;
type Env = { phase: string; doneIds: string[]; public: TriviaPublic; me: TriviaMe | null };

describe("trivia fixtures", () => {
  it("are exactly the generated set (run `tsx test/games/trivia/fixtures-gen.ts` after a change)", () => {
    expect(onDisk).toEqual([...generated.keys()].sort());
    for (const [name, content] of generated) expect(readFileSync(join(TRIVIA_FIXTURE_DIR, name), "utf8"), name).toBe(content);
  });

  it.each(onDisk.filter((f) => f.startsWith("c2s.")))("%s is a valid client frame", (f) => {
    expect(ClientMessageV2Schema.safeParse(read(f)).success).toBe(true);
  });

  it.each(onDisk.filter((f) => f.startsWith("s2c.")))("%s is a valid server frame", (f) => {
    const r = ServerMessageV2Schema.safeParse(read(f));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });

  it("cover every phase, both question types' pads, every reveal highlight, the waiting joiner and RTL", () => {
    const envs = onDisk.filter((f) => f.startsWith("s2c.state.") && f.includes("playing")).map((f) => (read(f).view as { game: Env }).game);
    expect(new Set(envs.map((e) => e.phase))).toEqual(new Set(["QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"]));
    const reveals = envs.map((e) => e.public.reveal).filter((r) => r !== null);
    for (const k of ["stumped", "genius", "tooSlow", "voided"] as const) expect(reveals.some((r) => r[k]), k).toBe(true);
    expect(reveals.some((r) => r.onFireIds.length > 0)).toBe(true);
    expect(reveals.some((r) => r.explain !== null)).toBe(true);
    expect(envs.some((e) => e.me?.waitingForNext === true)).toBe(true);
    expect(envs.some((e) => e.public.newIds.length > 0)).toBe(true);
    expect(envs.some((e) => e.public.isFinal && e.phase === "REVEAL")).toBe(true);
    expect(envs.some((e) => /[؀-ۿ]/.test(e.public.question?.text ?? ""))).toBe(true);
  });

  it("no frame before REVEAL carries the answer or someone else's pick", () => {
    for (const f of onDisk.filter((x) => x.startsWith("s2c.state.") && x.includes("playing"))) {
      const view = read(f).view as { kind: string; me: { id: string } | null; game: Env };
      const g = view.game;
      if (g.phase !== "REVEAL") expect(g.public.reveal, f).toBeNull();
      if (g.phase === "READ") expect(g.public.options, f).toEqual([]);
      if (view.kind === "tv") expect(g.me, f).toBeNull();
      if (g.phase === "ANSWER") {
        // `scores[i].correct` is a count of past answers, not this question's answer.
        const text = JSON.stringify({ ...g.public, scores: g.public.scores.map(({ correct: _c, ...r }) => r) });
        expect(text).not.toMatch(/"(correct|choice|choices|correctIndex|answer)"/);
        if (g.me?.myChoice !== null && g.me) expect(g.doneIds).toContain(view.me!.id);
      }
    }
  });
});
