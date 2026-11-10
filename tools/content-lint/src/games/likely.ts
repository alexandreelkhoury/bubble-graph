// Who's Most Likely To… content rules (GAME-LIKELY §11.1–§11.3; JAMAA-PLATFORM §5.5). Owned by the G3 lane D.
//
// The common pass (../common.ts) has already parsed every pack through the Likely ContentAdapter (zod schema: ids,
// tiers, spice ⇔ ageRating, `{player}` ⇔ namesPlayer, every listed locale present). This file adds the style and
// safety rules of §11.2 "Lint" plus a few house rules (marked "house"). Pure: no I/O. `lintLikelyRaw` is the same
// check over raw JSON, used by content/likely/test.
import { profaneTokens } from "../lint";
import type { Findings } from "../platform";
import type { GameLint, ParsedPack } from "./types";

export const LIKELY_LOCALES = ["en", "fr", "ar", "es"] as const;
export type LikelyLocale = (typeof LIKELY_LOCALES)[number];
const PLAYER = "{player}";

/** §11.2: ≥ 40 % of the Family pack free, and enough free cards to play Long (16) twice without a rerun. */
export const MIN_FREE_SHARE = 0.4;
export const MIN_FREE_CARDS = 33;
/** §11.2: at most 40 % of an adult pack's cards name a player. */
export const MAX_NAMED_SHARE = 0.4;
/** §11.4: the Spicy pack ships with 60 cards (a warning below that). */
export const SPICY_LAUNCH_CARDS = 60;
/** §11.1 style: a phrase of ≤ 60 graphemes (EN, AR); FR and ES get the schema's 70. */
export const MAX_GRAPHEMES: Readonly<Record<LikelyLocale, number>> = { en: 60, fr: 70, ar: 60, es: 70 };

/** Award shape per locale (§11.2: EN "… Award", FR "Prix …", AR «جايزة …»; ES "Premio …", house rule). */
const AWARD_SHAPE: Readonly<Record<LikelyLocale, { test: (s: string) => boolean; rule: string }>> = {
  en: { test: (s) => /\bAward$/u.test(s), rule: 'ends with "Award"' },
  fr: { test: (s) => /^Prix\b/u.test(s), rule: 'starts with "Prix"' },
  ar: { test: (s) => s.startsWith("جايزة"), rule: "starts with «جايزة»" },
  es: { test: (s) => /^Premio\b/u.test(s), rule: 'starts with "Premio"' },
};

// ---------------------------------------------------------------------------------------------------------------------
// Keyword lists (§11.1). Matched on whole normalised tokens (accents and Arabic tashkeel folded, Arabic clitics
// و/ف/ب/ل/ع/ال stripped), or on a normalised phrase when the entry has a space. Kept conservative: a human review
// still reads every card.

type Terms = Readonly<Record<LikelyLocale, readonly string[]>>;

/** Banned in every pack: body and appearance, religion, politics, death and loss, crime, sexuality as a topic, drugs. */
export const BANNED_ALL: Terms = {
  en: ["fat", "ugly", "skinny", "bald", "wrinkles", "god", "allah", "jesus", "church", "mosque", "pray", "prayer", "religion", "politics",
    "political", "election", "elections", "parliament", "minister", "government", "die", "dies", "dead", "death", "funeral", "divorce",
    "fired", "jail", "prison", "kill", "murder", "rob", "sex", "sexy", "sexual", "gay", "lesbian", "naked", "nude", "porn", "drug", "drugs",
    "weed", "cocaine", "racist", "single forever"],
  fr: ["obese", "moche", "chauve", "rides", "dieu", "eglise", "mosquee", "priere", "religion", "politique", "election", "elections",
    "ministre", "gouvernement", "mourir", "mort", "enterrement", "divorce", "divorcer", "vire", "viree", "prison", "tuer", "voler une banque",
    "sexe", "sexy", "sexuel", "porno", "nu", "nue", "drogue", "joint", "cocaine", "raciste"],
  ar: ["سمين", "بشع", "أقرع", "الله", "يسوع", "كنيسة", "جامع", "صلاة", "دين", "سياسة", "انتخابات", "وزير", "حكومة", "يموت", "موت", "جنازة",
    "طلاق", "يطلق", "سجن", "حبس", "يقتل", "جنس", "سكس", "عاري", "شاذ", "حشيش", "مخدرات"],
  es: ["gordo", "gorda", "feo", "fea", "calvo", "calva", "dios", "iglesia", "mezquita", "rezar", "religion", "politica", "elecciones",
    "ministro", "gobierno", "morir", "muerte", "funeral", "divorcio", "despido", "carcel", "matar", "sexo", "sexy", "sexual", "porno",
    "desnudo", "desnuda", "droga", "drogas", "porro", "racista"],
};
/** Banned in `ageRating: "all"` packs only: romance and alcohol (§11.1 "Family"). */
export const BANNED_FAMILY: Terms = {
  en: ["kiss", "kissing", "flirt", "flirting", "crush", "dating", "date night", "boyfriend", "girlfriend", "ex", "romance", "romantic",
    "drunk", "beer", "wine", "vodka", "whisky", "alcohol", "arak", "hangover", "shots"],
  fr: ["embrasser", "bisou", "draguer", "drague", "beguin", "rencard", "amoureux", "amoureuse", "copain", "copine", "ivre", "biere", "vin",
    "vodka", "whisky", "alcool", "arak", "gueule de bois"],
  ar: ["يبوس", "بوسة", "يغازل", "غزل", "مغروم", "حبيبتو", "حبيبو", "سكران", "بيرة", "نبيد", "كحول", "ويسكي", "فودكا"],
  es: ["besar", "beso", "ligar", "ligue", "crush", "novio", "novia", "borracho", "borracha", "cerveza", "vino", "chupito", "alcohol", "resaca"],
};
/** Banned in the Spicy pack on top of BANNED_ALL (§11.1): explicit acts and body parts, ranking bodies, cheating, control. */
export const BANNED_SPICY: Terms = {
  en: ["bed", "undress", "lingerie", "tongue", "breast", "breasts", "butt", "chest", "hottest", "hot", "best body", "cheat on", "cheating",
    "affair", "jealous", "go through their phone", "drunk", "hangover", "one night stand", "hookup"],
  fr: ["lit", "deshabiller", "lingerie", "langue", "sein", "seins", "fesses", "le plus beau", "la plus belle", "tromper", "infidele", "jaloux",
    "jalouse", "fouiller son telephone", "ivre", "coucher avec", "plan cul"],
  ar: ["تخت", "يشلح", "صدر", "طيز", "أحلى جسم", "يخون", "خيانة", "يغار", "غيرة", "سكران"],
  es: ["cama", "desnudar", "lenceria", "lengua", "pecho", "pechos", "culo", "el mas guapo", "la mas guapa", "enganar", "infiel", "celos",
    "celoso", "celosa", "borracho", "borracha", "rollo de una noche"],
};
/** Review flags (§11.1): reported as warnings, a human decides. */
export const REVIEW_FLAGS: Terms = {
  en: ["diet", "weight", "salary", "pay", "paycheck", "broke", "emigrate", "abroad", "mum", "mom", "mother", "dad", "father"],
  fr: ["regime", "poids", "salaire", "paie", "fauche", "emigrer", "etranger", "maman", "mere", "papa", "pere"],
  ar: ["ريجيم", "وزن", "معاش", "هاجر", "يهاجر", "برّا", "إمّ", "إمو", "ماما", "بيّ", "بيّو", "بابا"],
  es: ["dieta", "peso", "sueldo", "salario", "nomina", "emigrar", "extranjero", "mama", "madre", "papa", "padre"],
};
/** House rule (owner): no party-game brand names in our content. */
export const BRAND_DENYLIST: readonly string[] = ["jackbox", "quiplash", "fibbage", "drawful", "kahoot", "top chef", "masterchef", "master chef"];

/**
 * House rule (FR elision): `{player}` is a display name pasted at draw time, so it must not follow a word that elides
 * before a vowel or mute h (« de Alex », « que Imane », « le sweat de Omar »). Put the name after « à », « avec », « pour »…
 */
export const FR_ELIDING_BEFORE_PLAYER = /(?<!\p{L})(?:de|que|le|la|je|me|te|se|ne)\s+\{player\}/iu;
/** House rule (AR grammar, §11.2): a verb right after `{player}` is conjugated for that player (masculine by default). */
export const AR_VERB_AFTER_PLAYER = /\{player\}\s+(?:عم\s+)?ب?ي\p{L}/u;
/** House rule (AR digits): cards use Western digits like the UI ("50%", "4 / 12"), not Eastern Arabic ones. */
export const AR_EASTERN_DIGITS = /[٠-٩٪]/u;

const TASHKEEL = /[ً-ْٰـ]/gu;
const EMOJI = /\p{Extended_Pictographic}/u;
const AR_CLITICS = ["وال", "بال", "عال", "فال", "لل", "ال", "و", "ف", "ب", "ل", "ع"];

/** Lower-case, accent-free (Latin) or tashkeel-free (Arabic) text with every non-letter run collapsed to one space. */
export function normalizeText(s: string): string {
  return ` ${s.normalize("NFKD").replace(/\p{M}/gu, "").replace(TASHKEEL, "").toLowerCase().replace(/\{player\}/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}
const arVariants = (tok: string): string[] => {
  const out = [tok];
  for (const p of AR_CLITICS) if (tok.startsWith(p) && [...tok].length - [...p].length >= 2) out.push(tok.slice(p.length));
  return out;
};

/** The terms of `list` found in `text` (whole tokens; phrases as substrings of the normalised text). */
export function findTerms(text: string, list: readonly string[]): string[] {
  const norm = normalizeText(text);
  const toks = new Set(norm.trim().split(" ").flatMap(arVariants));
  const hits: string[] = [];
  for (const term of list) {
    const t = normalizeText(term).trim();
    if (t === "") continue;
    if (t.includes(" ") ? norm.includes(` ${t} `) : toks.has(t)) hits.push(term);
  }
  return hits;
}

const graphemes = (s: string): number => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;
const count = (s: string, needle: string): number => s.split(needle).length - 1;
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (o: unknown, k: string): string | undefined => (isObj(o) && typeof o[k] === "string" ? (o[k] as string) : undefined);

interface Card {
  id: string; tier: string; spice: number; namesPlayer: boolean; tags: string[];
  prompt: Partial<Record<LikelyLocale, string>>; award: Partial<Record<LikelyLocale, string>>; review: string;
}
interface Pack { id: string; ageRating: string; locales: LikelyLocale[]; cards: Card[] }

/** The fields the rules read, from raw JSON (the adapter already rejected malformed packs in the CLI path). */
function readPack(raw: unknown, file: string, c: Findings): Pack | null {
  if (!isObj(raw) || !Array.isArray(raw.cards)) {
    c.errors.push(`${file}: not a Likely pack (no cards array)`);
    return null;
  }
  const locales = (Array.isArray(raw.locales) ? raw.locales : ["en", "fr", "ar"]).filter((l): l is LikelyLocale => (LIKELY_LOCALES as readonly unknown[]).includes(l));
  const cards: Card[] = [];
  for (const x of raw.cards as unknown[]) {
    if (!isObj(x)) continue;
    const loc = (o: unknown): Partial<Record<LikelyLocale, string>> => Object.fromEntries(LIKELY_LOCALES.flatMap((l) => (str(o, l) !== undefined ? [[l, str(o, l) as string]] : [])));
    cards.push({
      id: String(x.id), tier: String(x.tier), spice: typeof x.spice === "number" ? x.spice : -1, namesPlayer: x.namesPlayer === true,
      tags: Array.isArray(x.tags) ? x.tags.map(String) : [], prompt: loc(x.prompt), award: loc(x.award), review: str(x.review, "status") ?? "draft",
    });
  }
  return { id: String(raw.id), ageRating: String(raw.ageRating), locales, cards };
}

function lintText(s: string, l: LikelyLocale, at: string, adult: boolean, c: Findings): void {
  for (const t of findTerms(s, BANNED_ALL[l])) c.errors.push(`${at}: "${t}" is banned in every pack (§11.1)`);
  for (const t of findTerms(s, adult ? BANNED_SPICY[l] : BANNED_FAMILY[l])) c.errors.push(`${at}: "${t}" is banned in ${adult ? "the Spicy pack" : "a Family pack"} (§11.1)`);
  for (const t of findTerms(s, REVIEW_FLAGS[l])) c.warnings.push(`${at}: review flag "${t}" (§11.1: a human decides)`);
  for (const t of findTerms(s, BRAND_DENYLIST)) c.errors.push(`${at}: brand name "${t}" (house rule: original content only)`);
  if (l !== "ar") {
    // Hyphenated compounds are one word here ("pique-nique" is a picnic, not two tokens).
    const bad = profaneTokens(s.replace(/(\p{L})-(\p{L})/gu, "$1$2"), [l]);
    if (bad.length > 0) c.errors.push(`${at}: blocked word (${bad.join(", ")})`);
  }
  if (EMOJI.test(s)) c.errors.push(`${at}: no emoji in card text (the TV font has none)`);
  if (s !== s.trim() || /\s{2,}/u.test(s.replace(/[\u00a0\u202f]/gu, "x"))) c.errors.push(`${at}: stray whitespace`);
}

/** Every Likely rule over raw packs. `file` is the path relative to the content root. */
export function lintLikelyRaw(entries: readonly { file: string; raw: unknown }[], opts: { release?: boolean } = {}): Findings {
  const c: Findings = { errors: [], warnings: [] };
  const seenIds = new Map<string, string>();
  const seenPrompts = new Map<string, string>(); // `${loc}|${normalised prompt}` across every Likely pack
  for (const { file, raw } of entries) {
    const pack = readPack(raw, file, c);
    if (!pack) continue;
    const P = pack.id;
    const adult = pack.ageRating === "adult";
    const awardsSeen = new Map<string, string>();
    let freeDrafts = 0;
    for (const card of pack.cards) {
      const at = `${P}/${card.id}`;
      const prev = seenIds.get(card.id);
      if (prev !== undefined) c.errors.push(`${at}: card id is also used in ${prev} (ids are unique across Likely packs)`);
      else seenIds.set(card.id, P);
      // §9.1 rule 5 / §11.2: family stays family; the adult pack is all spice ≥ 1; named cards are Spicy only.
      if (!adult && (card.spice !== 0 || card.namesPlayer)) c.errors.push(`${at}: spice ${card.spice}${card.namesPlayer ? ", names a player" : ""} in an "all" pack`);
      if (adult && card.spice < 1) c.errors.push(`${at}: spice 0 in an "adult" pack`);
      if (!adult && card.tags.includes("romance")) c.errors.push(`${at}: the romance tag is for Spicy cards only`);
      if (adult && card.tier === "free") c.errors.push(`${at}: an adult card is never free (the Spicy pack is Pass-only, §11.4)`);
      if (card.tier === "free" && card.review === "draft") {
        freeDrafts += 1;
        // Same choice as Bluff (SPEC-GAP): a draft free card is an error only at the ship gate.
        if (opts.release) c.errors.push(`${at}: a free card must be native-reviewed before release (review.status is "draft")`);
      }
      for (const l of pack.locales) {
        const p = card.prompt[l];
        const a = card.award[l];
        if (p === undefined || a === undefined) {
          c.errors.push(`${at}: the pack lists ${l}, so prompt.${l} and award.${l} are required`);
          continue;
        }
        if (graphemes(p) > MAX_GRAPHEMES[l]) c.errors.push(`${at}: prompt.${l} is ${graphemes(p)} graphemes (max ${MAX_GRAPHEMES[l]})`);
        if (count(p, PLAYER) !== (card.namesPlayer ? 1 : 0)) c.errors.push(`${at}: prompt.${l} must contain {player} ${card.namesPlayer ? "exactly once" : "nowhere"}`);
        if (a.includes(PLAYER)) c.errors.push(`${at}: award.${l} must not contain {player}`);
        if (/[?.!…:;,]\s*$/u.test(p)) c.errors.push(`${at}: prompt.${l} ends with punctuation (the header supplies the "?")`);
        if (!AWARD_SHAPE[l].test(a)) c.errors.push(`${at}: award.${l} "${a}" must be an award title that ${AWARD_SHAPE[l].rule}`);
        if (l === "en") {
          if (!/^[\p{Ll}0-9]/u.test(p)) c.errors.push(`${at}: prompt.en must start with a lowercase letter or a digit`);
          if (/^to\s/iu.test(p)) c.errors.push(`${at}: prompt.en must not start with "to " (the header ends with "to…")`);
        }
        if (l === "fr" && !/^(de |d'|d’)/u.test(p)) c.errors.push(`${at}: prompt.fr must start with "de " or "d'" (it completes « Qui risque le plus… »)`);
        if (l === "fr" && FR_ELIDING_BEFORE_PLAYER.test(p)) c.errors.push(`${at}: prompt.fr puts {player} after a word that elides before a vowel (« de Alex »): use « à {player} », « avec {player} »…`);
        if (l === "ar" && p.includes("مين")) c.errors.push(`${at}: prompt.ar must not contain «مين» (the header already has it)`);
        if (l === "ar" && AR_VERB_AFTER_PLAYER.test(p)) c.warnings.push(`${at}: prompt.ar has a verb right after {player}, conjugated for that player's gender (reword so {player} is an object)`);
        if (l === "ar" && (AR_EASTERN_DIGITS.test(p) || AR_EASTERN_DIGITS.test(a))) c.warnings.push(`${at}: Eastern Arabic digits in prompt.ar or award.ar (cards use Western digits, like the UI)`);
        if (l === "es" && /^(que |de )/u.test(p)) c.errors.push(`${at}: prompt.es is an infinitive phrase (it completes "¿Quién es más capaz de…?")`);
        lintText(p, l, `${at} prompt.${l}`, adult, c);
        lintText(a, l, `${at} award.${l}`, adult, c);
        const key = `${l}|${normalizeText(p)}`;
        const dup = seenPrompts.get(key);
        if (dup !== undefined) c.errors.push(`${at}: prompt.${l} duplicates ${dup}`);
        else seenPrompts.set(key, at);
        const ak = normalizeText(a);
        const adup = awardsSeen.get(`${l}|${ak}`);
        if (adup !== undefined) c.warnings.push(`${at}: award.${l} "${a}" is also ${adup}'s award (an award names one card)`);
        else awardsSeen.set(`${l}|${ak}`, card.id);
      }
    }
    const n = pack.cards.length;
    if (adult) {
      const named = pack.cards.filter((x) => x.namesPlayer).length;
      if (named > MAX_NAMED_SHARE * n) c.errors.push(`${P}: ${named}/${n} cards name a player (max ${MAX_NAMED_SHARE * 100} %, §11.2)`);
      if (n < SPICY_LAUNCH_CARDS) c.warnings.push(`${P}: ${n} cards (the Spicy pack launches with ${SPICY_LAUNCH_CARDS}, §11.4)`);
    } else {
      const free = pack.cards.filter((x) => x.tier === "free").length;
      if (free < MIN_FREE_SHARE * n) c.errors.push(`${P}: ${free}/${n} cards are free (at least ${MIN_FREE_SHARE * 100} %, §11.2)`);
      if (free > 0 && free < MIN_FREE_CARDS) c.errors.push(`${P}: ${free} free cards (a free room needs ${MIN_FREE_CARDS} to play Long twice, §11.2)`);
      const openers = pack.cards.filter((x) => x.tier === "free" && (x.tags.includes("party") || x.tags.includes("habits"))).length;
      if (free > 0 && openers < 3) c.warnings.push(`${P}: only ${openers} free party/habits cards (the first card of a game is drawn from them, §11.3)`);
    }
    if (freeDrafts > 0 && !opts.release) c.warnings.push(`${P}: ${freeDrafts} free card(s) still "draft" (native review needed before release)`);
  }
  return c;
}

export const lint: GameLint = (packs: readonly ParsedPack[], opts) => lintLikelyRaw(packs.map((p) => ({ file: p.file, raw: p.raw })), opts);
