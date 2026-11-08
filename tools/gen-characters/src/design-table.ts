// Parses the world palette table of docs/DESIGN.md §2.5 into WorldModel values, so the doc copy is tested against the
// contrast rules and against shared/src/worlds/palettes.ts (DESIGN-JAMAA §9).
import { WORLD_TOKENS, type WorldModel, type WorldToken } from "./model";

export function parseWorldTable(markdown: string): WorldModel[] {
  const start = markdown.indexOf("### 2.5 World palettes");
  if (start < 0) throw new Error("docs/DESIGN.md has no §2.5 World palettes");
  const lines = markdown.slice(start).split("\n");
  const headerIdx = lines.findIndex((l) => l.startsWith("| Token"));
  if (headerIdx < 0) throw new Error("§2.5: token table not found");
  const ids = (lines[headerIdx] as string).split("|").slice(2, -1).map((c) => /`([a-z-]+)`/.exec(c)?.[1] ?? "");
  const worlds: WorldModel[] = ids.map((id) => ({ id, web: {} as Record<WorldToken, string | null>, native: {} as Record<WorldToken, string | null> }));
  for (const line of lines.slice(headerIdx + 2)) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const token = /`world\.([a-zA-Z]+)`/.exec(cells[0] ?? "")?.[1] as WorldToken | undefined;
    if (!token || !WORLD_TOKENS.includes(token)) throw new Error(`§2.5: unknown token row ${cells[0] ?? ""}`);
    cells.slice(1).forEach((cell, i) => {
      const w = worlds[i] as WorldModel;
      const hexes = [...cell.matchAll(/`(#[0-9A-Fa-f]{6})`/g)].map((m) => (m[1] as string).toUpperCase());
      const web = hexes[0] ?? null;
      const native = /native `(#[0-9A-Fa-f]{6})`/.exec(cell)?.[1]?.toUpperCase() ?? web;
      w.web[token] = web;
      w.native[token] = native;
    });
  }
  for (const w of worlds) for (const t of WORLD_TOKENS) if (!(t in w.web)) throw new Error(`§2.5: ${w.id} has no ${t} row`);
  return worlds;
}
