// JAMAA-PLATFORM §5.2: the common pack header (zod, strict) shared by every per-locale pack (Mish Ana!, Trivia).
// Bluff and Likely keep their own headers (game docs §11); only their PackMeta must be derivable.
import * as z from "zod";
import { PACK_ID_MAX } from "../constants";
import { GAME_IDS } from "../games/ids";
import { AGE_RATINGS, PACK_TIERS } from "../games/mishana/engine/catalog";
import { DOMAINS, TOPICS } from "./vocab";

/** `family` and `pack_<family>` product ids: ≤ 35 so `pack_` + family stays ≤ 40 (§4.1). */
export const FAMILY_ID_MAX = 35;
export const PACK_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const PACK_LOCALES = ["en", "fr", "ar", "ar-LB", "es"] as const;

export const PackHeaderShape = {
  id: z.string().max(PACK_ID_MAX).regex(PACK_ID_REGEX),                       // globally unique across games
  family: z.string().max(FAMILY_ID_MAX).regex(PACK_ID_REGEX).optional(),     // translations share it; default = id
  // JAMAA-GAP: §5.2 makes `game` required. Lane D's codemod adds `"game": "mishana"` to the existing packs during P;
  // until every pack carries it the field is optional, and `loadContent` rejects a pack whose `game` names another game.
  game: z.enum(GAME_IDS).optional(),
  version: z.number().int().min(1),
  locale: z.enum(PACK_LOCALES),
  script: z.enum(["Latn", "Arab"]),
  title: z.strictObject({ en: z.string().min(1), fr: z.string().min(1), ar: z.string().min(1), es: z.string().min(1).optional() }),
  description: z.strictObject({ en: z.string().max(140), fr: z.string().max(140), ar: z.string().max(140), es: z.string().max(140).optional() }).optional(),
  domain: z.enum(DOMAINS).nullable().default(null),
  topics: z.array(z.enum(TOPICS)).max(8).default([]),
  featuredTopics: z.array(z.enum(TOPICS)).max(3).default([]),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().default(null),
  ageRating: z.enum(AGE_RATINGS),
  tier: z.enum(PACK_TIERS).default("premium"),
  license: z.string().min(1),
  source: z.string().min(1),
  status: z.enum(["draft", "reviewed"]),
  reviewedBy: z.array(z.string()).default([]),
  /** Legacy word-pack field (§5.2: mapped to `topics` where it matches the vocabulary, else dropped by lane D). */
  tags: z.array(z.string()).default([]),
} as const;

export const PackHeaderSchema = z.strictObject(PackHeaderShape);
export type PackHeader = z.infer<typeof PackHeaderSchema>;

/** `familyOf(pack) = pack.family ?? pack.id` (§5.3). */
export function familyOf(p: { id: string; family?: string | undefined }): string {
  return p.family ?? p.id;
}
