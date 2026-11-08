// GAME-LIKELY §11: the engine's view of the content (types only from the zod schema; no zod at runtime).
import type { PackCatalog } from "../../../content/types";
import type { Locale } from "../../../constants";
import type { LikelyMode } from "../meta";
import type { LikelyCard, LikelyPack } from "../schema";

export type { LikelyCard, LikelyPack };
/** The engine's `C`: the room's playable Likely packs (JAMAA-PLATFORM §4.4 playableContent). */
export type LikelyCatalog = PackCatalog<LikelyPack>;

export interface Candidate { pack: LikelyPack; card: LikelyCard }

/** §9.1 rule 5: family never draws `spice > 0` or a named card, whatever the packs say; spicy draws from every card. */
export function cardAllowed(card: LikelyCard, mode: LikelyMode): boolean {
  return mode === "spicy" || (card.spice === 0 && !card.namesPlayer);
}

/** A pack may serve this mode: adult packs only to a Spicy room (§9.1 rule 7). */
export function packAllowed(pack: LikelyPack, mode: LikelyMode): boolean {
  return mode === "spicy" || pack.ageRating !== "adult";
}

/** The cards of one pack this mode may draw (any language). */
export function eligibleInPack(pack: LikelyPack, mode: LikelyMode): LikelyCard[] {
  return packAllowed(pack, mode) ? pack.cards.filter((c) => cardAllowed(c, mode)) : [];
}

/** Packs playable in `locale` for `mode`. */
export function packsFor(content: LikelyCatalog, mode: LikelyMode, locale: Locale): LikelyPack[] {
  return content.packs.filter((p) => p.locales.includes(locale) && packAllowed(p, mode));
}

/** Every card the room could draw for these settings (mode, pack filter, language), ignoring history. */
export function eligibleCards(content: LikelyCatalog, s: { packIds: readonly string[]; mode: LikelyMode }, locale: Locale): Candidate[] {
  const out: Candidate[] = [];
  for (const pack of packsFor(content, s.mode, locale)) {
    if (s.packIds.length > 0 && !s.packIds.includes(pack.id)) continue;
    for (const card of pack.cards) {
      if (!cardAllowed(card, s.mode) || card.prompt[locale] === undefined || card.award[locale] === undefined) continue;
      out.push({ pack, card });
    }
  }
  return out;
}

/** True when a Spicy card is playable in `locale` (the `mode` row is hidden otherwise, §9). */
export function spicyPlayable(content: LikelyCatalog, locale: Locale): boolean {
  return content.packs.some((p) => p.locales.includes(locale) && p.cards.some((c) => c.spice > 0 && c.prompt[locale] !== undefined));
}

/** The card text in `locale` (en if a translation is missing, which the schema prevents for listed locales). */
export function textIn(l: { en: string; fr: string; ar: string; es?: string | undefined }, locale: Locale): string {
  return l[locale] ?? l.en;
}
