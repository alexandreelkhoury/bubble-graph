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
