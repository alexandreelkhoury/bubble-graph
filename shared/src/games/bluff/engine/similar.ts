// GAME-BLUFF §5.2 / §5.3: normalisation, "too close to the truth" and duplicate collisions (AR/FR/ES/EN).
// normalizeGuess is copied from shared/src/games/mishana/engine/normalize.ts (SPEC §4.12) and extended per §5.2.

const AR_MAP: Record<string, string> = { "ٱ": "ا", "ى": "ي", "ی": "ي", "ة": "ه", "ک": "ك", "ء": "" };
const LIG: Record<string, string> = { "œ": "oe", "æ": "ae", "ß": "ss", "ø": "o", "ł": "l", "đ": "d" };
const STOP = new Set([
  // normalizeGuess (EN/FR articles)
  "the", "a", "an", "le", "la", "les", "l", "un", "une", "des", "du", "de",
  // §5.2 EN/FR extension
  "of", "to", "and", "is", "it", "et", "d", "qu", "que", "est", "en", "au", "aux", "il", "elle", "on",
  // §5.2 Spanish
  "el", "los", "las", "una", "y", "del", "al", "se", "es", "lo", "no",
]);

const strip = (t: string): string => (t.startsWith("ال") && [...t].length >= 4 ? t.slice(2) : t);

/** Lower-case Cyrillic/Greek letters that read as Latin (a UTS #39 skeleton subset, applied after toLowerCase, so the
 *  upper-case look-alikes Н/Т/М/К/В/Η are covered by their lower-case forms). Matching only: never shown. */
const CONFUSABLE: Record<string, string> = {
  "а": "a", "в": "b", "е": "e", "ё": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "к": "k", "м": "m", "н": "h",
  "т": "t", "і": "i", "ї": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ԛ": "q", "ԝ": "w", "һ": "h", "ӏ": "l", "ɡ": "g",
  "α": "a", "β": "b", "ε": "e", "η": "h", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
  "γ": "y", "ζ": "z", "μ": "m", "ω": "w",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLE).join("")}]`, "g");
export const foldConfusables = (s: string): string => s.replace(CONFUSABLE_RE, (c) => CONFUSABLE[c] as string);

/** The shared pipeline, stopping before the final join. */
export function tokens(input: string): string[] {
  let s = input.normalize("NFKD");                  // splits accents (ñ → n + U+0303), أ→ا+ٔ, آ→ا+ٓ, ؤ→و+ٔ, ئ→ي+ٔ
  s = s.replace(/\p{M}/gu, "");                     // every combining mark: Latin accents, tashkeel, shadda, hamza marks
  s = s.replace(/ـ/g, "");                          // tatweel
  s = s.toLowerCase();
  s = foldConfusables(s);                           // homoglyph clones ("Ηumаn" with Greek Eta + Cyrillic а) match
  s = s.replace(/[¿¡]/g, " ");                      // §5.2 Spanish inverted punctuation
  s = s.replace(/(^|[^\p{L}])(l|d|qu)['’]/gu, "$1 "); // §5.2 French/Spanish elision: l' d' qu'
  s = s.replace(/[œæßøłđ]/g, (c) => LIG[c] as string);
  s = s.replace(/[ٱىیةکء]/g, (c) => AR_MAP[c] as string);
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let toks = s.split(" ").filter(Boolean);
  if (toks.length > 1) {
    const f = toks.filter((t) => !STOP.has(t));
    if (f.length) toks = f;
  }
  toks = toks.map((t) => {
    let x = strip(t);
    // §5.2 Arabic: a leading و / ف conjunction on tokens of ≥ 4 letters, after the ال rule (then ال again: "والبيت")
    if ((x.startsWith("و") || x.startsWith("ف")) && [...x].length >= 4) x = strip(x.slice(1));
    return x;
  });
  return toks;
}

export function normalizeAnswer(s: string): string {
  return tokens(s).join("");
}

/** Levenshtein distance over code points. */
export function levenshtein(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
    }
    prev = cur;
  }
  return prev[y.length] as number;
}

const len = (s: string): number => [...s].length;

function tokenMatch(a: string, b: string): boolean {
  return a === b || (len(a) >= 4 && len(b) >= 4 && levenshtein(a, b) <= 1);
}

/** Rule 5 ("every truth token appears in the lie") is bounded so a list of guesses is not a match: the lie may have
 *  at most 2 more tokens than the truth and its normalised length must stay within `minRatio` of the truth's.
 *  Too close: ratio ≥ 0.4 (keeps the §5.2 vector "is a beautiful gazelle", 7/16). Spot on: ratio ≥ 0.5 (stricter:
 *  it pays at once without a vote). */
const RULE5_EXTRA_TOKENS = 2;
const RULE5_RATIO_CLOSE = 0.4;
const RULE5_RATIO_SPOT = 0.5;

/** §5.2 rules 1–5 against one truth. */
function closeToOne(lie: string, truth: string, rule5Ratio = RULE5_RATIO_CLOSE): boolean {
  const lt = tokens(lie);
  const tt = tokens(truth);
  const L = lt.join("");
  const T = tt.join("");
  if (T.length === 0) return false;
  if (L === T) return true;                                                        // 1
  if (len(T) < 5) {
    if (levenshtein(L, T) <= 1) return true;                                       // 2 (short truth)
  } else if (Math.min(len(L), len(T)) >= 5 && levenshtein(L, T) / Math.max(len(L), len(T)) <= 0.2) return true; // 2
  if (len(T) >= 4 && L.includes(T) && len(T) / len(L) >= 0.6) return true;         // 3
  if (tt.length >= 3) {                                                            // 4
    const A = new Set(lt);
    const B = new Set(tt);
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    const union = A.size + B.size - inter;
    if (union > 0 && inter / union >= 0.75) return true;
  }
  if (                                                                             // 5 (bounded)
    tt.length <= 3 && lt.length <= tt.length + RULE5_EXTRA_TOKENS && len(L) > 0 && len(T) / len(L) >= rule5Ratio &&
    tt.every((t) => lt.some((l) => tokenMatch(l, t)))
  ) return true;
  return false;
}

export function isTooClose(lie: string, truths: readonly string[]): boolean {
  return truths.some((t) => closeToOne(lie, t));
}

/** §5.0 "Spot on" (round 1, first entry): the same rules with the stricter rule-5 bound, so "a lion, a tiger, a gazelle
 *  or a prince" never pays. Always a subset of isTooClose: a first entry that is too close but not Spot on is handled
 *  as a too-close probe (the one shot is spent and the truth vote stops paying). */
export function isSpotOn(lie: string, truths: readonly string[]): boolean {
  return truths.some((t) => closeToOne(lie, t, RULE5_RATIO_SPOT));
}

/** §5.3: two lies collide when normalizeAnswer is equal, or rule 2 holds with threshold 0.1. */
export function collides(a: string, b: string): boolean {
  const A = normalizeAnswer(a);
  const B = normalizeAnswer(b);
  if (A.length === 0 || B.length === 0) return a.trim() === b.trim();
  if (A === B) return true;
  return Math.min(len(A), len(B)) >= 5 && levenshtein(A, B) / Math.max(len(A), len(B)) <= 0.1;
}

// ---------- §5.4 blocklist ----------

/** Leet digits/symbols read as letters inside a Latin token only (Arabizi digits 2/3/5/7/9 are matched both ways). */
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

/** A blocklist-only skeleton: NFKD, marks stripped, lower case, confusables → Latin, ligatures and Arabic letter
 *  variants folded, punctuation → space, runs of single-letter tokens collapsed ("n i g g e r", «ع ر ص»), runs of ≥ 3
 *  identical letters collapsed. `leet` maps leet digits/symbols inside chunks that hold a Latin letter. Never shown. */
export function blockTokens(input: string, leet: boolean): string[] {
  let s = input.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ـ/g, "").toLowerCase();
  s = foldConfusables(s);
  s = s.replace(/[œæßøłđ]/g, (c) => LIG[c] as string);
  s = s.replace(/[ٱىیةکء]/g, (c) => AR_MAP[c] as string);
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
  if (leet) s = s.split(/\s+/u).map((ch) => (/[a-z]/.test(ch) ? ch.replace(/[013457@$]/g, (c) => LEET[c] as string) : ch)).join(" ");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  s = s.replace(/(\p{L})\1{2,}/gu, "$1");
  const raw = s.split(" ").filter(Boolean);
  const out: string[] = [];
  let run = "";
  for (const t of raw) {
    if ([...t].length === 1 && /\p{L}/u.test(t)) run += t;
    else {
      if (run) out.push(run);
      run = "";
      out.push(t);
    }
  }
  if (run) out.push(run);
  return out;
}

/** Simple inflections accepted after a single-word entry (or list the forms explicitly in the JSON). */
const SUFFIXES: Record<"en" | "fr" | "es" | "ar", readonly string[]> = {
  en: ["s", "es", "ed", "d", "er", "ers", "ing"],
  fr: ["s", "e", "es", "x"],
  es: ["s", "es", "a", "as", "o", "os"],
  ar: ["ك", "ي", "ه", "ها", "هم", "كم", "كن", "نا", "ات", "ين", "ون"],
};
/** Two-letter Arabic roots (كس, زب) only take the attached pronouns: "زب"+"ون" is "customer". */
const AR_SHORT_SUFFIXES = ["ك", "ي", "ه", "ها", "هم", "كم", "كن", "مك"];
const AR_PREFIXES = ["ال", "وال", "و", "ف", "يا", "ب", "ل"];

export interface BlocklistSource { words: readonly string[]; glued?: readonly string[]; allow?: readonly string[] }
export interface CompiledBlocklist {
  words: { stem: string; suffixes: readonly string[] }[];
  multi: string[];                // multi-word entries, despaced
  glued: string[];                // matched as a substring of the despaced whole string (safe, ≥ 4 letters)
  allow: string[][];              // token sequences removed before matching ("cum laude", "de puta madre", "snigger")
}

const isArabic = (t: string): boolean => /\p{Script=Arabic}/u.test(t);

export function compileBlocklist(srcs: readonly { list: BlocklistSource; suffixes: readonly (keyof typeof SUFFIXES)[] }[]): CompiledBlocklist {
  const out: CompiledBlocklist = { words: [], multi: [], glued: [], allow: [] };
  for (const { list, suffixes } of srcs) {
    const sfx = [...new Set(suffixes.flatMap((l) => SUFFIXES[l]))];
    for (const e of list.words) {
      const t = blockTokens(e, false);
      if (t.length === 0) continue;
      if (t.length > 1) out.multi.push(t.join(""));
      else {
        const stem = t[0] as string;
        // Short Latin stems take a plain plural only ("spic" must not catch "spicy"/"spiced"/"spices").
        const own = isArabic(stem)
          ? ([...stem].length <= 2 ? AR_SHORT_SUFFIXES : SUFFIXES.ar)
          : [...stem].length <= 4 ? sfx.filter((x) => x === "s") : sfx.filter((x) => !isArabic(x));
        out.words.push({ stem, suffixes: own });
      }
    }
    for (const g of list.glued ?? []) {
      const j = blockTokens(g, false).join("");
      if ([...j].length >= 4) out.glued.push(j);
    }
    for (const a of list.allow ?? []) {
      const t = blockTokens(a, false);
      if (t.length) out.allow.push(t);
    }
  }
  return out;
}

function removeAllowed(toks: string[], allow: readonly string[][]): string[] {
  let t = toks;
  for (const a of allow) {
    for (let i = 0; i + a.length <= t.length; ) {
      if (a.every((x, k) => t[i + k] === x)) t = [...t.slice(0, i), ...t.slice(i + a.length)];
      else i++;
    }
  }
  return t;
}

function tokenHits(tok: string, list: CompiledBlocklist): boolean {
  const forms = new Set([tok]);
  if (isArabic(tok)) for (const p of AR_PREFIXES) if (tok.startsWith(p) && [...tok].length - [...p].length >= 2) forms.add(tok.slice(p.length));
  for (const f of forms) {
    for (const w of list.words) {
      if (f === w.stem) return true;
      if (f.startsWith(w.stem) && w.suffixes.includes(f.slice(w.stem.length))) return true;
    }
  }
  return false;
}

/** §5.4 hardened: tokens (with inflections and Arabic clitics), multi-word entries and "glued" entries on the
 *  despaced whole string, after confusable, leet and letter-spacing folds. `list` may be a plain word array (tests). */
export function hitsBlocklist(text: string, list: readonly string[] | CompiledBlocklist): boolean {
  const c: CompiledBlocklist = Array.isArray(list)
    ? compileBlocklist([{ list: { words: list as readonly string[] }, suffixes: [] }])
    : (list as CompiledBlocklist);
  if (c.words.length + c.multi.length + c.glued.length === 0) return false;
  for (const leet of [false, true]) {
    const toks = removeAllowed(blockTokens(text, leet), c.allow);
    if (toks.some((t) => tokenHits(t, c))) return true;
    const whole = toks.join("");
    if (c.multi.some((m) => whole.includes(m))) return true;
    if (c.glued.some((g) => whole.includes(g))) return true;
  }
  return false;
}
