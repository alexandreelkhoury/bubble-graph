// Bluff content rules (GAME-BLUFF §11.2, §11.3; JAMAA-PLATFORM §5.5). Owned by the G2 lane D.
//
// The structural check below mirrors the §11.3 zod schema on the raw JSON, so these rules also run (through `lintBluffRaw`,
// used by content/bluff/test) while the platform adapter is still being written; `lint` is the GameLint hook the common
// pass calls with the packs its ContentAdapter accepted; it also checks the Bluff i18n phase names. Pure: no I/O (the
// i18n dictionaries are static imports).
import { BLUFF_META } from "@jamaa/shared/games/bluff/meta";
import bluffAr from "@jamaa/shared/i18n/games/bluff/ar.json";
import bluffEn from "@jamaa/shared/i18n/games/bluff/en.json";
import bluffEs from "@jamaa/shared/i18n/games/bluff/es.json";
import bluffFr from "@jamaa/shared/i18n/games/bluff/fr.json";
import { profaneTokens } from "../lint";
import type { Findings } from "../platform";
import type { GameLint, ParsedPack } from "./types";

export const BLUFF_LOCALES = ["en", "fr", "ar", "es"] as const;
export type BluffLocale = (typeof BLUFF_LOCALES)[number];
export const BLUFF_TYPES = ["proverb_end", "fact_blank", "word_meaning", "expression_meaning", "no_truth"] as const;
export type BluffType = (typeof BLUFF_TYPES)[number];
/** GAME-BLUFF §11.1 (the shared constant lives in the engine; repeated here so the lint has no engine dependency). */
export const ROUND_OF_TYPE: Readonly<Record<BluffType, 1 | 2 | 3>> = { proverb_end: 1, fact_blank: 2, word_meaning: 2, expression_meaning: 2, no_truth: 3 };

/** §3: a Normal game has 3 + 3 prompts plus the final; a free room must be able to play one from a single pack. */
export const NORMAL_GAME_PROMPTS = 7;
export const ANSWER_MAX_GRAPHEMES = 60;
export const ANSWER_SOFT_MAX_GRAPHEMES = 50;
export const MIN_FREE_SHARE = 0.3;
export const ONE_WORD_MAX_SHARE = 0.4;
export const TRUTH_PACK_MIN_ITEMS = 20;

/** §11.2 rule 9: famous "fun facts" that are myths. Matched on the normalised prompt + truth of fact items. */
export const MYTH_DENYLIST: readonly string[] = [
  "goldfish memory", "three second memory", "3 second memory", "great wall visible from space", "visible from space",
  "we only use 10 percent", "10 of our brain", "lightning never strikes twice", "bulls hate red", "ostriches bury",
  "napoleon was short", "vikings wore horned", "chameleons change colour to match", "swallow spiders in your sleep",
  "mémoire de trois secondes", "mémoire de 3 secondes", "muraille de chine visible", "10 de notre cerveau",
  "memoria de tres segundos", "memoria de 3 segundos", "muralla china se ve", "10 del cerebro",
];
/** Owner rule: nothing from Jackbox (names) or other party-game brands in our content. */
export const BRAND_DENYLIST: readonly string[] = ["jackbox", "fibbage", "quiplash", "drawful", "trivia murder", "balderdash", "you don't know jack", "psych!", "kahoot"];
/** §11.2 rule 4 (v1): no God, religion, politics, war in any text. A small, conservative token list per script. */
export const SENSITIVE_TOKENS: readonly string[] = [
  "god", "allah", "jesus", "christ", "church", "mosque", "dieu", "eglise", "mosquee", "dios", "iglesia", "mezquita",
  "الله", "ربنا", "الرب", "يسوع", "جامع", "كنيسة", "hezbollah", "حزب", "war", "guerre", "guerra", "حرب", "israel", "اسرائيل",
];

const TASHKEEL = /[ً-ٰٟـ]/u; // tashkeel incl. shadda, superscript alef, tatweel
const TYPO_QUOTES = /[«»“”‘’„]/u;
const TRAILING = /[.!…]\s*$/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const ARABIC = /\p{Script=Arabic}/u;
const LATIN = /\p{Script=Latin}/u;

const graphemes = (s: string): number => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isLoc = (v: unknown): v is BluffLocale => typeof v === "string" && (BLUFF_LOCALES as readonly string[]).includes(v);

// ---------------------------------------------------------------------------------------------------------------------
// Answer normalisation (GAME-BLUFF §5.2 `normalizeAnswer`, §5.3 collisions). A self-contained copy for the lint: the
// engine's `similar.ts` is the authority at play time; this one only needs to flag authored collisions.

const AR_MAP: Record<string, string> = { "ٱ": "ا", "ى": "ي", "ی": "ي", "ة": "ه", "ک": "ك", "ء": "" };
const STOP = new Set([
  "the", "a", "an", "of", "to", "and", "is", "it",
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "et", "d", "qu", "que", "est", "en", "au", "aux", "il", "elle", "on",
  "el", "los", "las", "una", "y", "del", "al", "se", "es", "lo", "no",
]);

/** Normalised tokens of an answer (accents and Arabic letter variants folded, stop words and leading ال/و/ف dropped). */
export function answerTokens(input: string): string[] {
  let s = input.replace(/[¿¡]/g, " ").replace(/\b(l|d|qu)['’]/giu, "$1 ");
  s = s.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ـ/g, "").toLowerCase();
  s = s.replace(/[œæß]/g, (c) => ({ "œ": "oe", "æ": "ae", "ß": "ss" })[c] as string);
  s = s.replace(/[ٱىیةکء]/g, (c) => AR_MAP[c] as string);
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let toks = s.split(" ").filter(Boolean);
  if (toks.length > 1) {
    const f = toks.filter((t) => !STOP.has(t));
    if (f.length) toks = f;
  }
  return toks.map((t) => {
    let x = t.startsWith("ال") && [...t].length >= 4 ? t.slice(2) : t;
    if (/^[وف]/u.test(x) && [...x].length >= 4) {
      x = x.slice(1);
      if (x.startsWith("ال") && [...x].length >= 4) x = x.slice(2);
    }
    return x;
  });
}
export const normalizeAnswer = (s: string): string => answerTokens(s).join("");

export function levenshtein(a: string, b: string): number {
  const x = [...a], y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length] as number;
}
const cp = (s: string): number => [...s].length;

/** §5.3: two answers collide (merged into one option at play time). */
export function collides(a: string, b: string): boolean {
  const A = normalizeAnswer(a), B = normalizeAnswer(b);
  if (A === "" || B === "") return false;
  if (A === B) return true;
  return Math.min(cp(A), cp(B)) >= 5 && levenshtein(A, B) / Math.max(cp(A), cp(B)) <= 0.1;
}

/** §5.2 `isTooClose` (rules 1–5), used to warn when an authored house lie would be rejected as "too close" if typed. */
export function tooClose(lie: string, truth: string): boolean {
  const L = normalizeAnswer(lie), T = normalizeAnswer(truth);
  if (L === "" || T === "") return false;
  if (L === T) return true;
  if (cp(T) < 5 ? levenshtein(L, T) <= 1 : Math.min(cp(L), cp(T)) >= 5 && levenshtein(L, T) / Math.max(cp(L), cp(T)) <= 0.2) return true;
  if (cp(T) >= 4 && L.includes(T) && cp(T) / cp(L) >= 0.6) return true;
  const lt = answerTokens(lie), tt = answerTokens(truth);
  const ls = new Set(lt), ts = new Set(tt);
  if (tt.length >= 3) {
    const inter = [...ts].filter((t) => ls.has(t)).length;
    if (inter / new Set([...ls, ...ts]).size >= 0.75) return true;
  }
  if (tt.length <= 3) {
    const match = (t: string): boolean => lt.some((l) => l === t || (cp(t) >= 4 && levenshtein(l, t) <= 1));
    if (tt.every(match)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Structure (§11.3 schema, mirrored).

interface Ctx { errors: string[]; warnings: string[] }

const PACK_KEYS = ["schemaVersion", "id", "game", "title", "description", "sourceLocale", "playableIn", "ageRating", "fallbackHouseLies", "items"];
const ITEM_KEYS = ["id", "type", "tier", "difficulty", "knownIn", "prompt", "truth", "truthAlt", "houseLies", "note", "review"];
const PROMPT_KEYS = ["original", "translit", "display"];

function strictKeys(o: Record<string, unknown>, allowed: readonly string[], at: string, c: Ctx): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) c.errors.push(`${at}: unknown key "${k}"`);
}

function locText(v: unknown, at: string, max: number, c: Ctx, min = 1): Partial<Record<BluffLocale, string>> {
  if (!isObj(v)) {
    c.errors.push(`${at}: must be an object keyed by locale`);
    return {};
  }
  const out: Partial<Record<BluffLocale, string>> = {};
  for (const [k, s] of Object.entries(v)) {
    if (!isLoc(k)) c.errors.push(`${at}: unknown locale "${k}"`);
    else if (typeof s !== "string" || s.length < min || s.length > max) c.errors.push(`${at}.${k}: must be a string of ${min}–${max} characters`);
    else out[k] = s;
  }
  return out;
}

function locList(v: unknown, at: string, c: Ctx): Partial<Record<BluffLocale, string[]>> {
  if (!isObj(v)) {
    c.errors.push(`${at}: must be an object keyed by locale`);
    return {};
  }
  const out: Partial<Record<BluffLocale, string[]>> = {};
  for (const [k, list] of Object.entries(v)) {
    if (!isLoc(k)) c.errors.push(`${at}: unknown locale "${k}"`);
    else if (!Array.isArray(list) || list.some((s) => typeof s !== "string" || s.length < 1 || s.length > ANSWER_MAX_GRAPHEMES)) c.errors.push(`${at}.${k}: must be an array of 1–60 character strings`);
    else out[k] = list as string[];
  }
  return out;
}

export interface BluffItem {
  id: string; type: BluffType; tier: "free" | "pass"; difficulty: 1 | 2 | 3; knownIn: BluffLocale[];
  prompt: { original: string; translit: string | null; display: Partial<Record<BluffLocale, string>> };
  truth: Partial<Record<BluffLocale, string>>; truthAlt: Partial<Record<BluffLocale, string[]>>;
  houseLies: Partial<Record<BluffLocale, string[]>>; note: Partial<Record<BluffLocale, string>>;
  review: { status: "draft" | "native-reviewed" | "verified"; source: string | null };
}
export interface BluffPack {
  id: string; title: Record<string, string>; description: Record<string, string>; sourceLocale: BluffLocale;
  playableIn: BluffLocale[]; ageRating: "all" | "teen"; items: BluffItem[];
}

/** Checks the §11.3 shape; returns the typed pack (possibly partial) or null when it is unusable. */
export function checkStructure(raw: unknown, at: string, c: Ctx): BluffPack | null {
  if (!isObj(raw)) {
    c.errors.push(`${at}: a pack must be a JSON object`);
    return null;
  }
  strictKeys(raw, PACK_KEYS, at, c);
  if (raw.schemaVersion !== 1) c.errors.push(`${at}: schemaVersion must be 1`);
  if (typeof raw.id !== "string" || !/^[a-z0-9-]{1,35}$/.test(raw.id)) c.errors.push(`${at}: id must match ^[a-z0-9-]{1,35}$`);
  if (raw.game !== "bluff") c.errors.push(`${at}: game must be "bluff"`);
  for (const f of ["title", "description"] as const) {
    const v = raw[f];
    if (!isObj(v)) c.errors.push(`${at}: ${f} must be an object`);
    else {
      strictKeys(v, BLUFF_LOCALES, `${at}.${f}`, c);
      for (const l of ["en", "fr", "ar"]) if (typeof v[l] !== "string") c.errors.push(`${at}.${f}.${l}: required`);
      if (f === "description") for (const [l, s] of Object.entries(v)) if (typeof s === "string" && s.length > 140) c.warnings.push(`${at}.${f}.${l}: longer than 140 characters (PackMeta description limit)`);
    }
  }
  if (!isLoc(raw.sourceLocale)) c.errors.push(`${at}: sourceLocale must be one of ${BLUFF_LOCALES.join(", ")}`);
  if (!Array.isArray(raw.playableIn) || raw.playableIn.length === 0 || !raw.playableIn.every(isLoc)) c.errors.push(`${at}: playableIn must be a non-empty array of locales`);
  else if (new Set(raw.playableIn).size !== raw.playableIn.length) c.errors.push(`${at}: playableIn lists a locale twice`);
  if (raw.ageRating !== "all" && raw.ageRating !== "teen") c.errors.push(`${at}: ageRating must be "all" or "teen"`);
  if (!isObj(raw.fallbackHouseLies)) c.errors.push(`${at}: fallbackHouseLies must be an object`);
  else for (const [t, v] of Object.entries(raw.fallbackHouseLies)) {
    if (!(BLUFF_TYPES as readonly string[]).includes(t)) c.errors.push(`${at}.fallbackHouseLies: unknown type "${t}"`);
    locList(v, `${at}.fallbackHouseLies.${t}`, c);
  }
  if (!Array.isArray(raw.items)) {
    c.errors.push(`${at}: items must be an array`);
    return null;
  }
  if (raw.items.length < 12) c.errors.push(`${at}: at least 12 items are required (found ${raw.items.length})`);
  const items: BluffItem[] = [];
  raw.items.forEach((it, i) => {
    const where = `${at}/${isObj(it) && typeof it.id === "string" ? it.id : `#${i}`}`;
    if (!isObj(it)) {
      c.errors.push(`${where}: an item must be an object`);
      return;
    }
    const n = c.errors.length;
    strictKeys(it, ITEM_KEYS, where, c);
    if (typeof it.id !== "string" || !/^[a-z0-9-]{3,40}$/.test(it.id)) c.errors.push(`${where}: id must match ^[a-z0-9-]{3,40}$`);
    if (!(BLUFF_TYPES as readonly string[]).includes(it.type as string)) c.errors.push(`${where}: unknown type ${String(it.type)}`);
    if (it.tier !== "free" && it.tier !== "pass") c.errors.push(`${where}: tier must be "free" or "pass"`);
    if (it.difficulty !== 1 && it.difficulty !== 2 && it.difficulty !== 3) c.errors.push(`${where}: difficulty must be 1, 2 or 3`);
    const knownIn = it.knownIn ?? [];
    if (!Array.isArray(knownIn) || !knownIn.every(isLoc)) c.errors.push(`${where}: knownIn must be an array of locales`);
    let prompt: BluffItem["prompt"] = { original: "", translit: null, display: {} };
    if (!isObj(it.prompt)) c.errors.push(`${where}: prompt must be an object`);
    else {
      strictKeys(it.prompt, PROMPT_KEYS, `${where}.prompt`, c);
      const p = it.prompt;
      if (typeof p.original !== "string" || p.original.length < 1 || p.original.length > 120) c.errors.push(`${where}.prompt.original: must be 1–120 characters`);
      if (p.translit !== null && (typeof p.translit !== "string" || p.translit.length > 160)) c.errors.push(`${where}.prompt.translit: must be null or ≤ 160 characters`);
      prompt = { original: String(p.original ?? ""), translit: typeof p.translit === "string" ? p.translit : null, display: locText(p.display, `${where}.prompt.display`, 160, c, 0) };
    }
    const truth = locText(it.truth, `${where}.truth`, ANSWER_MAX_GRAPHEMES, c);
    const truthAlt = locList(it.truthAlt, `${where}.truthAlt`, c);
    const houseLies = locList(it.houseLies, `${where}.houseLies`, c);
    const note = locText(it.note, `${where}.note`, 140, c, 0);
    let review: BluffItem["review"] = { status: "draft", source: null };
    if (!isObj(it.review)) c.errors.push(`${where}: review must be an object`);
    else {
      strictKeys(it.review, ["status", "source"], `${where}.review`, c);
      const st = it.review.status;
      if (st !== "draft" && st !== "native-reviewed" && st !== "verified") c.errors.push(`${where}.review.status: must be draft, native-reviewed or verified`);
      const src = it.review.source;
      if (src !== null && (typeof src !== "string" || src.length < 1)) c.errors.push(`${where}.review.source: must be null or a non-empty string`);
      review = { status: st as BluffItem["review"]["status"], source: typeof src === "string" ? src : null };
    }
    const hasTruth = Object.keys(truth).length > 0;
    if (it.type === "no_truth") {
      if (hasTruth || Object.keys(truthAlt).length > 0) c.errors.push(`${where}: no_truth items have no truth`);
      if (Array.isArray(knownIn) && knownIn.length > 0) c.errors.push(`${where}: knownIn is meaningless without a truth`);
    } else if (!hasTruth) c.errors.push(`${where}: truth required`);
    if (c.errors.length === n) items.push({ id: it.id as string, type: it.type as BluffType, tier: it.tier as "free" | "pass", difficulty: it.difficulty as 1 | 2 | 3, knownIn: knownIn as BluffLocale[], prompt, truth, truthAlt, houseLies, note, review });
  });
  if (!isLoc(raw.sourceLocale) || !Array.isArray(raw.playableIn) || !raw.playableIn.every(isLoc)) return null;
  return { id: String(raw.id), title: (raw.title ?? {}) as Record<string, string>, description: (raw.description ?? {}) as Record<string, string>, sourceLocale: raw.sourceLocale, playableIn: raw.playableIn, ageRating: raw.ageRating === "teen" ? "teen" : "all", items };
}

// ---------------------------------------------------------------------------------------------------------------------
// Rules (§11.3 lint list, §11.2 writing guide).

const norm = (s: string): string => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const tokensOf = (s: string): Set<string> => new Set(norm(s).split(" ").filter(Boolean));

function answerShape(s: string, loc: BluffLocale, at: string, c: Ctx): void {
  if (TASHKEEL.test(s)) c.errors.push(`${at}: "${s}" has Arabic tashkeel or tatweel (players never type them)`);
  if (TYPO_QUOTES.test(s)) c.errors.push(`${at}: "${s}" has guillemets or typographic quotes`);
  if (TRAILING.test(s)) c.errors.push(`${at}: "${s}" ends with . ! or …`);
  if (EMOJI.test(s)) c.errors.push(`${at}: "${s}" has an emoji`);
  if (s !== s.trim() || /\s{2,}/u.test(s)) c.errors.push(`${at}: "${s}" has stray spaces`);
  const g = graphemes(s);
  if (g > ANSWER_MAX_GRAPHEMES) c.errors.push(`${at}: "${s}" is ${g} graphemes (max ${ANSWER_MAX_GRAPHEMES})`);
  else if (g > ANSWER_SOFT_MAX_GRAPHEMES) c.warnings.push(`${at}: "${s}" is ${g} graphemes (aim for ≤ ${ANSWER_SOFT_MAX_GRAPHEMES})`);
  if ((s.match(/\p{L}/gu) ?? []).length < 2) c.errors.push(`${at}: "${s}" needs at least 2 letters (players' lies do)`);
  if (loc === "ar") {
    if (!ARABIC.test(s)) c.errors.push(`${at}: "${s}" has no Arabic letter (an AR room rejects such a lie, so it would stand out)`);
  } else {
    if (!LATIN.test(s)) c.errors.push(`${at}: "${s}" has no Latin letter (a ${loc} room rejects such a lie, so it would stand out)`);
    const first = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)][0]?.segment ?? "";
    if (first !== first.toLocaleUpperCase(loc)) c.errors.push(`${at}: "${s}" must start with a capital (sentence case, §5.1 display rule)`);
  }
}

function textHits(s: string, at: string, loc: BluffLocale | "any", c: Ctx): void {
  const n = ` ${norm(s)} `;
  for (const b of BRAND_DENYLIST) if (n.includes(` ${norm(b)} `)) c.errors.push(`${at}: mentions "${b}" (no other game's names in our content)`);
  const toks = tokensOf(s);
  for (const w of SENSITIVE_TOKENS) if (toks.has(norm(w))) c.errors.push(`${at}: "${w}" (religion/politics/war are out of scope in v1, §11.2 rule 4)`);
  const langs: ("en" | "fr" | "es")[] = loc === "fr" ? ["fr", "en"] : loc === "es" ? ["es", "en"] : loc === "en" ? ["en"] : ["en", "fr", "es"];
  const bad = profaneTokens(s, langs);
  if (bad.length > 0) c.errors.push(`${at}: "${s}" contains a blocked word (${bad.join(", ")}); packs are family-friendly`);
}

/** Every Bluff rule over raw packs (structure included). `files` are paths relative to the content root. */
export function lintBluffRaw(entries: readonly { file: string; raw: unknown }[], opts: { release?: boolean } = {}): Findings {
  const c: Ctx = { errors: [], warnings: [] };
  const itemIds = new Map<string, string>();
  const truthsSeen = new Map<string, string>(); // `${loc}|${normalised prompt}` → where (same prompt twice across packs)
  for (const { file, raw } of entries) {
    const pack = checkStructure(raw, file, c);
    if (!pack) continue;
    const P = pack.id;
    const playable = pack.playableIn;
    for (const l of playable) {
      if (typeof pack.title[l] !== "string" || pack.title[l] === "") c.errors.push(`${P}: title.${l} is required (${l} is playable)`);
      if (typeof pack.description[l] !== "string" || pack.description[l] === "") c.errors.push(`${P}: description.${l} is required (${l} is playable)`);
    }
    if (pack.ageRating !== "all") c.warnings.push(`${P}: ageRating "${pack.ageRating}" (every launch pack is "all", §9)`);
    const types = new Set(pack.items.map((i) => i.type));
    if (types.has("no_truth") && types.size > 1) c.errors.push(`${P}: a pack with no_truth items must have only no_truth items`);
    if (!types.has("no_truth") && pack.items.length < TRUTH_PACK_MIN_ITEMS) c.warnings.push(`${P}: ${pack.items.length} items (aim for at least ${TRUTH_PACK_MIN_ITEMS})`);
    const free = pack.items.filter((i) => i.tier === "free");
    if (free.length < Math.ceil(pack.items.length * MIN_FREE_SHARE)) c.errors.push(`${P}: ${free.length}/${pack.items.length} items are free (at least ${MIN_FREE_SHARE * 100} %)`);
    for (const l of playable) {
      const n = free.filter((i) => !i.knownIn.includes(l)).length;
      if (n < NORMAL_GAME_PROMPTS) c.errors.push(`${P}: only ${n} free items not knownIn "${l}" (a free ${l} room needs ≥ ${NORMAL_GAME_PROMPTS})`);
    }
    const truthItems = pack.items.filter((i) => i.type !== "no_truth");
    if (truthItems.length > 0) {
      const src = truthItems.filter((i) => i.truth[pack.sourceLocale] !== undefined);
      const oneWord = src.filter((i) => answerTokens(i.truth[pack.sourceLocale] as string).length <= 1 && !/\s/.test((i.truth[pack.sourceLocale] as string).trim())).length;
      if (src.length > 0 && oneWord / src.length > ONE_WORD_MAX_SHARE) c.warnings.push(`${P}: ${oneWord}/${src.length} truths are one word (keep it ≤ ${ONE_WORD_MAX_SHARE * 100} %, §11.2 rule 7)`);
    }

    for (const it of pack.items) {
      const at = `${P}/${it.id}`;
      const prev = itemIds.get(it.id);
      if (prev !== undefined) c.errors.push(`${at}: item id is also used in ${prev} (ids are unique across all Bluff packs)`);
      else itemIds.set(it.id, P);

      // Prompt shape.
      const o = it.prompt.original;
      if (it.type === "proverb_end" && !/…$/u.test(o)) c.errors.push(`${at}: a proverb_end prompt ends with "…"`);
      if (it.type === "fact_blank" && !o.includes("___")) c.errors.push(`${at}: a fact_blank prompt has a ___ blank`);
      if (it.prompt.display[pack.sourceLocale] !== undefined) c.warnings.push(`${at}: prompt.display.${pack.sourceLocale} repeats the source locale (omit it)`);
      for (const l of playable) {
        if (l === pack.sourceLocale) continue;
        const d = it.prompt.display[l];
        if (d === undefined || d === "") c.errors.push(`${at}: prompt.display.${l} is required (${l} is playable)`);
        else {
          if (it.type === "proverb_end" && !/…$/u.test(d)) c.errors.push(`${at}: prompt.display.${l} ends with "…"`);
          if (it.type === "fact_blank" && !d.includes("___")) c.errors.push(`${at}: prompt.display.${l} has a ___ blank`);
        }
      }
      if (pack.sourceLocale === "ar" && playable.some((l) => l !== "ar") && !it.prompt.translit) c.warnings.push(`${at}: an Arabic prompt played in Latin rooms needs a translit`);
      if (pack.sourceLocale !== "ar" && it.prompt.translit !== null) c.warnings.push(`${at}: translit is for Arabic prompts only`);
      if (pack.sourceLocale === "ar" && !ARABIC.test(o)) c.errors.push(`${at}: prompt.original must be in Arabic letters (sourceLocale ar)`);

      // Truths and house lies, per playable locale.
      for (const l of playable) {
        const t = it.truth[l];
        const lies = it.houseLies[l] ?? [];
        if (it.type !== "no_truth") {
          if (t === undefined) c.errors.push(`${at}: truth.${l} is required (${l} is playable)`);
          else answerShape(t, l, `${at}: truth.${l}`, c);
        }
        if (lies.length < 2) c.errors.push(`${at}: houseLies.${l} has ${lies.length} (at least 2; ${l} is playable)`);
        else if (lies.length < 3) c.warnings.push(`${at}: houseLies.${l} has ${lies.length} (aim for ≥ 3)`);
        lies.forEach((h, i) => {
          answerShape(h, l, `${at}: houseLies.${l}[${i}]`, c);
          const truths = t === undefined ? [] : [t, ...(it.truthAlt[l] ?? [])];
          const srcTruths = l === pack.sourceLocale ? [] : [it.truth[pack.sourceLocale] ?? "", ...(it.truthAlt[pack.sourceLocale] ?? [])].filter(Boolean);
          if (truths.some((x) => collides(h, x))) c.errors.push(`${at}: houseLies.${l}[${i}] "${h}" collides with the truth`);
          else if ([...truths, ...srcTruths].some((x) => tooClose(h, x))) c.errors.push(`${at}: houseLies.${l}[${i}] "${h}" is too close to the truth (§5.2: a player typing it would be rejected)`);
          for (let j = 0; j < i; j++) if (collides(h, lies[j] as string)) c.errors.push(`${at}: houseLies.${l}[${i}] "${h}" collides with houseLies.${l}[${j}]`);
        });
        if (!it.note[l]) c.warnings.push(`${at}: note.${l} is missing (every item has a note, §11.2 rule 5)`);
      }
      for (const l of Object.keys(it.truth) as BluffLocale[]) if (!playable.includes(l)) c.warnings.push(`${at}: truth.${l} exists but ${l} is not in playableIn`);
      for (const k of it.knownIn) if (!playable.includes(k) && k !== pack.sourceLocale) c.warnings.push(`${at}: knownIn "${k}" is not playable here`);

      // Content rules on every text.
      const texts: [string, string, BluffLocale | "any"][] = [[o, "prompt.original", pack.sourceLocale], ...(it.prompt.translit ? [[it.prompt.translit, "prompt.translit", "any"] as [string, string, "any"]] : [])];
      for (const [l, s] of Object.entries(it.prompt.display)) texts.push([s, `prompt.display.${l}`, l as BluffLocale]);
      for (const [l, s] of Object.entries(it.truth)) texts.push([s, `truth.${l}`, l as BluffLocale]);
      for (const [l, s] of Object.entries(it.note)) texts.push([s, `note.${l}`, l as BluffLocale]);
      for (const [l, list] of Object.entries(it.houseLies)) for (const s of list ?? []) texts.push([s, `houseLies.${l}`, l as BluffLocale]);
      for (const [s, where, l] of texts) textHits(s, `${at}: ${where}`, l, c);

      // Facts (§11.2 rule 9) and sources.
      if (it.type === "fact_blank") {
        const blob = norm(`${o} ${it.truth.en ?? it.truth[pack.sourceLocale] ?? ""}`);
        for (const m of MYTH_DENYLIST) if (blob.includes(norm(m))) c.errors.push(`${at}: looks like the myth "${m}" (§11.2 rule 9)`);
      }
      if ((it.type === "proverb_end" || it.type === "fact_blank") && it.review.source === null) {
        if (it.review.status !== "draft") c.errors.push(`${at}: a ${it.type} item needs review.source before leaving draft`);
        else c.warnings.push(`${at}: ${it.type} without review.source`);
      }
      if (it.type === "fact_blank" && it.review.status !== "verified" && it.review.source !== null && !it.review.source.includes("[VERIFY]")) c.warnings.push(`${at}: an unverified fact's source should carry a [VERIFY] note`);
      // §11.3: a fact's numbers are given only at the precision the source supports (the source note must state them).
      if (it.type === "fact_blank") {
        const src = (it.review.source ?? "").replace(/(\d)[,\s.](?=\d{3}\b)/g, "$1");
        for (const n of (it.truth[pack.sourceLocale] ?? "").replace(/(\d)[,\s.](?=\d{3}\b)/g, "$1").match(/\d+/g) ?? [])
          if (!new RegExp(`(^|\\D)${n}(\\D|$)`).test(src)) c.warnings.push(`${at}: the truth's number ${n} is not stated in review.source`);
      }
      // §11.2 rule 3: a round-2 truth guessable from the prompt's own words (e.g. "a goatherd's ___" → "goats"). Not for
      // sayings, where echoing a word of the first half is the nature of a proverb.
      if (it.type === "fact_blank" || it.type === "word_meaning" || it.type === "expression_meaning") {
        for (const l of playable) {
          const t = it.truth[l];
          const p = l === pack.sourceLocale ? o : it.prompt.display[l];
          if (!t || !p) continue;
          const pt = answerTokens(p.replace(/_+/g, " "));
          const stem = (x: string, y: string): boolean => {
            const a = [...x], b = [...y];
            let k = 0;
            while (k < a.length && k < b.length && a[k] === b[k]) k++;
            return k >= Math.max(4, Math.ceil(0.8 * Math.min(a.length, b.length)));
          };
          const hit = answerTokens(t).find((x) => cp(x) >= 4 && pt.some((y) => y === x || stem(x, y)));
          if (hit) c.warnings.push(`${at}: truth.${l} word "${hit}" already appears in the prompt (guessable, §11.2 rule 3)`);
        }
      }
      if (it.tier === "free" && it.review.status === "draft") {
        // SPEC-GAP: §11.3 makes a draft free item an error, while every launch item is still a draft (nothing has been
        // reviewed yet). It is an error with --release (the ship gate) and a counted warning otherwise.
        if (opts.release) c.errors.push(`${at}: a free item must be reviewed before release (review.status is "draft")`);
      }

      // The same prompt in two packs (or twice) is a duplicate.
      const key = `${pack.sourceLocale}|${normalizeAnswer(o)}`;
      const dup = truthsSeen.get(key);
      if (dup !== undefined) c.errors.push(`${at}: same prompt as ${dup}`);
      else truthsSeen.set(key, at);
    }
    const drafts = free.filter((i) => i.review.status === "draft").length;
    if (!opts.release && drafts > 0) c.warnings.push(`${P}: ${drafts} free item(s) are still drafts (an error with --release)`);
  }
  return c;
}

/** The i18n key of a phase id: `ROUND_INTRO` → `game.bluff.phase.roundIntro` (keys are lowerCamel per segment, §5.7). */
export const phaseKey = (phase: string): string => `game.bluff.phase.${phase.toLowerCase().replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())}`;

/** Every phase in `meta.phases` has a display name in every locale (the ⓘ sheet's "You are here: <phase>" line). */
export function lintBluffI18n(phases: readonly string[], dicts: Readonly<Record<string, Readonly<Record<string, unknown>>>>): Findings {
  const c: Ctx = { errors: [], warnings: [] };
  for (const [loc, dict] of Object.entries(dicts))
    for (const ph of phases) {
      const v = dict[phaseKey(ph)];
      if (typeof v !== "string" || v.trim() === "") c.errors.push(`i18n/games/bluff/${loc}.json: ${phaseKey(ph)} is missing (phase ${ph} needs a display name)`);
    }
  return c;
}

export const lint: GameLint = (packs: readonly ParsedPack[], opts) => {
  const r = lintBluffRaw(packs.map((p) => ({ file: p.file, raw: p.raw })), opts);
  const i = lintBluffI18n(BLUFF_META.phases, { en: bluffEn, fr: bluffFr, ar: bluffAr, es: bluffEs });
  return { errors: [...r.errors, ...i.errors], warnings: [...r.warnings, ...i.warnings] };
};
