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

/** The shared pipeline, stopping before the final join. */
export function tokens(input: string): string[] {
  let s = input.normalize("NFKD");                  // splits accents (ñ → n + U+0303), أ→ا+ٔ, آ→ا+ٓ, ؤ→و+ٔ, ئ→ي+ٔ
  s = s.replace(/\p{M}/gu, "");                     // every combining mark: Latin accents, tashkeel, shadda, hamza marks
  s = s.replace(/ـ/g, "");                          // tatweel
  s = s.toLowerCase();
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

/** §5.2 rules 1–5 against one truth. */
function closeToOne(lie: string, truth: string): boolean {
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
  if (tt.length <= 3 && tt.every((t) => lt.some((l) => tokenMatch(l, t)))) return true; // 5
  return false;
}

export function isTooClose(lie: string, truths: readonly string[]): boolean {
  return truths.some((t) => closeToOne(lie, t));
}

/** §5.3: two lies collide when normalizeAnswer is equal, or rule 2 holds with threshold 0.1. */
export function collides(a: string, b: string): boolean {
  const A = normalizeAnswer(a);
  const B = normalizeAnswer(b);
  if (A.length === 0 || B.length === 0) return a.trim() === b.trim();
  if (A === B) return true;
  return Math.min(len(A), len(B)) >= 5 && levenshtein(A, B) / Math.max(len(A), len(B)) <= 0.1;
}

/** §5.4 blocklist: single-word entries match normalised tokens; multi-word entries match the normalised whole string. */
export function hitsBlocklist(text: string, list: readonly string[]): boolean {
  if (list.length === 0) return false;
  const toks = new Set(tokens(text));
  const whole = normalizeAnswer(text);
  return list.some((entry) => {
    const et = tokens(entry);
    if (et.length === 0) return false;
    if (et.length === 1) return toks.has(et[0] as string);
    return whole.includes(et.join(""));
  });
}
