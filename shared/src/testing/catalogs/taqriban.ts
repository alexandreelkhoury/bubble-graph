// Taqriban's synthetic test catalog (tests, sim and fixtures only; never shipped): every text is a distinct token (no
// false positives in whole-leaf leak checks), answers spread from tiny (absolute rule) to huge (ratio rule), a third of
// the items Pass-only.
import { contentCatalog } from "../../content/catalog";
import type { ContentCatalog } from "../../content/catalog";
import type { TaqribanCatalog } from "../../games/taqriban/engine/types";
import type { TaqribanItem, TaqribanPack } from "../../games/taqriban/schema";
import { TEST_FREE_CATALOG } from "../test-catalog";

const pad = (i: number): string => String(i).padStart(3, "0");
const l4 = (token: string) => ({ en: `en ${token}?`, fr: `fr ${token} ?`, ar: `ar ${token}؟`, es: `¿es ${token}?` });
/** Answers cycling through magnitudes: 7.5, 42, 333, 8 848, 1.2 M, 3.04 T… (never a small integer the views also carry). */
const ANSWERS = [7.5, 42.195, 333, 8848, 1_234_567, 3_040_000_000_000, 0.44, 86_000_000_000, 1507.5, 96.5];

export function taqribanPack(o: { id?: string; prefix?: string; n?: number; passEvery?: number } = {}): TaqribanPack {
  const id = o.id ?? "syn-taq";
  const prefix = o.prefix ?? "sq";
  const n = o.n ?? 40;
  const items: TaqribanItem[] = Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${pad(i)}`,
    tier: o.passEvery && i % o.passEvery === o.passEvery - 1 ? "pass" : "free",
    tags: [(["geo", "people", "space", "body"] as const)[i % 4] ?? "geo"],
    text: l4(`zq${prefix}x${i}`),
    unit: { en: "u", fr: "u", ar: "و", es: "u" },
    answer: (ANSWERS[i % ANSWERS.length] as number) * (1 + Math.floor(i / ANSWERS.length)),
    source: `src ${i}`,
    review: { status: "draft", ref: `ref ${i}` },
  }));
  return { schemaVersion: 1, id, game: "taqriban", title: l4(`title ${id}`), description: l4(`desc ${id}`), locales: ["en", "fr", "ar", "es"], ageRating: "all", items };
}

/** Two packs (one with Pass items), every locale. */
export function taqribanTokenCatalog(): TaqribanCatalog {
  return { packs: [taqribanPack(), taqribanPack({ id: "syn-taq-b", prefix: "sb", n: 30, passEvery: 3 })] };
}

export function withTaqriban(taq: TaqribanCatalog, base: ContentCatalog = contentCatalog(TEST_FREE_CATALOG)): ContentCatalog {
  // ContentCatalog types the taqriban slot as PackCatalog<never> (like Likely's).
  return { ...base, taqriban: taq as unknown as ContentCatalog["taqriban"] };
}
