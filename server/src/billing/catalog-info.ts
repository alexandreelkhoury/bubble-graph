// The billing view of the shipped content (PAYMENTS-SPEC §1.2, §3.4 /catalog, §2.3 step 7; JAMAA-PLATFORM §4.1), read
// from the raw pack JSON without the zod parse, so the stateless Worker and the Billing DO stay cheap. Every shipped
// pack is schema-validated at build time (content tests, content-lint) and again by the Room DO's content loader.
// Products are per content FAMILY (`pack_<family>`; a word pack's family is its id); entitlements hold families.
import { languageOf } from "@jamaa/shared/engine";
import type { AgeRating, LocalizedTitle } from "@jamaa/shared/engine";
import type { Locale } from "@jamaa/shared/constants";
import { GAME_IDS } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";
import { serverContent } from "../content";

export interface BillingPackInfo {
  id: string; gameId: GameId; family: string; locale: string; language: Locale;
  /** "mixed" = item-level tiers (Bluff, Likely): free items play for everyone, the family unlocks the rest. */
  tier: "free" | "premium" | "mixed"; ageRating: AgeRating;
  title: LocalizedTitle; pairCount: number;
}

const ITEM_KEYS = ["pairs", "questions", "items", "cards"] as const;

/** Pure extractor (exported for tests). A pack without `tier` is premium, like the PackHeader default. */
export function extractPackInfo(packs: readonly unknown[], gameId: GameId = "mishana"): BillingPackInfo[] {
  const out: BillingPackInfo[] = [];
  for (const raw of packs) {
    const p = raw as { id?: unknown; family?: unknown; locale?: unknown; sourceLocale?: unknown; tier?: unknown; ageRating?: unknown; title?: Record<string, unknown> } & Record<string, unknown>;
    const locale = typeof p.locale === "string" ? p.locale : typeof p.sourceLocale === "string" ? p.sourceLocale : null;
    if (typeof p.id !== "string" || locale === null) continue;
    const t = p.title ?? {};
    const items = ITEM_KEYS.map((k) => p[k]).find((v): v is unknown[] => Array.isArray(v)) ?? [];
    // JAMAA-GAP: Bluff/Likely headers are defined by their G milestones; an item with its own `tier` makes the pack mixed.
    const itemTiers = items.some((i) => i !== null && typeof i === "object" && "tier" in i);
    out.push({
      id: p.id, gameId, family: typeof p.family === "string" ? p.family : p.id, locale, language: languageOf(locale),
      tier: itemTiers ? "mixed" : p.tier === "free" ? "free" : "premium",
      ageRating: p.ageRating === "teen" || p.ageRating === "adult" ? p.ageRating : "all",
      title: { en: String(t.en ?? ""), fr: String(t.fr ?? ""), ar: String(t.ar ?? ""), ...(typeof t.es === "string" ? { es: t.es } : {}) },
      pairCount: items.length,
    });
  }
  return out;
}

export interface BillingCatalogInfo {
  all: BillingPackInfo[];
  /** Families with sellable content (tier premium or mixed): the only families an entitlement may carry. */
  premiumIds: ReadonlySet<string>;
}

let cached: BillingCatalogInfo | null = null;
export function billingPacks(): BillingCatalogInfo {
  if (cached) return cached;
  const all = GAME_IDS.flatMap((id) => extractPackInfo(serverContent().raw(id), id));
  return (cached = { all, premiumIds: new Set(all.filter((p) => p.tier !== "free").map((p) => p.family)) });
}

/** Test hook: forget the cache (after installing another content loader). */
export function resetBillingPacks(): void {
  cached = null;
}
