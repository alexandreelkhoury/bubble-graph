// Common checks over every game's packs (JAMAA-PLATFORM §5.2, §5.5): schema through each game's ContentAdapter.parse,
// `game` = the folder, file name = id, pack ids unique across games, `family` consistency across locales, the header
// vocabulary rules and the draft gate. Pure; main.ts does the I/O. Game-specific rules live in ./games/<id>.ts.
import { GAME_CONTENT } from "@jamaa/shared/games/registry";
import type { PackMeta } from "@jamaa/shared/content";
import { GAME_IDS, type Findings, type GameId } from "./platform";
import { GAME_LINTS } from "./games";

export interface GameEntry {
  game: GameId;
  /** Path relative to the content root, e.g. `trivia/en/lb-quiz-01-en.json`. */
  file: string;
  data: unknown;
  parseError?: string;
}

export interface CommonOptions {
  release?: boolean;
}

/** The item array of a pack, whatever the game calls it (§5.2 table: `pairs`, `questions`, `items`; Likely: `cards`). */
export function itemIds(raw: unknown): string[] | null {
  if (raw === null || typeof raw !== "object") return null;
  for (const key of ["pairs", "questions", "items", "cards"]) {
    const list = (raw as Record<string, unknown>)[key];
    if (Array.isArray(list)) return list.map((it) => String((it as { id?: unknown } | null)?.id ?? ""));
  }
  return null;
}

/** The legacy `tags` of a pack split into those that are vocabulary topics and those dropped (§5.2, report only). */
export function legacyTags(raw: unknown, topics: readonly string[]): { mapped: string[]; dropped: string[] } {
  const tags = (raw as { tags?: unknown } | null)?.tags;
  const list = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [];
  const vocab = new Set(topics);
  return { mapped: list.filter((t) => vocab.has(t)), dropped: list.filter((t) => !vocab.has(t)) };
}

interface Parsed { entry: GameEntry; id: string; meta: PackMeta; raw: Record<string, unknown> }

export function lintCommon(entries: readonly GameEntry[], opts: CommonOptions = {}): Findings {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed: Parsed[] = [];
  const ids = new Map<string, string>();

  for (const entry of entries) {
    const where = entry.file;
    if (entry.parseError !== undefined) {
      // Mish Ana!'s pack lint (lint.ts) already reports its JSON errors.
      if (entry.game !== "mishana") errors.push(`${where}: invalid JSON: ${entry.parseError}`);
      continue;
    }
    const raw = entry.data as Record<string, unknown> | null;
    const id = typeof raw?.id === "string" ? raw.id : null;
    if (id !== null) {
      const prev = ids.get(id);
      if (prev === undefined) ids.set(id, where);
      else if (prev.split("/")[0] !== entry.game) errors.push(`${where}: pack id "${id}" is also used by ${prev} (ids are unique across games)`);
      else if (entry.game !== "mishana") errors.push(`${where}: duplicate pack id "${id}" (also in ${prev})`);
    }
    // `game` is required (§5.2); the Mish Ana! schema still accepts it missing (shared JAMAA-GAP), so it is checked here.
    if (raw?.game === undefined) errors.push(`${where}: "game" is required ("game": "${entry.game}")`);
    else if (raw.game !== entry.game) errors.push(`${where}: "game" is "${String(raw.game)}" but the file lives under content/${entry.game}/`);

    let meta: PackMeta;
    try {
      const pack = GAME_CONTENT[entry.game].parse(entry.data);
      meta = GAME_CONTENT[entry.game].meta(pack);
    } catch (e) {
      // Mish Ana!'s schema issues are listed one by one by lint.ts; other games get the adapter's message.
      if (entry.game !== "mishana") errors.push(`${where}: schema (${entry.game} ContentAdapter): ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (entry.game !== "mishana") {
      const name = where.split("/").pop();
      if (name !== `${meta.id}.json`) errors.push(`${where}: file name must be ${meta.id}.json`);
    }
    parsed.push({ entry, id: meta.id, meta, raw: raw as Record<string, unknown> });

    // Header vocabulary rules that hold for every PackHeader pack (§5.2, §5.4).
    const topics = Array.isArray(raw?.topics) ? (raw.topics as string[]) : [];
    const featured = Array.isArray(raw?.featuredTopics) ? (raw.featuredTopics as string[]) : [];
    for (const t of featured) if (!topics.includes(t)) errors.push(`${meta.id}: featuredTopics "${t}" is not in topics`);
    if (new Set(topics).size !== topics.length) errors.push(`${meta.id}: topics lists a topic twice`);

    // Draft gate (§5.5); Mish Ana!'s draft warning comes from lint.ts.
    if (raw?.status === "draft") {
      const free = meta.tier === "free";
      if (opts.release && free) errors.push(`${meta.id}: a free pack must be "reviewed" for release (status is "draft")`);
      else if (entry.game !== "mishana") warnings.push(`${meta.id}: status is "draft"`);
    }
  }

  // Family consistency (§5.5): translations of one product share the game, the tier and the item ids.
  const families = new Map<string, Parsed[]>();
  for (const p of parsed) families.set(p.meta.family, [...(families.get(p.meta.family) ?? []), p]);
  for (const [family, members] of families) {
    if (members.length < 2) continue;
    const first = members[0] as Parsed;
    const firstIds = (itemIds(first.raw) ?? []).join(",");
    for (const m of members.slice(1)) {
      if (m.meta.gameId !== first.meta.gameId) errors.push(`family ${family}: ${m.id} is a ${m.meta.gameId} pack but ${first.id} is ${first.meta.gameId}`);
      if (m.meta.tier !== first.meta.tier) errors.push(`family ${family}: ${m.id} has tier ${m.meta.tier} but ${first.id} has ${first.meta.tier}`);
      if ((itemIds(m.raw) ?? []).join(",") !== firstIds) errors.push(`family ${family}: ${m.id} does not have the same item ids as ${first.id}`);
      if (m.meta.locale === first.meta.locale) errors.push(`family ${family}: ${m.id} and ${first.id} have the same locale ${m.meta.locale}`);
    }
  }

  // Game-specific rules (./games/<id>.ts, owned by that game's lane D in its G milestone).
  for (const game of GAME_IDS) {
    const packs = parsed.filter((p) => p.entry.game === game).map((p) => ({ file: p.entry.file, raw: p.raw, meta: p.meta }));
    const f = GAME_LINTS[game](packs, opts);
    errors.push(...f.errors);
    warnings.push(...f.warnings);
  }
  return { errors, warnings };
}
