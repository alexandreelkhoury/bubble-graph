// GAME-LIKELY §11.2: the Likely pack schema (zod, strict), read through the platform ContentAdapter (content.ts).
// The hard rules the engine relies on (family packs stay family, `{player}` ⇔ `namesPlayer`, every listed locale
// present) are enforced here; style rules (EN lowercase start, FR "de", review flags…) belong to content-lint (lane D).
import * as z from "zod";
import { LIKELY_TAGS } from "./meta";

export const PLAYER_TOKEN = "{player}";
export const LIKELY_PACK_LOCALES = ["en", "fr", "ar", "es"] as const;

const L3 = z.strictObject({
  en: z.string().min(1).max(60),
  fr: z.string().min(1).max(70),
  ar: z.string().min(1).max(60),
  es: z.string().min(1).max(70).optional(),   // required (refinement below) when the pack lists es
});
const Title = z.strictObject({ en: z.string().min(1), fr: z.string().min(1), ar: z.string().min(1), es: z.string().min(1).optional() });

export const LikelyCardSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  tier: z.enum(["free", "pass"]),
  spice: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  namesPlayer: z.boolean().default(false),
  tags: z.array(z.enum(LIKELY_TAGS)).min(1).max(3),
  prompt: L3,
  award: L3,
  review: z.strictObject({ status: z.enum(["draft", "native-reviewed"]) }),
});

const count = (s: string, needle: string): number => s.split(needle).length - 1;

export const LikelyPackSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]{1,35}$/),
    game: z.literal("likely"),
    title: Title,
    description: Title,
    locales: z.array(z.enum(LIKELY_PACK_LOCALES)).min(3).default(["en", "fr", "ar"]),
    ageRating: z.enum(["all", "adult"]),
    cards: z.array(LikelyCardSchema).min(30),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string): void => ctx.addIssue({ code: "custom", path, message });
    if (new Set(p.locales).size !== p.locales.length) issue(["locales"], "duplicate locale");
    for (const l of ["en", "fr", "ar"] as const) if (!p.locales.includes(l)) issue(["locales"], `locales must include ${l}`);
    const ids = new Set<string>();
    p.cards.forEach((c, i) => {
      const at = (k: string): (string | number)[] => ["cards", i, k];
      if (ids.has(c.id)) issue(at("id"), `duplicate card id ${c.id}`);
      ids.add(c.id);
      if (p.ageRating === "all" && (c.spice !== 0 || c.namesPlayer)) issue(at("spice"), "spice or a named card in an \"all\" pack");
      if (p.ageRating === "adult" && c.spice === 0) issue(at("spice"), "spice 0 in an \"adult\" pack");
      if (c.namesPlayer && c.spice === 0) issue(at("namesPlayer"), "a named card needs spice ≥ 1");
      if (c.tags.includes("romance") && c.spice === 0) issue(at("tags"), "romance needs spice ≥ 1");
      if (new Set(c.tags).size !== c.tags.length) issue(at("tags"), "duplicate tag");
      for (const l of LIKELY_PACK_LOCALES) {
        const prompt = c.prompt[l];
        const award = c.award[l];
        if (prompt === undefined || award === undefined) {
          if (p.locales.includes(l)) issue(at("prompt"), `the pack lists ${l}: prompt and award need it`);
          continue;
        }
        if (count(prompt, PLAYER_TOKEN) !== (c.namesPlayer ? 1 : 0)) issue(at("prompt"), `${l}: {player} must appear ${c.namesPlayer ? "exactly once" : "nowhere"}`);
        if (award.includes(PLAYER_TOKEN)) issue(at("award"), `${l}: {player} in an award`);
      }
    });
  });

export type LikelyCard = z.infer<typeof LikelyCardSchema>;
export type LikelyPack = z.infer<typeof LikelyPackSchema>;
