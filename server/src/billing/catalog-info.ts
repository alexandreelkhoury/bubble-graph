// The billing view of the shipped word packs (PAYMENTS-SPEC §1.2, §3.4 /catalog, §2.3 step 7), read straight from the
// pack JSON without the zod parse, so the stateless Worker and the Billing DO stay cheap. Every shipped pack is
// schema-validated at build time (word-packs tests, pack-lint) and again by the Room DO's loadCatalog.
import { languageOf } from "@mishana/shared/engine";
import type { AgeRating, PackTier } from "@mishana/shared/engine";
import type { Locale } from "@mishana/shared/constants";
import { PACKS } from "@mishana/word-packs";

export interface BillingPackInfo {
  id: string; locale: string; language: Locale; tier: PackTier; ageRating: AgeRating;
  title: { en: string; fr: string; ar: string }; pairCount: number;
}

/** Pure extractor (exported for tests). A pack without `tier` is premium, like WordPackSchema's default. */
export function extractPackInfo(packs: readonly unknown[]): BillingPackInfo[] {
  const out: BillingPackInfo[] = [];
  for (const raw of packs) {
    const p = raw as { id?: unknown; locale?: unknown; tier?: unknown; ageRating?: unknown; title?: Record<string, unknown>; pairs?: unknown };
    if (typeof p.id !== "string" || typeof p.locale !== "string") continue;
    const t = p.title ?? {};
    out.push({
      id: p.id, locale: p.locale, language: languageOf(p.locale),
      tier: p.tier === "free" ? "free" : "premium",
      ageRating: p.ageRating === "teen" || p.ageRating === "adult" ? p.ageRating : "all",
      title: { en: String(t.en ?? ""), fr: String(t.fr ?? ""), ar: String(t.ar ?? "") },
      pairCount: Array.isArray(p.pairs) ? p.pairs.length : 0,
    });
  }
  return out;
}

let cached: { all: BillingPackInfo[]; premiumIds: ReadonlySet<string> } | null = null;
export function billingPacks(): { all: BillingPackInfo[]; premiumIds: ReadonlySet<string> } {
  if (cached) return cached;
  const all = extractPackInfo(PACKS);
  return (cached = { all, premiumIds: new Set(all.filter((p) => p.tier === "premium").map((p) => p.id)) });
}
