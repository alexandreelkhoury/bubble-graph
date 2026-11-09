// JAMAA-PLATFORM §2.2 / §2.10 / §6.5: Bluff's GameDefinition surface — meta, protocol schemas (every projection in
// every phase parses), intent strictness, error codes, the pack schema and the content adapter.
import { describe, expect, it } from "vitest";
import { content as adapter } from "../../../src/games/bluff/content";
import { definition } from "../../../src/games/bluff/definition";
import { ERRORS } from "../../../src/games/bluff/errors";
import { BLUFF_META } from "../../../src/games/bluff/meta";
import {
  BluffExtrasSchema, BluffIntentSchema, BluffMeSchema, BluffPublicSchema, BluffSettingsPatchSchema, BluffSettingsSchema,
} from "../../../src/games/bluff/protocol";
import { BluffPackSchema } from "../../../src/games/bluff/schema";
import { GameEnvelopeSchema } from "../../../src/games/protocol";
import { ErrorCodeSchema } from "../../../src/protocol/common";
import { errorMessageKey } from "../../../src/protocol/errors";
import { bluffPack, bluffTokenCatalog, bluffTokenItem } from "../../../src/testing/catalogs/bluff";
import { G, P } from "./harness";

describe("meta (JAMAA-PLATFORM §2.10, GAME-BLUFF §2, §9)", () => {
  it("bounds, settings rows, world, how-to and pause items", () => {
    expect(BLUFF_META).toBe(definition.meta);
    expect([BLUFF_META.minPlayers, BLUFF_META.maxPlayers, BLUFF_META.carriesScore]).toEqual([3, 12, false]);
    expect(BLUFF_META.settings.defaults).toEqual({ packIds: [], length: "normal", pace: "normal" });
    expect(BLUFF_META.settings.basic.map((f) => f.key)).toEqual(["packIds", "length", "pace"]);
    expect(BLUFF_META.rules.howToKeys).toEqual(["game.bluff.howto.1", "game.bluff.howto.2", "game.bluff.howto.3", "game.bluff.howto.4"]);
    expect(BLUFF_META.rules.pauseItems.map((p) => p.intent)).toEqual(["SKIP_PROMPT", "HIDE_OPTION", "HOST_ADVANCE", "END_GAME"]);
    expect(BLUFF_META.rules.pauseItems.find((p) => p.intent === "END_GAME")?.confirm).toBe(true);
    for (const s of BLUFF_META.rules.ruleSections) for (const ph of s.phases) expect(BLUFF_META.phases).toContain(ph);
    expect(definition.stateSchema).toBe(1);
  });
});

describe("error codes (GAME-BLUFF §5.1)", () => {
  it("every Bluff code is a registered ErrorCode with an error.* key", () => {
    expect(ERRORS).toContain("CANNOT_VOTE_SPOT_ON");
    for (const c of ERRORS) {
      expect(ErrorCodeSchema.safeParse(c).success).toBe(true);
      expect(errorMessageKey(c)).toMatch(/^error\.[a-z][A-Za-z]+$/);
    }
  });
});

describe("intents (GAME-BLUFF §13.1)", () => {
  it("accept the documented shapes and reject extra keys or malformed ids", () => {
    const ok = [
      { type: "SUBMIT_LIE", text: "hello there", promptId: "0123abcd" }, { type: "REQUEST_HELP", promptId: "0123abcd" },
      { type: "VOTE", optionId: "0123abcd" }, { type: "LIKE", optionId: "0123abcd", on: true }, { type: "SKIP_PROMPT", promptId: "0123abcd" },
      { type: "HIDE_OPTION", optionId: "0123abcd" }, { type: "HOST_ADVANCE" }, { type: "END_GAME" },
    ];
    for (const i of ok) expect(BluffIntentSchema.safeParse(i).success, i.type).toBe(true);
    const bad = [
      { type: "SUBMIT_LIE", text: "x", promptId: "0123ABCD" }, { type: "VOTE", optionId: "0123abcd", extra: 1 }, { type: "LIKE", optionId: "0123abcd" },
      { type: "HOST_ADVANCE", now: 1 }, { type: "SUBMIT_LIE", text: "x".repeat(481), promptId: "0123abcd" }, { type: "NOPE" },
    ];
    for (const i of bad) expect(BluffIntentSchema.safeParse(i).success, JSON.stringify(i)).toBe(false);
  });
  it("settings schemas are strict", () => {
    expect(BluffSettingsSchema.safeParse(BLUFF_META.settings.defaults).success).toBe(true);
    expect(BluffSettingsPatchSchema.safeParse({ pace: "fast" }).success).toBe(true);
    expect(BluffSettingsPatchSchema.safeParse({ pace: "warp" }).success).toBe(false);
    expect(BluffSettingsPatchSchema.safeParse({ likes: false }).success).toBe(false);
  });
});

describe("views parse in every phase (GAME-BLUFF §13.2)", () => {
  it("public, me (each player), status and the room envelope", () => {
    const g = new G({ players: 5 });
    const seen = new Set<string>();
    for (let guard = 0; guard < 300 && g.s.phase !== "RESULTS"; guard++) {
      const check = (): void => {
        seen.add(g.s.phase);
        const pub = g.pub();
        expect(BluffPublicSchema.safeParse(pub).success, g.s.phase).toBe(true);
        for (const id of g.ids) {
          const me = g.me(id);
          const r = BluffMeSchema.safeParse(me);
          expect(r.success, `${g.s.phase} ${id} ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
          const st = definition.projectStatus(g.s);
          expect(GameEnvelopeSchema.safeParse({ gameId: "bluff", n: 1, ...st, public: pub, me, over: false }).success).toBe(true);
        }
      };
      check();
      if (g.s.phase === "WRITING") {
        if (g.s.promptIndex === 0 && !g.s.help.p3) g.do({ type: "REQUEST_HELP", promptId: g.promptId() }, P("p3"));
        g.allSubmit();
        check();
      }
      if (g.s.phase === "VOTING") {
        for (const p of g.ids) {
          const o = g.s.options.find((x) => !x.authors.includes(p));
          if (o && !g.s.spotOn[p]) g.vote(p, o.id);
        }
        check();
      }
      if ((g.s.phase as string) !== "RESULTS" && g.s.deadline !== null) g.tick();
    }
    expect(definition.projectMe(g.s, "ghost", g.cat)).toBeNull();
    expect([...seen].sort()).toEqual(["AWARDS", "REVEAL", "ROUND_INTRO", "SCORES", "VOTING", "WRITING"].sort());
    expect(BluffPublicSchema.safeParse(g.pub()).success).toBe(true);
  });
  it("setup extras", () => {
    const roster = [0, 1, 2].map((i) => ({ id: `p${i}`, seat: i, locale: "en" as const, connected: true, carryScore: 0 }));
    const x = definition.projectSetup(BLUFF_META.settings.defaults, roster, bluffTokenCatalog(), { premium: false, packs: new Set() }, "en", { usedKeys: [] });
    expect(BluffExtrasSchema.parse(x)).toEqual({ gameId: "bluff", available: 30, bigGroup: false });
  });
});

describe("pack schema and content adapter (GAME-BLUFF §11.3, JAMAA-PLATFORM §5.2)", () => {
  const items = Array.from({ length: 12 }, (_, i) => bluffTokenItem(`t${String(i).padStart(2, "0")}`, "fact_blank", i));
  const pack = bluffPack("test-facts", items);
  it("parses a valid pack and refuses broken ones", () => {
    expect(adapter.parse(JSON.parse(JSON.stringify(pack)))).toEqual(pack);
    expect(BluffPackSchema.safeParse({ ...pack, items: items.slice(0, 11) }).success).toBe(false);
    expect(BluffPackSchema.safeParse({ ...pack, items: [...items.slice(1), items[1]] }).success).toBe(false);          // duplicate id
    const nt = bluffTokenItem("nt01", "no_truth", 1);
    expect(BluffPackSchema.safeParse({ ...pack, items: [...items.slice(1), { ...nt, truth: { en: "x" } }] }).success).toBe(false);
    expect(BluffPackSchema.safeParse({ ...pack, items: [...items.slice(1), { ...items[0], truth: {} }] }).success).toBe(false);
    expect(BluffPackSchema.safeParse({ ...pack, items: [...items.slice(1), { ...nt, knownIn: ["en"] }] }).success).toBe(false);
  });
  it("meta: the pack is its own family; tier from item tiers", () => {
    const m = adapter.meta(pack);
    expect(m).toMatchObject({ id: "test-facts", family: "test-facts", gameId: "bluff", languages: ["en", "ar"], itemCount: 12 });
    expect(m.tier).toBe("mixed");
    expect(adapter.meta({ ...pack, items: items.map((i) => ({ ...i, tier: "free" as const })) }).tier).toBe("free");
    expect(adapter.meta({ ...pack, items: items.map((i) => ({ ...i, tier: "pass" as const })) }).tier).toBe("premium");
    expect(adapter.playable({ ...pack, items: items.map((i) => ({ ...i, tier: "pass" as const })) }, { premium: false, ownedFamilies: new Set() })).toBeNull();
  });
});
