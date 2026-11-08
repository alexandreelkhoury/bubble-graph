// JAMAA-PLATFORM §5.2 / §4.4: the platform content contracts. Zod-free and engine-free (types only at runtime).
import type { Locale } from "../constants";
import type { GameId } from "../games/ids";
import type { AgeRating } from "../games/mishana/engine/catalog";
import type { LocalizedTitle } from "../games/mishana/engine/types";
import type { Domain, Topic } from "./vocab";

export type { AgeRating, LocalizedTitle, Domain, Topic };

/** What the platform knows about any pack of any game (built by the game's `ContentAdapter.meta`). */
export interface PackMeta {
  id: string; family: string; gameId: GameId;
  languages: Locale[];                       // mishana/trivia: [language of `locale`]; bluff/likely: `playableIn`
  locale: string;                            // the pack's own locale ("ar-LB"); multi-locale packs: their source locale
  title: LocalizedTitle; ageRating: AgeRating;
  tier: "free" | "premium" | "mixed";        // mixed = item-level tiers (bluff, likely)
  itemCount: number; freeItemCount: number;
  stars: 1 | 2 | 3 | null; domain: Domain | null; topics: Topic[];
}

/** §4.4: what the room may play. `packs` holds owned FAMILY ids. */
export interface RoomAccess { premium: boolean; packs: ReadonlySet<string> }

export interface ContentAdapter<P, Settings = unknown> {
  parse(raw: unknown): P;                    // zod; throws on invalid
  meta(p: P): PackMeta;
  /** Access filter: null if the room may not play anything of it; else the pack with locked items removed. */
  playable(p: P, a: { premium: boolean; ownedFamilies: ReadonlySet<string> }): P | null;
  /**
   * JAMAA-GAP (P1): the setup pack list needs the game's own filters (Mish Ana!'s family filter hides `teen` packs, and
   * its pair count follows `difficulties`). Absent → every pack of the content language except `adult`, counting
   * `itemCount`.
   */
  setupView?(p: P, s: Settings): { shown: boolean; itemCount: number };
}

/** A game's catalog: its playable (or full) packs. Mish Ana!'s is the engine `Catalog`. */
export interface PackCatalog<P> { packs: P[] }
