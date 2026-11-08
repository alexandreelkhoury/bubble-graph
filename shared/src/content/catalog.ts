// JAMAA-PLATFORM §5.3: every game's catalog (playable or full), as the room and its projections receive it.
import type { CatalogPack } from "../games/mishana/engine/catalog";
import type { Catalog } from "../games/mishana/engine/catalog";
import type { GameId } from "../games/ids";
import type { PackCatalog } from "./types";

/** JAMAA-GAP (P1): G2–G4 catalogs are empty stubs until their G lanes add pack schemas. */
export interface ContentCatalog { mishana: Catalog; bluff: PackCatalog<never>; likely: PackCatalog<never>; trivia: PackCatalog<never> }
export type PackOf<K extends GameId> = ContentCatalog[K]["packs"][number];
export type { CatalogPack };

/** A catalog with the given Mish Ana! catalog and no packs for the other games. */
export function contentCatalog(mishana: Catalog): ContentCatalog {
  return { mishana, bluff: { packs: [] }, likely: { packs: [] }, trivia: { packs: [] } };
}
