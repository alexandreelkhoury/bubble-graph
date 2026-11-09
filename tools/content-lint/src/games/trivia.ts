// Trivia content rules (GAME-TRIVIA §11.1–§11.3; JAMAA-PLATFORM §5.4, §5.5). Owned by the G4 lane D.
//
// `lintTriviaRaw` checks raw pack JSON (it mirrors the §11.3 question schema itself, so it also runs while the platform
// ContentAdapter is still a stub); `lint` is the GameLint hook the common pass calls with the packs the adapter accepted.
// Pure: no I/O. Errors fail `pnpm lint:content`; warnings are reviewer hints.
import { DOMAINS, REGIONS, TOPICS } from "@jamaa/shared/content";
import { LENGTHS, MIN_QUESTIONS } from "@jamaa/shared/games/trivia/meta";
import type { Findings } from "../platform";
import type { GameLint, ParsedPack } from "./types";

export const TRIVIA_LOCALES = ["en", "fr", "ar", "es"] as const;
type TriviaLocale = (typeof TRIVIA_LOCALES)[number];

/** §11.3: `tf` options are the localized [True, False] labels (the same words as `game.trivia.tf.true/false`). */
export const TF_LABELS: Readonly<Record<TriviaLocale, readonly [string, string]>> = {
  en: ["True", "False"],
  fr: ["Vrai", "Faux"],
  ar: ["صح", "غلط"],
  es: ["Verdadero", "Falso"],
};

export const TEXT_MIN = 5;
export const TEXT_MAX = 160;
export const OPTION_MAX = 48;
export const EXPLAIN_MAX = 200;
/** §11.3 numeric rules. */
export const TF_TRUE_MIN = 0.35;
export const TF_TRUE_MAX = 0.65;
/** With fewer `tf` questions the 35–65 % band can be empty (3 → 33 % or 67 %), so the share rule starts at 4 (SPEC-GAP). */
export const TF_SHARE_MIN_COUNT = 4;
export const MC4_INDEX_MAX_SHARE = 0.4;
export const MC4_SPREAD_MIN_COUNT = 5;
export const REGION_MAX_SHARE = 0.35;
export const HARD_MIN_FOR_LONG = 15;
export const STARS_TOLERANCE = 0.67;
export const GIVEAWAY_MIN_LETTERS = 4;
/** §8.4: phone tiles fit answers of ≤ 40 graphemes (the schema allows 48; longer ones auto-shrink, so it is a warning). */
export const OPTION_SOFT_MAX = 40;

/**
 * §11.2 sensitivity list, checked on every player-visible string (title, description, text, options, explain): wars and
 * armed forces, politics and politicians (and places named after them), religious communities, holidays and places of
 * worship, borders, refugees, assassinations, crisis figures. Latin terms match whole words after accent folding;
 * Arabic terms match whole tokens after diacritic folding, allowing the usual clitics (و ف ب ل ك ع + ال) and suffixes.
 */
export const BANNED_LATIN: readonly string[] = [
  // en
  "war", "wars", "civil war", "militia", "militias", "army", "armies", "soldier", "soldiers", "military", "political party",
  "politician", "politicians", "president", "prime minister", "minister", "parliament", "election", "elections", "sect", "sects",
  "sectarian", "maronite", "sunni", "shia", "shiite", "druze", "hezbollah", "refugee", "refugees", "assassination",
  "assassinated", "massacre", "bomb", "bombing", "explosion", "invasion", "occupation", "israel", "israeli", "border", "borders",
  "ceasefire", "crisis", "devaluation", "religion", "religious", "church", "mosque", "christmas", "easter", "ramadan", "eid",
  // fr
  "guerre", "guerres", "milice", "armee", "soldat", "militaire", "parti politique", "politicien", "homme politique",
  "president", "premier ministre", "ministre", "parlement", "depute", "elections", "confession", "confessionnel", "secte",
  "sunnite", "chiite", "refugie", "refugies", "assassinat", "attentat", "bombe", "explosion", "israel", "frontiere",
  "frontieres", "crise", "religieux", "religieuse", "eglise", "mosquee", "noel", "paques",
  // es
  "guerra", "guerras", "milicia", "ejercito", "militar", "partido politico", "politico", "presidente", "primer ministro",
  "ministro", "parlamento", "diputado", "elecciones", "secta", "sectario", "maronita", "suni", "sunita", "chii", "chiita",
  "druso", "drusa", "hezbola", "refugiado", "refugiados", "asesinato", "masacre", "bomba", "atentado", "explosion",
  "invasion", "ocupacion", "frontera", "fronteras", "crisis", "devaluacion", "religion", "religioso", "iglesia", "mezquita",
  "navidad", "pascua", "ramadan",
  // politicians' family names (people and the places named after them), any script written in Latin letters
  "hariri", "chamoun", "chehab", "chehabi", "karami", "gemayel", "jumblatt", "joumblatt", "berri", "nasrallah", "aoun",
  "geagea", "frangieh", "mikati", "siniora", "arslan",
];
export const BANNED_ARABIC: readonly string[] = [
  "حرب", "حروب", "ميليشيا", "ميليشيات", "جيش", "عسكر", "عسكري", "جندي", "جنود", "حزب", "احزاب", "سياسي", "سياسيين",
  "رئيس الجمهورية", "رئيس الحكومة", "وزير", "برلمان", "مجلس النواب", "انتخابات", "طائفة", "طائفي", "طوائف", "مذهب", "مذهبي",
  "ماروني", "موارنة", "شيعي", "شيعة", "درزي", "دروز", "حزب الله", "لاجئ", "لاجئين", "نازح", "نازحين", "اغتيال",
  "مجزرة", "قنبلة", "انفجار", "تفجير", "اجتياح", "احتلال", "اسرائيل", "حدود", "ازمة", "كنيسة", "مسجد", "رمضان", "الفصح",
  "الحريري", "شمعون", "شهاب", "كرامي", "الجميل", "جنبلاط", "نبيه بري", "نصرالله", "جعجع", "فرنجية", "ميقاتي", "السنيورة", "ارسلان",
];

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Arabic folding: no diacritics or tatweel; hamza seats and alef forms → bare alef, ى → ي, ة kept. */
const foldArabic = (s: string): string =>
  s.replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
const latinWords = (s: string): string[] => fold(s).match(/\p{L}+/gu) ?? [];
const arabicTokens = (s: string): string[] => foldArabic(s).match(/[ء-ي]+/g) ?? [];

const AR_PREFIX = /^(?:و|ف)?(?:ب|ل|ك|ع)?(?:ال|ل)?/;
const AR_SUFFIX = /(?:ة|ي|ية|ين|ون|ات|ه|ها|هم|و|ن)?$/;
const arabicMatches = (token: string, stem: string): boolean => {
  if (token === stem) return true;
  const m = token.match(new RegExp(`^${AR_PREFIX.source}(${stem})${AR_SUFFIX.source}`));
  return m !== null && m[0] === token;
};

/** The banned terms found in one string (folded forms); empty when clean. */
export function bannedTerms(text: string): string[] {
  const hits = new Set<string>();
  const words = latinWords(text);
  const joined = ` ${words.join(" ")} `;
  for (const term of BANNED_LATIN) if (joined.includes(` ${term} `)) hits.add(term);
  const tokens = arabicTokens(text);
  if (tokens.length > 0) {
    const arJoined = ` ${tokens.join(" ")} `;
    for (const raw of BANNED_ARABIC) {
      const term = foldArabic(raw);
      if (term.includes(" ")) {
        if (arJoined.includes(` ${term} `)) hits.add(raw);
      } else if (tokens.some((t) => arabicMatches(t, term))) hits.add(raw);
    }
  }
  return [...hits];
}

/** Letters-only tokens of ≥ 4 letters (any script), folded, for the giveaway warning. */
function longTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of [...latinWords(s), ...arabicTokens(s)]) if ([...t].length >= GIVEAWAY_MIN_LETTERS) out.add(t);
  return out;
}

const normOption = (s: string): string => fold(foldArabic(s)).replace(/\s+/g, " ").trim();

interface RawQuestion {
  id?: unknown; type?: unknown; text?: unknown; options?: unknown; answer?: unknown; topic?: unknown; difficulty?: unknown;
  easyIn?: unknown; region?: unknown; explain?: unknown; source?: unknown;
}
const QUESTION_KEYS = new Set(["id", "type", "text", "options", "answer", "topic", "difficulty", "easyIn", "region", "explain", "source"]);

export interface TriviaLintInput {
  file: string;
  raw: Record<string, unknown>;
}

const str = (v: unknown): v is string => typeof v === "string";
const pct = (x: number): string => `${Math.round(x * 100)} %`;

/** All §11.3 rules for a set of Trivia packs (raw JSON), including the cross-locale family rules. */
export function lintTriviaRaw(packs: readonly TriviaLintInput[], opts: { release?: boolean } = {}): Findings {
  const errors: string[] = [];
  const warnings: string[] = [];
  const families = new Map<string, TriviaLintInput[]>();

  for (const pack of packs) {
    const raw = pack.raw;
    const id = str(raw.id) ? raw.id : pack.file;
    const err = (m: string): void => void errors.push(`${id}: ${m}`);
    const warn = (m: string): void => void warnings.push(`${id}: ${m}`);
    const locale = str(raw.locale) ? raw.locale : "";
    const lang = (locale === "ar-LB" ? "ar" : locale) as TriviaLocale;
    if (!(TRIVIA_LOCALES as readonly string[]).includes(lang)) err(`locale "${locale}" is not one of ${TRIVIA_LOCALES.join(", ")} (ar-LB)`);
    if (raw.script !== (lang === "ar" ? "Arab" : "Latn")) err(`script must be ${lang === "ar" ? "Arab" : "Latn"} for locale ${locale}`);
    const family = str(raw.family) ? raw.family : id;
    families.set(family, [...(families.get(family) ?? []), pack]);

    // Header (§5.4 Trivia rules).
    if (!str(raw.domain) || !(DOMAINS as readonly string[]).includes(raw.domain)) err(`domain is required and must be a vocabulary domain (got ${JSON.stringify(raw.domain)})`);
    if (raw.stars !== 1 && raw.stars !== 2 && raw.stars !== 3) err("stars is required (1, 2 or 3)");
    const topics = Array.isArray(raw.topics) ? (raw.topics as unknown[]) : [];
    if (topics.length === 0) err("topics must be non-empty");
    for (const t of topics) if (!str(t) || !(TOPICS as readonly string[]).includes(t)) err(`topics: "${String(t)}" is not a vocabulary topic`);
    const featured = Array.isArray(raw.featuredTopics) ? (raw.featuredTopics as unknown[]) : [];
    if (featured.length < 1 || featured.length > 3) err(`featuredTopics must list 1 to 3 topics (got ${featured.length})`);
    for (const t of featured) if (!topics.includes(t)) err(`featuredTopics "${String(t)}" is not in topics`);
    for (const [where, v] of [["title", raw.title], ["description", raw.description]] as const) {
      if (v && typeof v === "object") for (const [loc, s] of Object.entries(v)) if (str(s)) for (const b of bannedTerms(s)) err(`${where}.${loc}: sensitive term "${b}" (§11.2)`);
    }

    const qs = Array.isArray(raw.questions) ? (raw.questions as RawQuestion[]) : null;
    if (qs === null) {
      err("questions must be an array");
      continue;
    }
    if (qs.length < MIN_QUESTIONS) err(`has ${qs.length} questions; a Trivia pack needs ≥ ${MIN_QUESTIONS} (§5.2)`);

    const ids = new Set<string>();
    const texts = new Map<string, string>();
    const used = new Set<string>();
    let tfCount = 0, tfTrue = 0, mc4Count = 0, hard = 0, diffSum = 0, verify = 0;
    const mc4Index = [0, 0, 0, 0];
    const regions = new Map<string, number>();
    let tagged = 0;

    for (const [i, q] of qs.entries()) {
      const qid = str(q.id) ? q.id : `#${i + 1}`;
      const qerr = (m: string): void => err(`${qid}: ${m}`);
      for (const k of Object.keys(q)) if (!QUESTION_KEYS.has(k)) qerr(`unknown field "${k}"`);
      if (!str(q.id) || !/^q\d{3,4}$/.test(q.id)) qerr("id must match q000 (3–4 digits)");
      else if (ids.has(q.id)) qerr("duplicate question id");
      else ids.add(q.id);

      const text = str(q.text) ? q.text : "";
      const len = [...text.trim()].length;
      if (len < TEXT_MIN || len > TEXT_MAX) qerr(`text must be ${TEXT_MIN}–${TEXT_MAX} characters (has ${len})`);
      const nt = normOption(text);
      if (nt && texts.has(nt)) qerr(`same text as ${texts.get(nt) as string}`);
      texts.set(nt, qid);

      const type = q.type;
      const options = Array.isArray(q.options) ? (q.options as unknown[]) : [];
      const answer = typeof q.answer === "number" && Number.isInteger(q.answer) ? q.answer : -1;
      if (type === "mc4") {
        mc4Count++;
        if (options.length !== 4) qerr(`mc4 needs 4 options (has ${options.length})`);
        if (answer < 0 || answer > 3) qerr("mc4 answer must be 0–3");
        else mc4Index[answer] = (mc4Index[answer] ?? 0) + 1;
      } else if (type === "tf") {
        tfCount++;
        const labels = TF_LABELS[lang];
        if (labels && (options.length !== 2 || options[0] !== labels[0] || options[1] !== labels[1])) qerr(`tf options must be the ${lang} labels ${JSON.stringify(labels)}`);
        if (answer !== 0 && answer !== 1) qerr("tf answer must be 0 (True) or 1 (False)");
        else if (answer === 0) tfTrue++;
      } else qerr(`type must be "mc4" or "tf" (got ${JSON.stringify(type)})`);

      const seen = new Set<string>();
      for (const [j, o] of options.entries()) {
        if (!str(o) || o.trim() === "") {
          qerr(`option ${j + 1} is empty`);
          continue;
        }
        if ([...o].length > OPTION_MAX) qerr(`option ${j + 1} is longer than ${OPTION_MAX} characters`);
        else if ([...o].length > OPTION_SOFT_MAX) warnings.push(`${id}: ${qid}: option ${j + 1} has ${[...o].length} characters; the phone pad fits ${OPTION_SOFT_MAX} (§8.4)`);
        const n = normOption(o);
        if (seen.has(n)) qerr(`option "${o}" is listed twice`);
        seen.add(n);
      }

      if (!str(q.topic) || !(TOPICS as readonly string[]).includes(q.topic)) qerr(`topic "${String(q.topic)}" is not a vocabulary topic`);
      else {
        used.add(q.topic);
        if (!topics.includes(q.topic)) qerr(`topic "${q.topic}" is not in the pack's topics`);
      }
      if (q.difficulty !== 1 && q.difficulty !== 2 && q.difficulty !== 3) qerr("difficulty must be 1, 2 or 3");
      else {
        diffSum += q.difficulty;
        if (q.difficulty === 3) hard++;
      }
      if (q.easyIn !== undefined) {
        if (!Array.isArray(q.easyIn) || q.easyIn.some((l) => !(TRIVIA_LOCALES as readonly unknown[]).includes(l))) qerr(`easyIn must list locales of ${TRIVIA_LOCALES.join(", ")}`);
      }
      if (q.region !== undefined) {
        if (!str(q.region) || !(REGIONS as readonly string[]).includes(q.region)) qerr(`region "${String(q.region)}" is not a vocabulary region`);
        else {
          if (raw.domain !== "lebanon") qerr("region tags are for lebanon-domain quizzes only (§5.4)");
          tagged++;
          regions.set(q.region, (regions.get(q.region) ?? 0) + 1);
        }
      }
      if (q.explain !== undefined && (!str(q.explain) || [...q.explain].length > EXPLAIN_MAX)) qerr(`explain must be a string of ≤ ${EXPLAIN_MAX} characters`);
      if (!str(q.source) || q.source.trim() === "") qerr("source is required (URL or reference)");
      else if (q.source.includes("[VERIFY]")) verify++;

      // §11.2 sensitivity list on everything players see.
      for (const s of [text, ...options.filter(str), ...(str(q.explain) ? [q.explain] : [])]) {
        for (const b of bannedTerms(s)) qerr(`sensitive term "${b}" (§11.2)`);
      }
      // Giveaway hint: a long word shared by the question and the correct option only.
      if (answer >= 0 && answer < options.length && str(options[answer])) {
        const qt = longTokens(text);
        const others = new Set(options.filter((o, j) => j !== answer && str(o)).flatMap((o) => [...longTokens(o as string)]));
        const give = [...longTokens(options[answer] as string)].filter((t) => qt.has(t) && !others.has(t));
        if (give.length > 0) warnings.push(`${id}: ${qid}: the correct option shares "${give.join('", "')}" with the question (giveaway?)`);
      }
    }

    // Pack-level distributions.
    for (const t of topics) if (str(t) && !used.has(t)) err(`topics lists "${t}" but no question uses it (topics = the question topics, §5.4)`);
    if (tfCount >= TF_SHARE_MIN_COUNT) {
      const share = tfTrue / tfCount;
      if (share < TF_TRUE_MIN || share > TF_TRUE_MAX) err(`${pct(share)} of tf answers are True (${tfTrue}/${tfCount}); keep it within 35–65 %`);
    }
    if (mc4Count >= MC4_SPREAD_MIN_COUNT) {
      for (const [k, n] of mc4Index.entries()) if (n / mc4Count > MC4_INDEX_MAX_SHARE) err(`the correct mc4 answer is option ${k + 1} in ${pct(n / mc4Count)} of questions (max 40 %)`);
    }
    if (tagged > 0) {
      for (const [r, n] of regions) if (n / tagged > REGION_MAX_SHARE) err(`region "${r}" has ${pct(n / tagged)} of the region-tagged questions (max 35 %)`);
    }
    if (qs.length >= LENGTHS.long && hard < HARD_MIN_FOR_LONG) err(`offers Long (${qs.length} questions) but has only ${hard} difficulty-3 questions (needs ≥ ${HARD_MIN_FOR_LONG})`);
    if ((raw.stars === 1 || raw.stars === 2 || raw.stars === 3) && qs.length > 0) {
      const mean = diffSum / qs.length;
      if (Math.abs(raw.stars - mean) > STARS_TOLERANCE) err(`stars ${raw.stars} but the mean question difficulty is ${mean.toFixed(2)} (|Δ| ≤ ${STARS_TOLERANCE})`);
    }
    if (verify > 0) {
      if (opts.release) err(`${verify} question source(s) still marked [VERIFY]; check each fact before release (§14)`);
      else warn(`${verify} question source(s) still marked [VERIFY]`);
    }
  }

  // Family rules (§11.3): translations share the header metadata and every question's shape.
  for (const [family, members] of families) {
    const langs = new Set(members.map((m) => (m.raw.locale === "ar-LB" ? "ar" : String(m.raw.locale))));
    const missing = TRIVIA_LOCALES.filter((l) => !langs.has(l));
    if (missing.length > 0) warnings.push(`family ${family}: no pack for ${missing.join(", ")} (launch quizzes ship in all four locales, §6)`);
    if (members.length < 2) continue;
    const first = members[0] as TriviaLintInput;
    const fid = String(first.raw.id);
    const shape = (q: RawQuestion): string => JSON.stringify([q.type, q.answer, q.topic, q.difficulty, [...((q.easyIn as string[] | undefined) ?? [])].sort(), q.region ?? null]);
    const firstQs = new Map(((first.raw.questions as RawQuestion[] | undefined) ?? []).map((q) => [String(q.id), q]));
    for (const m of members.slice(1)) {
      const mid = String(m.raw.id);
      for (const k of ["domain", "stars", "topics", "featuredTopics", "title", "ageRating", "tier"] as const) {
        if (JSON.stringify(m.raw[k]) !== JSON.stringify(first.raw[k])) errors.push(`family ${family}: ${mid} has a different ${k} from ${fid}`);
      }
      for (const q of (m.raw.questions as RawQuestion[] | undefined) ?? []) {
        const f = firstQs.get(String(q.id));
        if (!f) errors.push(`family ${family}: ${mid} has ${String(q.id)}, which ${fid} does not`);
        else if (shape(q) !== shape(f)) errors.push(`family ${family}: ${mid} ${String(q.id)} differs from ${fid} in type, answer, topic, difficulty, easyIn or region`);
      }
    }
  }
  return { errors, warnings };
}

/** The GameLint hook (packs the trivia ContentAdapter accepted). */
export const lint: GameLint = (packs: readonly ParsedPack[], opts) => lintTriviaRaw(packs.map((p) => ({ file: p.file, raw: p.raw })), opts);
