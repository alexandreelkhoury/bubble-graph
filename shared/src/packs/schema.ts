import * as z from "zod";
import { PACK_ID_MAX } from "../constants";
import { AGE_RATINGS } from "../engine/catalog";
import type { WordPackLike } from "../engine/catalog";

export const WordSideSchema = z.strictObject({ text: z.string().min(1).max(40), translit: z.string().min(1).max(40).nullable().optional(), alt: z.array(z.string().min(1).max(40)).max(8).optional() });
export const PairSchema = z.strictObject({
  id: z.string().regex(/^p\d{3,4}$/),
  civilian: WordSideSchema, undercover: WordSideSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reviewedBy: z.array(z.string()).default([]),
  notes: z.string().max(200).optional(),
});
export const WordPackSchema = z.strictObject({
  id: z.string().max(PACK_ID_MAX).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), // e.g. "lb-food-01"; selectable by SETTINGS_BOUNDS.packIds
  version: z.number().int().min(1),
  locale: z.enum(["en", "fr", "ar", "ar-LB"]),
  script: z.enum(["Latn", "Arab"]),
  title: z.strictObject({ en: z.string().min(1), fr: z.string().min(1), ar: z.string().min(1) }),
  tags: z.array(z.string()).default([]),
  ageRating: z.enum(AGE_RATINGS),
  license: z.string().min(1),                                 // "CC-BY-4.0" (original) | "MIT" (seeded)
  source: z.string().min(1),                                  // "original" | "antebrl/undercover-word-game" | …
  status: z.enum(["draft", "reviewed"]),
  pairs: z.array(PairSchema).min(10),
});
export type WordPack = z.infer<typeof WordPackSchema>;

// Compile-time check: the engine's structural WordPackLike accepts parsed packs.
const _assignable = (p: WordPack): WordPackLike => p;
void _assignable;
