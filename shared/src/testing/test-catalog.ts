// Deterministic catalog for engine/server tests and the fixture generator (independent of the shipped word-packs/).
import type { Catalog } from "../engine/catalog";
import { loadCatalog } from "../packs";

type Side = { text: string; translit?: string | null; alt?: string[] };
const pair = (id: string, civilian: Side, undercover: Side, difficulty: 1 | 2 | 3 = 1) => ({ id, civilian, undercover, difficulty, reviewedBy: [] as string[] });

const base = { version: 1, tags: ["test"], license: "CC-BY-4.0", source: "original", status: "draft" as const };

export const TEST_PACKS = [
  {
    ...base, id: "test-en-01", locale: "en", script: "Latn", ageRating: "all",
    title: { en: "Test pack", fr: "Paquet de test", ar: "حزمة اختبار" },
    pairs: [
      pair("p001", { text: "Cat" }, { text: "Dog" }),
      pair("p002", { text: "Coffee" }, { text: "Tea" }),
      pair("p003", { text: "Beach" }, { text: "Pool" }),
      pair("p004", { text: "Pizza" }, { text: "Burger" }),
      pair("p005", { text: "Train" }, { text: "Bus" }),
      pair("p006", { text: "Guitar" }, { text: "Violin" }, 2),
      pair("p007", { text: "Ice Cream", alt: ["Icecream", "Gelato"] }, { text: "Frozen Yogurt" }, 2),
      pair("p008", { text: "Moon" }, { text: "Sun" }, 2),
      pair("p009", { text: "Doctor" }, { text: "Nurse" }, 3),
      pair("p010", { text: "Castle" }, { text: "Palace" }, 3),
    ],
  },
  {
    ...base, id: "test-en-teen-01", locale: "en", script: "Latn", ageRating: "teen",
    title: { en: "Teen test", fr: "Test ado", ar: "اختبار مراهقين" },
    pairs: Array.from({ length: 10 }, (_, i) => pair(`p${String(i + 1).padStart(3, "0")}`, { text: `Teen A${i}` }, { text: `Teen B${i}` })),
  },
  {
    ...base, id: "test-en-adult-01", locale: "en", script: "Latn", ageRating: "adult",
    title: { en: "Adult test", fr: "Test adulte", ar: "اختبار بالغين" },
    pairs: Array.from({ length: 10 }, (_, i) => pair(`p${String(i + 1).padStart(3, "0")}`, { text: `Adult A${i}` }, { text: `Adult B${i}` })),
  },
  {
    ...base, id: "test-fr-01", locale: "fr", script: "Latn", ageRating: "all",
    title: { en: "French test", fr: "Test français", ar: "اختبار فرنسي" },
    pairs: Array.from({ length: 10 }, (_, i) => pair(`p${String(i + 1).padStart(3, "0")}`, { text: `Chat ${i}` }, { text: `Chien ${i}` })),
  },
  {
    ...base, id: "test-ar-01", locale: "ar-LB", script: "Arab", ageRating: "all",
    title: { en: "Arabic test", fr: "Test arabe", ar: "اختبار عربي" },
    pairs: [
      pair("p001", { text: "منقوشة", translit: "Man2oushe", alt: ["مناقيش"] }, { text: "فطيرة", translit: "Fatayer" }),
      ...Array.from({ length: 9 }, (_, i) => pair(`p${String(i + 2).padStart(3, "0")}`, { text: `كلمة${i}` }, { text: `عبارة${i}` })),
    ],
  },
];

export const TEST_CATALOG: Catalog = loadCatalog(TEST_PACKS);

/**
 * Synthetic catalog of unique tokens for the secret-leak checker (§14.1): every civilian, undercover,
 * translit and alt string is a distinct `zz…` token that can be searched for in serialised views.
 */
export function makeTokenCatalog(pairs = 40): Catalog {
  const n4 = (i: number): string => String(i).padStart(4, "0");
  return loadCatalog([
    {
      ...base, id: "zz-tokens-01", locale: "en", script: "Latn", ageRating: "all",
      title: { en: "Tokens", fr: "Jetons", ar: "رموز" },
      pairs: Array.from({ length: pairs }, (_, i) =>
        pair(
          `p${n4(i + 1)}`,
          { text: `zzciv${n4(i + 1)}`, translit: `zzctr${n4(i + 1)}`, alt: [`zzcalt${n4(i + 1)}`] },
          { text: `zzund${n4(i + 1)}`, translit: i % 2 ? `zzutr${n4(i + 1)}` : null, alt: [`zzualt${n4(i + 1)}`] },
          ((i % 3) + 1) as 1 | 2 | 3,
        ),
      ),
    },
  ]);
}
