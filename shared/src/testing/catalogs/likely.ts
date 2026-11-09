// JAMAA-PLATFORM §2.2 "leak tests use synthetic catalogs" + §6.6: Likely's test catalogs (tests, sim and fixtures only;
// never shipped).
// - likelyTokenCatalog(): every prompt and award is a distinct token (no false positives in whole-leaf checks), with a
//   Family pack (half free) and a Spicy pack (adult, a third of its cards name a player);
// - LIKELY_DEMO_CATALOG: a small readable Family pack for the published fixtures (shared/fixtures/v2/games/likely/), so
//   lanes B and C build their screens against real text and real RTL. EN/FR/AR come from the project's own GAME-LIKELY
//   §14 drafts; ES is written for this demo (draft, native review pending like every ES line).
import { contentCatalog } from "../../content/catalog";
import type { ContentCatalog } from "../../content/catalog";
import type { LikelyCatalog } from "../../games/likely/engine/catalog";
import type { LikelyCard, LikelyPack } from "../../games/likely/schema";
import type { LikelyTag } from "../../games/likely/meta";
import { TEST_FREE_CATALOG } from "../test-catalog";

const FAMILY_TAGS: LikelyTag[] = ["party", "food", "family", "travel", "habits", "lebanon", "tech", "music", "sport", "future"];
const pad = (i: number): string => String(i).padStart(3, "0");
const l4 = (token: string) => ({ en: `en ${token}`, fr: `de fr ${token}`, ar: `ar ${token}`, es: `es ${token}` });

/** A synthetic Family pack: `n` cards, every `freeEvery`-th one free, one tag each cycling through the Family tags. */
export function likelyFamilyPack(o: { id?: string; n?: number; freeEvery?: number } = {}): LikelyPack {
  const id = o.id ?? "syn-family";
  const n = o.n ?? 40;
  const cards: LikelyCard[] = Array.from({ length: n }, (_, i) => ({
    id: `${id}-${pad(i)}`,
    tier: i % (o.freeEvery ?? 2) === 0 ? "free" : "pass",
    spice: 0,
    namesPlayer: false,
    tags: [FAMILY_TAGS[i % FAMILY_TAGS.length] as LikelyTag],
    prompt: l4(`zp${id.replace(/-/g, "")}x${i}`),
    award: l4(`za${id.replace(/-/g, "")}x${i}`),
    review: { status: "draft" },
  }));
  return { schemaVersion: 1, id, game: "likely", title: l4(`title ${id}`), description: l4(`desc ${id}`), locales: ["en", "fr", "ar", "es"], ageRating: "all", cards };
}

/** A synthetic Spicy pack (Pass, adult): every `namedEvery`-th card names a player with "{player}". */
export function likelySpicyPack(o: { id?: string; n?: number; namedEvery?: number } = {}): LikelyPack {
  const id = o.id ?? "syn-spicy";
  const n = o.n ?? 30;
  const cards: LikelyCard[] = Array.from({ length: n }, (_, i) => {
    const named = i % (o.namedEvery ?? 3) === 0;
    const tok = `zp${id.replace(/-/g, "")}x${i}`;
    const prompt = named ? { en: `en ${tok} {player}`, fr: `de fr ${tok} {player}`, ar: `ar ${tok} {player}`, es: `es ${tok} {player}` } : l4(tok);
    return {
      id: `${id}-${pad(i)}`, tier: "pass", spice: (i % 2 === 0 ? 1 : 2) as 1 | 2, namesPlayer: named,
      tags: [i % 4 === 0 ? "party" : "romance"] as LikelyTag[], prompt, award: l4(`za${id.replace(/-/g, "")}x${i}`), review: { status: "draft" },
    };
  });
  return { schemaVersion: 1, id, game: "likely", title: l4(`title ${id}`), description: l4(`desc ${id}`), locales: ["en", "fr", "ar", "es"], ageRating: "adult", cards };
}

/** Family + Spicy synthetic packs (the full catalog = a Pass room). */
export function likelyTokenCatalog(): LikelyCatalog {
  return { packs: [likelyFamilyPack(), likelySpicyPack()] };
}

/** Only the free cards of the Family pack and no adult pack (what a free room may play, §4.4). */
export function likelyFreeCatalog(): LikelyCatalog {
  const fam = likelyFamilyPack();
  return { packs: [{ ...fam, cards: fam.cards.filter((c) => c.tier === "free") }] };
}

// ---------- demo pack for fixtures (readable, EN/FR/AR/ES) ----------

type Row = [id: string, tag: LikelyTag, en: string, enAward: string, fr: string, frAward: string, ar: string, arAward: string, es: string, esAward: string];
const DEMO_ROWS: Row[] = [
  ["fam-001", "party", "cry at a wedding", "Waterworks Award", "de pleurer à un mariage", "Prix des grandes eaux", "يبكي بعرس", "جايزة الدموع", "llorar en una boda", "Premio Cataratas"],
  ["fam-002", "habits", "forget their own birthday", "Goldfish Award", "d'oublier son propre anniversaire", "Prix poisson rouge", "ينسى عيد ميلادو", "جايزة السمكة الحمرا", "olvidar su propio cumpleaños", "Premio Pez Dorado"],
  ["fam-003", "tech", "go viral on social media", "Viral Award", "de faire le buzz sur les réseaux", "Prix du buzz", "يصير ترند عالسوشيال ميديا", "جايزة الترند", "hacerse viral en redes", "Premio Viral"],
  ["fam-004", "food", "eat the last piece without asking", "Last Bite Award", "de manger le dernier morceau sans demander", "Prix du dernier morceau", "ياكل آخر شقفة بلا ما يسأل", "جايزة آخر لقمة", "comerse el último trozo sin preguntar", "Premio Último Bocado"],
  ["fam-005", "travel", "get lost even with GPS", "Lost & Found Award", "de se perdre même avec le GPS", "Prix de l'orientation", "يضيع حتى مع الـGPS", "جايزة الضياع", "perderse incluso con GPS", "Premio Brújula Rota"],
  ["fam-007", "party", "still be dancing at sunrise", "Sunrise Award", "de danser encore au lever du soleil", "Prix de l'aube", "يضلّ يرقص لطلوع الضو", "جايزة طلوع الضو", "seguir bailando al amanecer", "Premio Amanecer"],
  ["fam-008", "habits", "arrive late to their own party", "Fashionably Late Award", "d'arriver en retard à sa propre fête", "Prix du retard chic", "يوصل متأخر عحفلتو", "جايزة التأخير", "llegar tarde a su propia fiesta", "Premio Tarde Pero Seguro"],
  ["fam-009", "habits", "text \"on my way\" while still in bed", "On My Way Award", "d'écrire « j'arrive » encore au lit", "Prix du « j'arrive »", "يبعت «واصل» وهوّي بعدو بالتخت", "جايزة «واصل»", "escribir «ya voy» desde la cama", "Premio «Ya Voy»"],
  ["fam-011", "lebanon", "lead the dabke line", "Dabke Leader Award", "de mener la dabké", "Prix de la dabké", "يمسك راس الدبكة", "جايزة راس الدبكة", "encabezar la dabke", "Premio Cabeza de Dabke"],
  ["fam-012", "habits", "know the gossip before anyone else", "Breaking News Award", "de connaître les potins avant tout le monde", "Prix du scoop", "يعرف الأخبار قبل الكل", "جايزة الخبر العاجل", "enterarse del chisme antes que nadie", "Premio Exclusiva"],
  ["fam-014", "habits", "fall asleep during a movie", "Nap Award", "de s'endormir devant un film", "Prix de la sieste", "ينام بنص الفيلم", "جايزة القيلولة", "dormirse en mitad de la película", "Premio Siesta"],
  ["fam-017", "tech", "look for their phone while holding it", "Phone Hunt Award", "de chercher son téléphone en le tenant", "Prix du téléphone perdu", "يدوّر عتلفونو وهوّي بإيدو", "جايزة وين تلفوني؟", "buscar el móvil teniéndolo en la mano", "Premio ¿Y Mi Móvil?"],
];

export const LIKELY_DEMO_PACK: LikelyPack = {
  schemaVersion: 1, id: "likely-family", game: "likely",
  title: { en: "Family Night", fr: "Soirée en famille", ar: "سهرة عيلة", es: "Noche en familia" },
  description: { en: "Warm-up cards for everyone", fr: "Des cartes pour tout le monde", ar: "كروت للكل", es: "Cartas para todos" },
  locales: ["en", "fr", "ar", "es"], ageRating: "all",
  cards: DEMO_ROWS.map(([id, tag, en, enA, fr, frA, ar, arA, es, esA]) => ({
    id, tier: "free", spice: 0, namesPlayer: false, tags: [tag],
    prompt: { en, fr, ar, es }, award: { en: enA, fr: frA, ar: arA, es: esA }, review: { status: "draft" },
  })),
};
export const LIKELY_DEMO_CATALOG: LikelyCatalog = { packs: [LIKELY_DEMO_PACK] };

/** A full platform ContentCatalog: the Mish Ana! test packs plus the given Likely catalog (others empty). */
export function withLikely(likely: LikelyCatalog, base: ContentCatalog = contentCatalog(TEST_FREE_CATALOG)): ContentCatalog {
  // JAMAA-GAP (P1): ContentCatalog types the likely slot as PackCatalog<never> until P widens it to LikelyPack.
  return { ...base, likely: likely as unknown as ContentCatalog["likely"] };
}
