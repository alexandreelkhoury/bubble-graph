// GAME-TAQRIBAN §11.2: the Taqriban pack schema (zod, strict), read through the platform ContentAdapter (content.ts).
// One pack holds every language (the fact and its answer are shared; only the wording is per language), like Likely.
// Style rules (units stated in the question, digits, source quality) belong to content-lint.
import * as z from "zod";
import { ANSWER_MAX, ITEM_ID } from "./constants";
import { TAQRIBAN_TAGS } from "./meta";

export const TAQRIBAN_PACK_LOCALES = ["en", "fr", "ar", "es"] as const;

const text = (max: number) => z.string().min(1).max(max);
const L4 = z.strictObject({ en: text(150), fr: text(170), ar: text(150), es: text(170).optional() });
/** A short unit label for the number line ("m", "km", "people"); "" when the number has no unit. */
const unit = z.string().max(16);
const Unit = z.strictObject({ en: unit, fr: unit, ar: unit, es: unit.optional() });
const Title = z.strictObject({ en: z.string().min(1), fr: z.string().min(1), ar: z.string().min(1), es: z.string().min(1).optional() });

export const TaqribanItemSchema = z.strictObject({
  id: z.string().regex(ITEM_ID),
  tier: z.enum(["free", "pass"]),
  tags: z.array(z.enum(TAQRIBAN_TAGS)).min(1).max(3),
  text: L4,
  unit: Unit,
  /** The true value, in the unit the question states. Positive (the closeness rule needs answer > 0). */
  answer: z.number().positive().max(ANSWER_MAX),
  /** Short public citation shown on the reveal ("UN WPP 2024", "Britannica"). */
  source: z.string().min(3).max(80),
  review: z.strictObject({
    status: z.enum(["draft", "native-reviewed", "verified"]),
    /** Where the number was checked (URL or reference). Never projected. */
    ref: z.string().min(3).max(300),
  }),
});

export const TaqribanPackSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]{1,35}$/),
    game: z.literal("taqriban"),
    title: Title,
    description: Title,
    locales: z.array(z.enum(TAQRIBAN_PACK_LOCALES)).min(3),
    ageRating: z.literal("all"),
    items: z.array(TaqribanItemSchema).min(20),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string): void => ctx.addIssue({ code: "custom", path, message });
    if (new Set(p.locales).size !== p.locales.length) issue(["locales"], "duplicate locale");
    for (const l of ["en", "fr", "ar"] as const) if (!p.locales.includes(l)) issue(["locales"], `locales must include ${l}`);
    const ids = new Set<string>();
    p.items.forEach((it, i) => {
      if (ids.has(it.id)) issue(["items", i, "id"], `duplicate item id ${it.id}`);
      ids.add(it.id);
      if (new Set(it.tags).size !== it.tags.length) issue(["items", i, "tags"], "duplicate tag");
      for (const l of TAQRIBAN_PACK_LOCALES) {
        if (!p.locales.includes(l)) continue;
        if (it.text[l] === undefined || it.unit[l] === undefined) issue(["items", i, "text"], `the pack lists ${l}: text and unit need it`);
      }
    });
  });

export type TaqribanItem = z.infer<typeof TaqribanItemSchema>;
export type TaqribanPack = z.infer<typeof TaqribanPackSchema>;
