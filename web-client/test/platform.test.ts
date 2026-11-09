// JAMAA-PLATFORM §6.4 lane B unit tests: hub carousel geometry, the TV input rule (§3.10 E), transitions, the
// choreography sampler and runner (§3.8), characters and reactions (§3.7), the cup stars (§2.4), the settings rows
// (§3.5), the Pass store maths (§4.5), the room socket URL, and the phone import guard (§2.1).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { REACTIONS } from "@jamaa/shared/room";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { RoomPublic, RoomSetup } from "@jamaa/shared/protocol/v2";
import { carouselPos, readingDir } from "../src/tv-mock/tvHub";
import { keyVerdict, transitionFor } from "../src/tv-mock/tvPlatform";
import { CHOREO, PORTAL_REPEAT_SCALE, endMs, run, sample, scaled, variant } from "@jamaa/shared/motion";
import { EXPRESSIONS, EXPRESSION_FEATURES, REACTION_BURST, REACTION_EXPRESSION } from "@jamaa/shared/characters";
import { expressionOf } from "../src/components/Character";
import { cupStandings, starsOfLast } from "../src/platform/Cup";
import { basicRows } from "../src/lib/gameSettings";
import { packsByGame, yearlySavingPercent } from "../src/tv-mock/billing/model";
import { partyUrl } from "../src/net/connection";
import { archPath, lerpBox } from "../src/tv-mock/tvTransitions";

describe("HUB-02 carousel (§3.2)", () => {
  it("places the focused poster at 0, its predecessor just off the start edge, and wraps", () => {
    expect([0, 1, 2, 3].map((i) => carouselPos(i, 0, 4))).toEqual([0, 1, 2, -1]);
    expect([0, 1, 2, 3].map((i) => carouselPos(i, 2, 4))).toEqual([2, -1, 0, 1]);
    expect(carouselPos(0, 0, 1)).toBe(0);
  });
  it("mirrors Left/Right in RTL", () => {
    expect(readingDir("ArrowRight", false)).toBe(1);
    expect(readingDir("ArrowRight", true)).toBe(-1);
    expect(readingDir("ArrowLeft", true)).toBe(1);
    expect(readingDir("ArrowUp", false)).toBe(0);
  });
});

describe("§3.10 E TV input rule", () => {
  const k = (key: string, repeat = false) => ({ key, repeat });
  it("while a choreography runs, OK completes it and the D-pad is swallowed", () => {
    expect(keyVerdict(k("Enter"), true, false)).toBe("complete");
    expect(keyVerdict(k("ArrowLeft"), true, false)).toBe("swallow");
    expect(keyVerdict(k("Enter", true), true, false)).toBe("swallow");
  });
  it("the guard after a transition swallows OK and the D-pad, not Back", () => {
    expect(keyVerdict(k("Enter"), false, true)).toBe("swallow");
    expect(keyVerdict(k("ArrowDown"), false, true)).toBe("swallow");
    expect(keyVerdict(k("Escape"), false, true)).toBe("pass");
  });
  it("key-repeat never activates a button but may move focus", () => {
    expect(keyVerdict(k("Enter", true), false, false)).toBe("swallow");
    expect(keyVerdict(k("ArrowRight", true), false, false)).toBe("pass");
    expect(keyVerdict(k("Enter"), false, false)).toBe("pass");
  });
  it("picks the transition for each phase change", () => {
    expect(transitionFor("HUB", "SETUP")).toBe("portal");
    expect(transitionFor("SETUP", "HUB")).toBe("back");
    expect(transitionFor("SETUP", "PLAYING")).toBe("entrance");
    expect(transitionFor("PLAYING", "SETUP")).toBe("guard");
    expect(transitionFor("PLAYING", "HUB")).toBe("guard");
    expect(transitionFor(null, "HUB")).toBeNull();
    expect(transitionFor("HUB", "HUB")).toBeNull();
  });
});

describe("§3.8 shared choreography (@jamaa/shared/motion) + §3.10 A/B timings", () => {
  const PORTAL = CHOREO.portal, ENTRANCE = CHOREO.entrance;
  it("the portal lasts 1 100 ms the first time and about 700 ms (× 0.64) after", () => {
    expect(endMs(PORTAL, 3)).toBe(1100); // three panes staggered by 60 ms
    expect(Math.abs(endMs(scaled(PORTAL, PORTAL_REPEAT_SCALE), 3) - 700)).toBeLessThan(10);
  });
  it("the entrance fits in 2 000 ms with up to 12 characters (the server grace is 2 500 ms)", () => {
    expect(endMs(ENTRANCE)).toBeLessThanOrEqual(2000);
    expect(endMs(ENTRANCE, 12)).toBeLessThanOrEqual(2500);
  });
  it("samples 0 → 1, ease.decel is past half-way at mid-time", () => {
    const s = PORTAL.find((x) => x.id === "arch")!;
    expect(sample(s, 0)).toBe(0);
    expect(sample(s, 10_000)).toBe(1);
    expect(sample(s, s.startMs + s.durationMs / 2)).toBeGreaterThan(0.5);
  });
  it("calm motion selects the 150 ms crossfade", () => {
    expect(variant(PORTAL, { reduced: true }).map((s) => [s.id, s.durationMs])).toEqual([["fade", 150]]);
  });
  it("the runner: complete() jumps to the end state once and calls onDone once (the OK rule)", () => {
    const frames: number[] = [];
    let done = 0;
    let pending: ((t: number) => void) | null = null;
    const clock = { request: (cb: (t: number) => void) => { pending = cb; return 1; }, cancel: () => { pending = null; } };
    const r = run(PORTAL, (p) => frames.push(p("arch")), () => done++, 1, clock);
    expect(frames).toEqual([0]);
    (pending as unknown as (t: number) => void)(0);
    r.complete();
    r.complete();
    expect(frames.at(-1)).toBe(1);
    expect(done).toBe(1);
    expect(r.running).toBe(false);
  });
  it("the arch path grows from the poster to a box that covers the canvas", () => {
    const from = { x: 72, y: 82, w: 227, h: 313 };
    const to = { x: -720, y: -760, w: 2400, h: 1800 };
    expect(lerpBox(from, to, 0)).toEqual(from);
    expect(lerpBox(from, to, 1)).toEqual(to);
    expect(archPath(from)).toMatch(/^M72 395V/);
    expect(to.x).toBeLessThanOrEqual(0);
    expect(to.x + to.w).toBeGreaterThanOrEqual(960);
    expect(to.y + to.h).toBeGreaterThanOrEqual(540);
  });
});

describe("§3.7 characters", () => {
  it("has the 13 expressions, each with features", () => {
    expect(EXPRESSIONS).toHaveLength(13);
    for (const e of EXPRESSIONS) expect(EXPRESSION_FEATURES[e].length).toBeGreaterThan(0);
  });
  it("every reaction is an expression and has an icon burst", () => {
    for (const r of REACTIONS) {
      expect(EXPRESSIONS as readonly string[]).toContain(REACTION_EXPRESSION[r]);
      expect(REACTION_BURST[r]).toMatch(/^burst\./);
    }
  });
  it("expressions read only the public view: away → reaction → done → think → idle", () => {
    const m = { id: "a", color: "coral" as const, connected: true, reaction: null };
    expect(expressionOf({ ...m, connected: false }, "laugh", null)).toBe("away");
    expect(expressionOf(m, "laugh", { doneIds: ["a"], awaitedIds: [] })).toBe("laugh");
    expect(expressionOf(m, null, { doneIds: ["a"], awaitedIds: [] })).toBe("done");
    expect(expressionOf(m, null, { doneIds: [], awaitedIds: ["a"] })).toBe("think");
    expect(expressionOf(m, null, null)).toBe("idle");
  });
});

describe("§2.4 cup", () => {
  const cup = (ranking: string[][], stars: Record<string, number> = {}): RoomPublic["cup"] => ({ stars, last: { gameId: "mishana", n: 1, ranking, points: {} } });
  it("gives 3/2/1 by competition place, ties share", () => {
    expect(starsOfLast(cup([["a"], ["b"], ["c"], ["d"]]))).toEqual({ a: 3, b: 2, c: 1, d: 0 });
    expect(starsOfLast(cup([["a", "b"], ["c"]]))).toEqual({ a: 3, b: 3, c: 1 });
  });
  it("with fewer than 3 ranked players only 1st place scores", () => {
    expect(starsOfLast(cup([["a"], ["b"]]))).toEqual({ a: 3, b: 0 });
  });
  it("standings sort by stars then seat, without left members", () => {
    const room = {
      cup: { stars: { a: 1, b: 4 }, last: null },
      members: [
        { id: "a", name: "A", color: "coral", seat: 0, left: false },
        { id: "b", name: "B", color: "azure", seat: 1, left: false },
        { id: "c", name: "C", color: "jade", seat: 2, left: true },
      ],
    } as unknown as RoomPublic;
    expect(cupStandings(room).map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("§3.5 settings rows", () => {
  beforeAll(async () => { const m = await import("../src/lib/meta"); await m.ensureMeta("mishana"); });
  const setup = (packs: number, roleMode: "auto" | "custom" = "auto"): RoomSetup => ({
    gameId: "mishana",
    settings: { ...GAME_META.mishana.settings.defaults, roleMode },
    canStart: true, startBlocker: null,
    availablePacks: Array.from({ length: packs }, (_, i) => ({ id: `p${i}`, gameId: "mishana", family: `p${i}`, locale: "en", title: { en: `P${i}`, fr: "", ar: "" }, pairCount: 40, ageRating: "all", tier: "free", stars: null, domain: null, topics: [] })),
    lockedPacks: [], extras: { gameId: "mishana", roleCounts: { civilian: 2, undercover: 0, blank: 1 }, poolExhausted: false },
  } as unknown as RoomSetup);
  it("shows at most 4 basic rows and hides a row with one possible value", () => {
    expect(basicRows(setup(3)).map((r) => r.id)).toEqual(["roleMode", "timers", "packIds"]);
    expect(basicRows(setup(1)).map((r) => r.id)).toEqual(["roleMode", "timers"]);
    for (const id of ["mishana", "bluff", "likely", "trivia"] as const) expect(GAME_META[id].settings.basic.length).toBeLessThanOrEqual(4);
  });
  it("Custom impostors opens the two counts inline", () => {
    expect(basicRows(setup(1, "custom")).filter((r) => r.sub).map((r) => r.id)).toEqual(["blankCount", "undercoverCount"]);
  });
  it("the timers row steps through the presets", () => {
    const row = basicRows(setup(1)).find((r) => r.id === "timers")!;
    expect(row.step!(1)).toEqual({ clueSeconds: 30, voteSeconds: 60, revealSeconds: 20, guessSeconds: 30 });
  });
});

describe("§4.5 Pass store", () => {
  it("computes Save {n}% from the two prices, rounded down", () => {
    expect(yearlySavingPercent("$4.99", "$29.99")).toBe(49);
    expect(yearlySavingPercent("4,99 €", "29,99 €")).toBe(49);
    expect(yearlySavingPercent("$4.99", "$70.00")).toBeNull();
    expect(yearlySavingPercent("?", "$29.99")).toBeNull();
  });
  it("groups pack rows by game in registry order", () => {
    const g = packsByGame([{ gameId: "trivia", id: 1 }, { gameId: "mishana", id: 2 }, { gameId: "mishana", id: 3 }], ["mishana", "bluff", "likely", "trivia"]);
    expect(g.map((x) => [x.gameId, x.packs.length])).toEqual([["mishana", 2], ["trivia", 1]]);
  });
});

describe("room socket URL (partysocket layout)", () => {
  it("builds /parties/<party>/<room>?_pk&cid with ws/wss", () => {
    expect(partyUrl({ host: "a.b", protocol: "https:" }, "KXQP", "pk1", "c1")).toBe("wss://a.b/parties/room/KXQP?_pk=pk1&cid=c1");
    expect(partyUrl({ host: "127.0.0.1:8788", protocol: "http:" }, "KXQP", "pk1", "c1")).toMatch(/^ws:\/\/127\.0\.0\.1:8788\/parties\/room\/KXQP\?/);
  });
});

describe("§2.1 phone bundle guard (web-client/src)", () => {
  // The root eslint config carries the same rule (no-restricted-imports on web-client/src); this test keeps the list
  // enforced even when lint is not run (type-only imports stay allowed).
  const BANNED = [/@jamaa\/shared\/games\/registry/, /@jamaa\/shared\/games\/[a-z]+\/definition/, /\/engine["']/, /@jamaa\/shared\/engine["']/, /@jamaa\/shared\/content["']/, /["']zod["']/, /\/content["']/];
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  walk(new URL("../src", import.meta.url).pathname);
  it("no runtime import of the registry, definitions, engines, content or zod", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        if (!/^\s*(import|export)\b/.test(line) || /^\s*import type\b/.test(line) || /^\s*export type\b/.test(line)) continue;
        if (!/from\s+["']/.test(line) && !/import\s+["']/.test(line)) continue;
        if (BANNED.some((re) => re.test(line))) bad.push(`${f}: ${line.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("lazy per-game metas (phone budget)", () => {
  it("the fixed world table and every lazily loaded meta equal GAME_META", async () => {
    const { WORLD_OF, ensureMeta } = await import("../src/lib/meta");
    for (const id of ["mishana", "bluff", "likely", "trivia"] as const) {
      expect(WORLD_OF[id]).toBe(GAME_META[id].rules.world);
      expect(await ensureMeta(id)).toBe(GAME_META[id]);
    }
  });
});

describe("§3.4 world palettes from @jamaa/shared/worlds", () => {
  it("builds every world's web tokens (virtual:jamaa-worlds.css) (night-market is also :root), with rgb triplets for the glows", async () => {
    const { WORLD_IDS, worldColor } = await import("@jamaa/shared/worlds");
    const { worldCss } = await import("../src/lib/worlds");
    const css = worldCss(WORLD_IDS, worldColor);
    for (const w of WORLD_IDS) {
      expect(css).toContain(`[data-world="${w}"]`);
      expect(css).toContain(`--w-accent:${worldColor(w, "accent", "web")}`);
      expect(css).toContain(`--w-deep:${worldColor(w, "deep", "web")}`);
    }
    expect(css).toMatch(/^:root,\[data-world="night-market"\]\{--w-deep:#1D1036;/);
    expect(css).toContain("--w-rgb-accent:41 211 194"); // rooftop #29D3C2
    expect(css).not.toContain("null");
  });
});
