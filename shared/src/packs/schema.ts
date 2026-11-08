import * as z from "zod";
import { PackHeaderShape } from "../content/schema";
import type { WordPackLike } from "../games/mishana/engine/catalog";

export const WordSideSchema = z.strictObject({ text: z.string().min(1).max(40), translit: z.string().min(1).max(40).nullable().optional(), alt: z.array(z.string().min(1).max(40)).max(8).optional() });
export const PairSchema = z.strictObject({
  id: z.string().regex(/^p\d{3,4}$/),
  civilian: WordSideSchema, undercover: WordSideSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reviewedBy: z.array(z.string()).default([]),
  notes: z.string().max(200).optional(),
});
/** §5.2: the Mish Ana! pack = the platform PackHeader + `pairs` (≥ 10). A pack without `tier` is premium. */
export const WordPackSchema = z.strictObject({
  ...PackHeaderShape,
  pairs: z.array(PairSchema).min(10),
});
export type WordPack = z.infer<typeof WordPackSchema>;

// Compile-time check: the engine's structural WordPackLike accepts parsed packs.
const _assignable = (p: WordPack): WordPackLike => p;
void _assignable;
