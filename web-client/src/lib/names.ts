// Player-name helpers counted in graphemes (user-perceived characters), so an emoji or an Arabic letter with its
// marks counts as one, as in sanitizeName and Kotlin Names.ellipsize.

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function graphemes(s: string): string[] {
  return segmenter ? [...segmenter.segment(s)].map((x) => x.segment) : [...s];
}

export function graphemeCount(s: string): number {
  return graphemes(s).length;
}

/** Cuts `name` to `max` graphemes plus "…" (DESIGN: 8 in the TV-05 strip, 12 on the vote tiles). */
export function ellipsizeName(name: string, max: number): string {
  if (max <= 0) return "";
  const g = graphemes(name);
  return g.length <= max ? name : g.slice(0, max).join("").trimEnd() + "…";
}

/**
 * The join screen's preview of SPEC §7.9 sanitising (NFC, control characters stripped, spaces collapsed, ≤ 16
 * graphemes, ≤ 2 combining marks each). The server sanitises again; this copy keeps the engine out of the phone bundle
 * (JAMAA-PLATFORM §2.1 import guard).
 */
export function sanitizeName(raw: string, maxChars = 16, maxCodepoints = 64): string | null {
  let s = raw.normalize("NFC").replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu, "").replace(/\s+/gu, " ").trim();
  const gs = graphemes(s).map((seg) => {
    let marks = 0;
    let out = "";
    for (const ch of seg) {
      if (/\p{M}/u.test(ch)) {
        if (marks >= 2) continue;
        marks++;
      }
      out += ch;
    }
    return out;
  });
  s = gs.join("");
  if (gs.length > maxChars) s = gs.slice(0, maxChars).join("").trim();
  if ([...s].length > maxCodepoints) return null;
  return s.length === 0 ? null : s;
}
