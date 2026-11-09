// G3 lane D tests: the Likely packs (GAME-LIKELY §11), the content-lint rules for this game
// (tools/content-lint/src/games/likely.ts), the game.likely.* i18n files and the likely sound cues.
import { describe, expect, it } from "vitest";
import { PACKS } from "../index";
import { content } from "../../../shared/src/games/likely/content";
import type { LikelyPack } from "../../../shared/src/games/likely/content";
import { cardAllowed } from "../../../shared/src/games/likely/engine/catalog";
import { ERRORS } from "../../../shared/src/games/likely/errors";
import { LIKELY_LENGTHS, LIKELY_META, LIKELY_TAGS } from "../../../shared/src/games/likely/meta";
import { BANNED_FAMILY, findTerms, lintLikelyRaw, MIN_FREE_CARDS } from "../../../tools/content-lint/src/games/likely";
import en from "../../../shared/i18n/games/likely/en.json";
import fr from "../../../shared/i18n/games/likely/fr.json";
import ar from "../../../shared/i18n/games/likely/ar.json";
import es from "../../../shared/i18n/games/likely/es.json";
import { CUES } from "../../../tools/gen-sounds/cues/likely.mjs";
import { render, verify } from "../../../tools/gen-sounds/src/main";
import { ALIASES } from "../../../tools/gen-sounds/src/platform-cues";
import { SR } from "../../../tools/gen-sounds/src/dsp";

const LOCS = ["en", "fr", "ar", "es"] as const;
const packs: LikelyPack[] = PACKS.map((p) => content.parse(p));
const family = packs.find((p) => p.id === "likely-family") as LikelyPack;
const spicy = packs.find((p) => p.id === "likely-spicy") as LikelyPack;

describe("Likely packs (GAME-LIKELY §11)", () => {
  it("registers the Family and Spicy packs, both parsing with the Likely ContentAdapter", () => {
    expect(packs.map((p) => p.id)).toEqual(["likely-family", "likely-spicy"]);
    for (const p of packs) expect(p.locales).toEqual(["en", "fr", "ar", "es"]);
  });

  it("Family: 80+ cards in every language, all spice 0, ≥ 40 % free and enough free cards for Long twice", () => {
    expect(family.ageRating).toBe("all");
    expect(family.cards.length).toBeGreaterThanOrEqual(80);
    for (const c of family.cards) for (const l of LOCS) expect(c.prompt[l]?.length, `${c.id} ${l}`).toBeGreaterThan(0);
    expect(family.cards.every((c) => c.spice === 0 && !c.namesPlayer && !c.tags.includes("romance"))).toBe(true);
    const free = family.cards.filter((c) => c.tier === "free");
    expect(free.length / family.cards.length).toBeGreaterThanOrEqual(0.4);
    expect(free.length).toBeGreaterThanOrEqual(Math.max(MIN_FREE_CARDS, 2 * LIKELY_LENGTHS.long));
    // §11.3: the first card of a game is an easy opener (party or habits), so a free room needs some.
    expect(free.filter((c) => c.tags.includes("party") || c.tags.includes("habits")).length).toBeGreaterThanOrEqual(LIKELY_LENGTHS.long);
  });

  it("Spicy: 60+ adult cards, all spice ≥ 1, Pass-only, ≤ 40 % naming a player, every named card has {player} once per locale", () => {
    expect(spicy.ageRating).toBe("adult");
    expect(spicy.cards.length).toBeGreaterThanOrEqual(60);
    expect(spicy.cards.every((c) => c.spice >= 1 && c.tier === "pass")).toBe(true);
    const named = spicy.cards.filter((c) => c.namesPlayer);
    expect(named.length / spicy.cards.length).toBeLessThanOrEqual(0.4);
    // §11.3: in Spicy mode roughly 2 in 3 cards are Spicy and ≤ 1 in 3 named: a Long game needs ≥ 11 Spicy cards, ≥ 6 unnamed.
    expect(spicy.cards.filter((c) => !c.namesPlayer).length).toBeGreaterThanOrEqual(LIKELY_LENGTHS.long);
    for (const c of named) for (const l of LOCS) expect(c.prompt[l]?.split("{player}").length, `${c.id} ${l}`).toBe(2);
  });

  it("the adapter hides the Spicy pack from free rooms and serves only free Family cards there", () => {
    const none = { premium: false, ownedFamilies: new Set<string>() };
    expect(content.playable(spicy, none)).toBeNull();
    const free = content.playable(family, none) as LikelyPack;
    expect(free.cards.every((c) => c.tier === "free")).toBe(true);
    expect(content.meta(family).tier).toBe("mixed");
    expect(content.meta(spicy).tier).toBe("premium");
    // §9.1 rule 5: family mode never draws a Spicy card, whatever the packs say.
    expect(spicy.cards.some((c) => cardAllowed(c, "family"))).toBe(false);
  });

  it("uses only schema tags, unique ids across packs, and an award on every card", () => {
    const ids = packs.flatMap((p) => p.cards.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of packs.flatMap((p) => p.cards)) {
      for (const t of c.tags) expect(LIKELY_TAGS as readonly string[]).toContain(t);
      for (const l of LOCS) expect(c.award[l], `${c.id} ${l}`).toBeTruthy();
    }
  });

  it("passes every content-lint rule for this game (draft free cards are only a release error)", () => {
    const raws = PACKS.map((raw, i) => ({ file: `likely/${packs[i]?.id}.json`, raw }));
    const f = lintLikelyRaw(raws);
    expect(f.errors).toEqual([]);
    const rel = lintLikelyRaw(raws, { release: true });
    const drafts = family.cards.filter((c) => c.tier === "free" && c.review.status === "draft").length;
    expect(rel.errors.length).toBe(drafts);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

type Raw = { schemaVersion: 1; id: string; game: "likely"; title: object; description: object; locales: string[]; ageRating: string; cards: Record<string, unknown>[] };
const L = (en: string, fr: string, ar: string, es: string): Record<string, string> => ({ en, fr, ar, es });
function card(i: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `t-${String(i).padStart(3, "0")}`, tier: i % 2 ? "pass" : "free", spice: 0, namesPlayer: false, tags: ["habits"],
    prompt: L(`hum song number ${i} all day`, `de fredonner la chanson ${i}`, `يدندن الغنية رقم ${i}`, `tararear la canción ${i}`),
    award: L(`Hum ${i} Award`, `Prix ${i}`, `جايزة ${i}`, `Premio ${i}`), review: { status: "native-reviewed" }, ...over,
  };
}
function pack(cards: Record<string, unknown>[], over: Partial<Raw> = {}): Raw {
  return { schemaVersion: 1, id: "t-pack", game: "likely", title: L("T", "T", "T", "T"), description: L("D", "D", "D", "D"), locales: [...LOCS], ageRating: "all", cards, ...over };
}
const base = (): Record<string, unknown>[] => Array.from({ length: 70 }, (_, i) => card(i)) // 35 free (≥ 33);
const errs = (raw: unknown, release = false): string[] => lintLikelyRaw([{ file: "likely/t-pack.json", raw }], { release }).errors;
const warns = (raw: unknown): string[] => lintLikelyRaw([{ file: "likely/t-pack.json", raw }]).warnings;
const withCard = (over: Record<string, unknown>, rating = "all"): Raw => pack([card(999, over), ...base()], { ageRating: rating });
const setText = (field: "prompt" | "award", l: string, v: string): Record<string, unknown> => {
  const c = card(999);
  (c[field] as Record<string, string>)[l] = v;
  return { [field]: c[field] };
};

describe("content-lint: likely rules", () => {
  it("accepts a clean synthetic pack", () => {
    expect(errs(pack(base()))).toEqual([]);
  });

  it.each([
    ["EN uppercase start", setText("prompt", "en", "Cry at a wedding"), /lowercase/],
    ["EN starts with to", setText("prompt", "en", "to cry at a wedding"), /"to "/],
    ["EN trailing ?", setText("prompt", "en", "cry at a wedding?"), /punctuation/],
    ["FR without de", setText("prompt", "fr", "pleurer à un mariage"), /"de " or "d'"/],
    ["AR with مين", setText("prompt", "ar", "مين بيبكي بعرس"), /«مين»/],
    ["ES with que", setText("prompt", "es", "que llore en una boda"), /infinitive/],
    ["EN award shape", setText("award", "en", "Waterworks"), /Award/],
    ["FR award shape", setText("award", "fr", "Grandes eaux"), /Prix/],
    ["AR award shape", setText("award", "ar", "الدموع"), /جايزة/],
    ["ES award shape", setText("award", "es", "Magdalena"), /Premio/],
    ["EN too long", setText("prompt", "en", `cry ${"a".repeat(70)}`), /graphemes/],
    ["emoji", setText("prompt", "en", "cry at a wedding 😭"), /emoji/],
    ["{player} in a family card", { ...setText("prompt", "en", "kiss {player}") }, /\{player\}/],
    ["spice in a family pack", { spice: 1 }, /"all" pack/],
    ["romance tag in a family pack", { tags: ["romance"] }, /romance/],
  ])("rejects %s", (_name, over, re) => {
    expect(errs(withCard(over)).some((e) => re.test(e)), errs(withCard(over)).join("\n")).toBe(true);
  });

  it("bans romance and alcohol in Family packs, body/bed/cheating in the Spicy pack, and religion everywhere", () => {
    expect(errs(withCard(setText("prompt", "en", "kiss the neighbour"))).join()).toMatch(/kiss.*Family/);
    expect(errs(withCard(setText("prompt", "fr", "de boire du vin rouge"))).join()).toMatch(/vin/);
    expect(errs(withCard(setText("prompt", "ar", "يكون سكران بالعرس"))).join()).toMatch(/سكران/);
    expect(errs(withCard(setText("prompt", "es", "darle un beso al vecino"))).join()).toMatch(/beso/);
    const spicyCard = (field: "prompt" | "award", l: string, v: string): Raw => {
      const c = card(999, { spice: 1, tier: "pass" });
      (c[field] as Record<string, string>)[l] = v;
      return pack([c, ...base().map((x) => ({ ...x, spice: 1, tier: "pass" }))], { ageRating: "adult" });
    };
    expect(errs(spicyCard("prompt", "en", "stay in bed all weekend"))).toEqual(expect.arrayContaining([expect.stringMatching(/"bed" is banned in the Spicy pack/)]));
    expect(errs(spicyCard("prompt", "fr", "de tromper son crush"))).toEqual(expect.arrayContaining([expect.stringMatching(/tromper/)]));
    expect(errs(spicyCard("prompt", "ar", "يخون الحبيب"))).toEqual(expect.arrayContaining([expect.stringMatching(/يخون/)]));
    expect(errs(spicyCard("prompt", "en", "kiss a stranger"))).toEqual([]); // romance is the point of the Spicy pack
    expect(errs(withCard(setText("prompt", "fr", "d'aller à l'Église à pied"))).join()).toMatch(/eglise/);
    expect(errs(withCard(setText("prompt", "ar", "يروح عالجامع مشي"))).join()).toMatch(/جامع/);
  });

  it("reports review flags as warnings, brands and profanity as errors, and does not misread compounds", () => {
    expect(warns(withCard(setText("prompt", "en", "start a new diet every Monday")))).toEqual(expect.arrayContaining([expect.stringMatching(/review flag "diet"/)]));
    expect(warns(withCard(setText("prompt", "ar", "يتّصل بماما كل ساعة")))).toEqual(expect.arrayContaining([expect.stringMatching(/ماما/)]));
    expect(errs(withCard(setText("prompt", "en", "win every jackbox game"))).join()).toMatch(/brand/);
    expect(errs(withCard(setText("prompt", "fr", "d'organiser un pique-nique au parc")))).toEqual([]);
  });

  it("checks pack-level shares: free ≥ 40 % (and ≥ 33 cards), named ≤ 40 %, adult cards never free or spice 0", () => {
    const fewFree = pack(base().map((c, i) => ({ ...c, tier: i < 20 ? "free" : "pass" })));
    expect(errs(fewFree).join()).toMatch(/at least 40/);
    const named = (n: number): Raw => pack(base().map((c, i) => ({
      ...c, spice: 2, tier: "pass", namesPlayer: i < n, tags: ["romance"],
      prompt: i < n ? L(`kiss {player} at party ${i}`, `d'embrasser {player} ${i}`, `يبوس {player} ${i}`, `besar a {player} ${i}`) : c.prompt,
    })), { ageRating: "adult" });
    expect(errs(named(28))).toEqual([]);
    expect(errs(named(29)).join()).toMatch(/name a player \(max 40/);
    expect(errs(pack(base().map((c) => ({ ...c, spice: 0 })), { ageRating: "adult" })).join()).toMatch(/spice 0 in an "adult" pack/);
    expect(errs(pack(base().map((c) => ({ ...c, spice: 1 })), { ageRating: "adult" })).join()).toMatch(/never free/);
    expect(warns(pack(base().slice(0, 40).map((c) => ({ ...c, spice: 1, tier: "pass" })), { ageRating: "adult" })).join()).toMatch(/launches with 60/);
  });

  it("finds duplicates (ids across packs, prompts after normalisation) and missing locales", () => {
    const dup = base();
    (dup[1] as { prompt: Record<string, string> }).prompt.en = "Hum   song number 0 all day".toLowerCase();
    expect(errs(pack(dup)).join()).toMatch(/duplicates/);
    const two = lintLikelyRaw([{ file: "a", raw: pack(base()) }, { file: "b", raw: pack(base(), { id: "t-pack-2" }) }]);
    expect(two.errors.join()).toMatch(/unique across Likely packs/);
    const noEs = base();
    delete (noEs[0] as { prompt: Record<string, string> }).prompt.es;
    expect(errs(pack(noEs)).join()).toMatch(/prompt.es and award.es are required/);
  });

  it("makes draft free cards a release error only", () => {
    const drafts = pack(base().map((c) => ({ ...c, review: { status: "draft" } })));
    expect(errs(drafts)).toEqual([]);
    expect(errs(drafts, true).length).toBe(35);
  });

  it("matches terms on whole normalised tokens with Arabic clitics stripped", () => {
    expect(findTerms("Un dîner à l'ÉGLISE", ["eglise"])).toEqual(["eglise"]);
    expect(findTerms("بالجامع", ["جامع"])).toEqual(["جامع"]);
    expect(findTerms("صار مديون", ["دين"])).toEqual([]);
    expect(findTerms("go on a date night", ["date night"])).toEqual(["date night"]);
    expect(findTerms("the expert", BANNED_FAMILY.en)).toEqual([]);
  });

  it("the real packs never trip a Family ban list", () => {
    for (const c of family.cards) for (const l of LOCS) expect(findTerms(c.prompt[l] as string, BANNED_FAMILY[l]), `${c.id} ${l}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

const FILES = { en, fr, ar, es } as Record<(typeof LOCS)[number], Record<string, unknown>>;
const placeholders = (v: unknown): string[] =>
  [...new Set((typeof v === "string" ? [v] : Object.values(v as Record<string, string>)).flatMap((s) => [...s.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1] as string)))].sort();

describe("game.likely.* i18n", () => {
  it("has the same keys in en, fr, ar and es, all under game.likely.", () => {
    const keys = Object.keys(en).sort();
    for (const l of LOCS) {
      expect(Object.keys(FILES[l]).sort(), l).toEqual(keys);
      for (const k of Object.keys(FILES[l])) expect(k.startsWith("game.likely."), k).toBe(true);
    }
  });

  it("covers every key the GameMeta, the error codes and GAME-LIKELY §10 name", () => {
    const m = LIKELY_META;
    const want = [
      m.rules.titleKey, m.rules.taglineKey, ...m.rules.howToKeys, "game.likely.howto.3.anon", "game.likely.howto.4.anon",
      ...["vote", "points", "chaos", "awards", "secret", "spicy"].flatMap((s) => [`game.likely.rules.${s}.title`, `game.likely.rules.${s}.body`]),
      ...m.rules.ruleSections.flatMap((r) => [r.titleKey, r.bodyKey]),
      ...m.rules.pauseItems.map((p) => p.labelKey),
      ...[...m.settings.basic, ...m.settings.advanced].flatMap((f) => [f.labelKey, ...("options" in f && f.options ? f.options.map((o) => o.labelKey) : [])]),
      "game.likely.setup.mode", "game.likely.setup.mode.family", "game.likely.setup.mode.spicy", "game.likely.setup.spicyFromTv",
      ...ERRORS.map((c) => `game.likely.error.${c.toLowerCase().replace(/_([a-z])/g, (_, x: string) => x.toUpperCase())}`),
      ...["card.header", "vote.me", "vote.locked", "reveal.youGot", "reveal.withGroup", "reveal.selfAware", "reveal.unanimousPts", "reveal.unanimous",
        "reveal.chaos", "reveal.again", "reveal.none", "reveal.percent", "reveal.percentYou", "reveal.defend", "awards.mystery",
        "spicy.gate.title", "spicy.gate.body", "spicy.gate.cancel", "spicy.gate.confirm", "spicy.joinNotice", "host.skip", "card.next",
        "coach.card", "coach.voting", "coach.reveal", "coach.awards", "hold.waiting"].map((k) => `game.likely.${k}`),
    ];
    for (const k of want) expect(en, k).toHaveProperty([k]);
  });

  it("keeps placeholders identical across locales, no literal %, and plural objects where EN has one", () => {
    for (const [k, v] of Object.entries(en)) {
      for (const l of LOCS) {
        const x = FILES[l][k];
        expect(placeholders(x), `${l} ${k}`).toEqual(placeholders(v));
        expect(typeof x, `${l} ${k}`).toBe(typeof v);
        for (const s of typeof x === "string" ? [x] : Object.values(x as Record<string, string>)) expect(s.includes("%"), `${l} ${k}`).toBe(false);
      }
    }
    expect(Object.keys(ar["game.likely.reveal.youGot"]).sort()).toEqual(["few", "many", "one", "other", "two", "zero"]);
  });

  it("uses French typography (narrow no-break space before ? ! : and inside guillemets)", () => {
    for (const [k, v] of Object.entries(fr)) {
      for (const s of typeof v === "string" ? [v] : Object.values(v as Record<string, string>)) {
        expect(/ [?!:;]/.test(s), `${k}: ${s}`).toBe(false);
        expect(/« | »/.test(s), `${k}: ${s}`).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe("likely sound cues (GAME-LIKELY §12.6)", () => {
  const ids = CUES.map((c) => c.id);
  it("has the §12.6 cues, prefixed likely., unique, with the intro fanfare as the platform world sting", () => {
    for (const id of ["likely.deal", "likely.tok", "likely.spot", "likely.rosette", "likely.confetti", "likely.scramble"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("likely.")).toBe(true);
    expect(ALIASES["sting.likelyIntro"]).toBe("world_likely_sting");
  });

  it.each(CUES.map((c) => [c.id, c] as const))("%s renders deterministically, audibly, ≤ 1.5 s, peaks ≤ −1 dBFS, silent edges", (id, def) => {
    expect(def.seconds).toBeLessThanOrEqual(1.5);
    const a = render(id, CUES), b = render(id, CUES);
    expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(true);
    let peak = 0, energy = 0;
    for (const v of a.data) {
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    expect(peak).toBeLessThanOrEqual(Math.pow(10, -1 / 20) + 1e-6);
    expect(Math.sqrt(energy / a.length)).toBeGreaterThan(0.002);
    expect(Math.abs(a.get(0))).toBeLessThan(1e-3);
    expect(Math.abs(a.get(a.length - 1))).toBeLessThan(1e-3);
    expect(a.length).toBe(Math.round(def.seconds * SR));
  });

  it("the generated files (web, res/raw, index.json, SoundCuesLikely.kt) are present, current and within the game budget", () => {
    const root = new URL("../../../", import.meta.url).pathname;
    expect(verify(root, { likely: CUES }).filter((p) => p.includes("likely"))).toEqual([]);
  });
});
