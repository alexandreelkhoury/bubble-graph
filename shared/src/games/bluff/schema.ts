// GAME-BLUFF §11.3: the Bluff pack schema (zod; server, sim, tests and content-lint only). Packs live in
// content/bluff/<pack-id>.json and are read through the platform ContentAdapter (JAMAA-PLATFORM §5.2, ./content.ts).
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type { BluffItem, BluffPack } from "./engine/catalog";

const Loc = z.enum(["en", "fr", "ar", "es"]);
export const BluffTypeSchema = z.enum(["proverb_end", "fact_blank", "word_meaning", "expression_meaning", "no_truth"]);
const LocText = z.partialRecord(Loc, z.string().min(1).max(60));
const LocList = z.partialRecord(Loc, z.array(z.string().min(1).max(60)));

export const BluffItemSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  type: BluffTypeSchema,
  tier: z.enum(["free", "pass"]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  knownIn: z.array(Loc).default([]),
  prompt: z.strictObject({
    original: z.string().min(1).max(120),
    translit: z.string().max(160).nullable(),
    display: z.partialRecord(Loc, z.string().max(160)),
  }),
  truth: LocText,
  truthAlt: LocList,
  houseLies: LocList,
  note: z.partialRecord(Loc, z.string().max(140)),
  review: z.strictObject({
    status: z.enum(["draft", "native-reviewed", "verified"]),
    source: z.string().min(1).nullable(),
  }),
}).superRefine((it, ctx) => {
  const hasTruth = Object.keys(it.truth).length > 0;
  if (it.type === "no_truth" && (hasTruth || Object.keys(it.truthAlt).length > 0)) ctx.addIssue({ code: "custom", message: "no_truth items have no truth" });
  if (it.type !== "no_truth" && !hasTruth) ctx.addIssue({ code: "custom", message: "truth required" });
  if (it.type === "no_truth" && it.knownIn.length > 0) ctx.addIssue({ code: "custom", message: "knownIn is meaningless without a truth" });
});

const Title = z.strictObject({ en: z.string(), fr: z.string(), ar: z.string(), es: z.string().optional() });

export const BluffPackSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,35}$/),
  game: z.literal("bluff"),
  title: Title,
  description: Title,
  sourceLocale: Loc,
  playableIn: z.array(Loc).min(1),
  ageRating: z.enum(["all", "teen"]),
  fallbackHouseLies: z.partialRecord(BluffTypeSchema, LocList),
  items: z.array(BluffItemSchema).min(12),
}).superRefine((p, ctx) => {
  const ids = new Set<string>();
  for (const it of p.items) {
    if (ids.has(it.id)) ctx.addIssue({ code: "custom", message: `duplicate item id ${it.id}` });
    ids.add(it.id);
  }
});

// The engine's zod-free mirror (engine/catalog.ts) must stay identical to the parsed shape.
export const _itemAgree: Same<z.infer<typeof BluffItemSchema>, BluffItem> = true;
export const _packAgree: Same<z.infer<typeof BluffPackSchema>, BluffPack> = true;
