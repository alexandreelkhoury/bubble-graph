// The per-game lint hook (JAMAA-PLATFORM §5.5, §6.1): each game's rules live in ./<id>.ts, owned by that game's lane D.
import type { PackMeta } from "@jamaa/shared/content";
import type { Findings } from "../platform";

/** A pack that passed its game's `ContentAdapter.parse`: the raw JSON plus the derived `PackMeta`. */
export interface ParsedPack {
  file: string;
  raw: Record<string, unknown>;
  meta: PackMeta;
}

export type GameLint = (packs: readonly ParsedPack[], opts: { release?: boolean }) => Findings;
