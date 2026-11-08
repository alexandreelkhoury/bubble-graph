// GAME-BLUFF §5.1: input sanitising, length, script rule, display normalisation and the Latin case rule.
import type { Locale } from "../../../constants";

export const LIE_MAX_CHARS = 60;            // graphemes
export const LIE_MAX_CODEPOINTS = 240;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemes(s: string): string[] {
  return Array.from(segmenter.segment(s), (x) => x.segment);
}

/** sanitizeName (SPEC §7.9) without the uniqueness step and without truncation: NFC, strip Cc/Cf/Co/Cs, collapse
 *  spaces, trim, max 2 combining marks per grapheme. Returns "" when nothing is left. */
export function sanitizeLie(raw: string): string {
  let s = raw.normalize("NFC");
  s = s.replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu, " ");
  s = s.replace(/\s+/gu, " ").trim();
  const out: string[] = [];
  for (const g of graphemes(s)) {
    let marks = 0;
    let kept = "";
    for (const ch of g) {
      if (/\p{M}/u.test(ch)) {
        if (marks >= 2) continue;
        marks++;
      }
      kept += ch;
    }
    out.push(kept);
  }
  return out.join("");
}

export function letterCount(s: string): number {
  return (s.match(/\p{L}/gu) ?? []).length;
}

/** §5.1 script rule: AR content needs an Arabic letter; EN/FR/ES content needs a Latin letter. */
export function scriptOk(s: string, locale: Locale): boolean {
  return locale === "ar" ? /\p{Script=Arabic}/u.test(s) && /\p{L}/u.test(s) : /\p{Script=Latin}/u.test(s);
}

/** §5.1 display normalisation, applied to EVERY option alike (truth, house lies, player lies). */
export function displayNormalize(s: string): string {
  let t = s.normalize("NFC");
  t = t.replace(/[ً-ٰٟـ]/g, "");                       // tashkeel incl. shadda, superscript alef, tatweel
  t = t.replace(/«\s*/g, '"').replace(/\s*»/g, '"');                        // French guillemets carry inner spaces
  t = t.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/\p{Extended_Pictographic}(️|‍|\p{Emoji_Modifier})*/gu, "");
  t = t.replace(/[️‍]/g, "");
  t = t.replace(/\s+/gu, " ").trim();
  t = t.replace(/[\s.!…]+$/u, "");                                          // trailing . ! …
  return t.trim();
}

/** §5.1 case rule (player lies only): first grapheme upper-cased when it is a Latin letter. */
export function capitalizeFirst(s: string, locale: Locale): string {
  const gs = graphemes(s);
  const first = gs[0];
  if (first === undefined || !/^\p{Script=Latin}/u.test(first)) return s;
  return first.toLocaleUpperCase(locale) + gs.slice(1).join("");
}

export function presentLie(s: string, locale: Locale): string {
  return capitalizeFirst(displayNormalize(s), locale);
}

/** §4.2 step 4: the public length hint from the truth's word count. */
export function lengthHintOf(truth: string | null): "short" | "few" | "sentence" | "free" {
  if (truth === null) return "free";
  const n = displayNormalize(truth).split(/\s+/u).filter(Boolean).length;
  return n <= 2 ? "short" : n <= 5 ? "few" : "sentence";
}
