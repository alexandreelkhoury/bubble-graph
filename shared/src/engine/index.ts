// Public engine API (§4.3). Pure; never imports zod.
export * from "./types";
export { createInitialState, reduce, nextWakeAt } from "./reduce";
export { countRoles, effectiveRoleCounts, defaultRoleCounts, validateRoleCounts } from "./roles";
export { checkWinner } from "./win";
export { normalizeGuess, isGuessCorrect } from "./normalize";
export { sanitizeName, nameKey } from "./sanitize";
export { assertInvariants, InvariantError } from "./invariants";
export { buildCatalog, languageOf, PACK_TIERS } from "./catalog";
export type { AgeRating, Catalog, CatalogPack, CatalogPair, PackTier, WordPackLike } from "./catalog";
export { DEFAULT_SETTINGS, applySettingsPatch } from "./settings";
export { SETTINGS_BOUNDS } from "../constants";
export { createRng, type Rng } from "./rng";
