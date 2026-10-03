import { NAME_MAX_CHARS, NAME_MAX_CODEPOINTS } from "../constants";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** §7.9. Returns the sanitised name, or null (NAME_INVALID). */
export function sanitizeName(raw: string): string | null {
  let s = raw.normalize("NFC");
  s = s.replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu, "");
  s = s.replace(/\s+/gu, " ").trim();
  const graphemes: string[] = [];
  for (const { segment } of segmenter.segment(s)) {
    let marks = 0;
    let g = "";
    for (const ch of segment) {
      if (/\p{M}/u.test(ch)) {
        if (marks >= 2) continue;
        marks++;
      }
      g += ch;
    }
    graphemes.push(g);
  }
  s = graphemes.join("");
  if (graphemes.length > NAME_MAX_CHARS) s = graphemes.slice(0, NAME_MAX_CHARS).join("").trim();
  if ([...s].length > NAME_MAX_CODEPOINTS) return null;
  return s.length === 0 ? null : s;
}

/** Uniqueness key: NFKC + toLowerCase. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}
