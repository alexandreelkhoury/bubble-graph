import type { WordSide } from "./types";

const AR_MAP: Record<string, string> = { "ٱ": "ا", "ى": "ي", "ی": "ي", "ة": "ه", "ک": "ك", "ء": "" };
const LIG: Record<string, string> = { "œ": "oe", "æ": "ae", "ß": "ss", "ø": "o", "ł": "l", "đ": "d" };
const STOP = new Set(["the","a","an","le","la","les","l","un","une","des","du","de"]);
export function normalizeGuess(input: string): string {
  let s = input.normalize("NFKD");                 // splits accents, أ→ا+ٔ, آ→ا+ٓ, ؤ→و+ٔ, ئ→ي+ٔ, ﻻ→لا
  s = s.replace(/\p{M}/gu, "");                     // drop all combining marks: Latin accents, Arabic harakat/shadda/sukun/hamza marks, superscript alef
  s = s.replace(/ـ/g, "");                     // tatweel
  s = s.toLowerCase();
  s = s.replace(/[œæßøłđ]/g, (c) => LIG[c]!);
  s = s.replace(/[ٱىیةکء]/g, (c) => AR_MAP[c]!); // alef wasla→alef, alef maqsura/farsi yeh→yeh, ta marbuta→heh, keheh→kaf, drop hamza
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
       .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6F0));
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let toks = s.split(" ").filter(Boolean);
  if (toks.length > 1) { const f = toks.filter((t) => !STOP.has(t)); if (f.length) toks = f; }
  toks = toks.map((t) => (t.startsWith("ال") && [...t].length >= 4 ? t.slice(2) : t)); // strip ال
  return toks.join("");
}
export function isGuessCorrect(guess: string, target: WordSide): boolean {
  const g = normalizeGuess(guess);
  if (!g) return false;
  const targets = [target.text, ...target.alt, ...(target.translit ? [target.translit] : [])];
  return targets.some((t) => normalizeGuess(t) === g);
}
