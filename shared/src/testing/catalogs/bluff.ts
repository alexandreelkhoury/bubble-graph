// JAMAA-PLATFORM §2.2 "leak tests use synthetic catalogs" + §6.5: Bluff's test catalogs (tests, sim and fixtures only).
// - bluffTokenCatalog(): every secret string (truth, alternatives, house lies, notes) is a distinct token, so the
//   whole-leaf leak checker never sees a false positive from real content;
// - bluffDemoCatalog(): a small readable catalog for the published fixtures (shared/fixtures/v2/games/bluff/), built
//   from the project's own GAME-BLUFF §14 drafts, so lanes B and C code against realistic text (EN + AR, RTL).
import type { BluffCatalog, BluffItem, BluffPack, BluffType } from "../../games/bluff/engine/catalog";
import type { Locale } from "../../constants";

const n2 = (i: number): string => String(i).padStart(2, "0");

/** One synthetic item; `tag` is unique per item and appears in every one of its strings. */
export function bluffTokenItem(id: string, type: BluffType, i: number, over: Partial<BluffItem> = {}): BluffItem {
  const tag = id.replace(/[^a-z0-9]/g, "");
  const noTruth = type === "no_truth";
  return {
    id,
    type,
    tier: i % 3 === 0 ? "pass" : "free",
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    knownIn: [],
    prompt: { original: `Zprompt ${tag} opens`, translit: null, display: { ar: `سؤال ${tag}` } },
    truth: noTruth ? {} : { en: `Ztruth ${tag} kumquat`, ar: `حقيقة ${tag} تفاح` },
    truthAlt: noTruth ? {} : { en: [`Zalt ${tag} wombat`], ar: [`بديل ${tag} موز`] },
    houseLies: {
      en: [`Zhouse ${tag} apricot`, `Zhouse ${tag} bramble`, `Zhouse ${tag} cobalt`],
      ar: [`بيت ${tag} ليمون`, `بيت ${tag} زيتون`, `بيت ${tag} رمان`],
    },
    note: { en: `Znote ${tag} explained`, ar: `ملاحظة ${tag}` },
    review: { status: "verified", source: "synthetic" },
    ...over,
  };
}

export function bluffPack(id: string, items: BluffItem[], over: Partial<BluffPack> = {}): BluffPack {
  return {
    schemaVersion: 1, id, game: "bluff",
    title: { en: id, fr: id, ar: id, es: id }, description: { en: id, fr: id, ar: id, es: id },
    sourceLocale: "en", playableIn: ["en", "ar"], ageRating: "all", fallbackHouseLies: {}, items, ...over,
  };
}

export interface TokenCatalogSize { sayings: number; facts: number; words: number; finals: number }

/** The full synthetic catalog (pass items included: what a Pass room plays). */
export function bluffTokenCatalog(n: Partial<TokenCatalogSize> = {}): BluffCatalog {
  const size: TokenCatalogSize = { sayings: 12, facts: 12, words: 6, finals: 4, ...n };
  const range = (k: number): number[] => Array.from({ length: k }, (_, i) => i + 1);
  return {
    packs: [
      bluffPack("syn-sayings", range(size.sayings).map((i) => bluffTokenItem(`s${n2(i)}`, "proverb_end", i))),
      bluffPack("syn-facts", range(size.facts).map((i) => bluffTokenItem(`f${n2(i)}`, "fact_blank", i))),
      bluffPack("syn-words", range(size.words).map((i) => bluffTokenItem(`w${n2(i)}`, "word_meaning", i)), {
        fallbackHouseLies: { word_meaning: { en: ["Zfallback word lie"], ar: ["احتياط كلمة"] } },
      }),
      // Every final is free: every room needs one (GAME-BLUFF §11.5).
      bluffPack("syn-finals", range(size.finals).map((i) => bluffTokenItem(`n${n2(i)}`, "no_truth", i, { tier: "free" }))),
    ],
  };
}

/** What a free room plays: only `tier: "free"` items (the content adapter's `playable`). */
export function freeOnly(cat: BluffCatalog): BluffCatalog {
  return { packs: cat.packs.map((p) => ({ ...p, items: p.items.filter((i) => i.tier === "free") })).filter((p) => p.items.length > 0) };
}

// ---------------- demo catalog (fixtures)

type L = Partial<Record<Locale, string>>;
type LL = Partial<Record<Locale, string[]>>;
const demo = (id: string, type: BluffType, prompt: BluffItem["prompt"], truth: L, houseLies: LL, note: L, over: Partial<BluffItem> = {}): BluffItem => ({
  id, type, tier: "free", difficulty: 2, knownIn: [], prompt, truth, truthAlt: {}, houseLies, note,
  review: { status: "verified", source: "GAME-BLUFF §14 (demo fixture)" }, ...over,
});

/** A readable EN/AR catalog, enough for a Short game (2 sayings, 2 facts, 1 final) with spares for skips. */
export function bluffDemoCatalog(): BluffCatalog {
  return {
    packs: [
      bluffPack("demo-lb-proverbs", [
        demo("demo-prov-01", "proverb_end", { original: "اللي بياكل العصي…", translit: "illi byekol el-3asé…", display: { en: "The one who takes the beating…" } },
          { ar: "مش متل اللي بيعدها", en: "is not like the one counting the blows" },
          { ar: ["بينام بكير", "بيصير أستاذ", "بيتعلم يركض"], en: ["learns to run faster", "sleeps early tonight", "becomes the teacher"] },
          { ar: "بس اللي عم يتوجع بيعرف شو يعني", en: "Only the one who suffers knows how it feels" }),
        demo("demo-prov-02", "proverb_end", { original: "يا رايح…", translit: "ya rayeh…", display: { en: "You who are leaving…" } },
          { ar: "كتر ملايح", en: "leave lots of kindness behind" },
          { ar: ["سكر الباب وراك", "ما تنسى المفاتيح", "خبرنا وين رايح"], en: ["close the door behind you", "don't forget the keys", "bring back some sweets"] },
          { ar: "فل عالحلو، الناس بتتذكر كيف فليت", en: "Leave on good terms: people remember how you left" }),
        demo("demo-prov-03", "proverb_end", { original: "بكرا بيدوب التلج…", translit: "bukra bidoub et-talj…", display: { en: "Tomorrow the snow melts…" } },
          { ar: "وبيبان المرج", en: "and the meadow shows" },
          { ar: ["وبينزل الصيف عالبحر", "وبتطلع الطريق", "وبتزهر الدني"], en: ["and the road opens again", "and summer heads to the sea", "and the goats come home"] },
          { ar: "الحقيقة دايماً بتبين", en: "The truth always comes out" }),
      ], { sourceLocale: "ar", playableIn: ["ar", "en"] }),
      bluffPack("demo-world-facts", [
        demo("demo-fact-01", "fact_blank", { original: "Wombat droppings are shaped like ___", translit: null, display: { ar: "فضلات حيوان الومبات شكلها ___" } },
          { en: "cubes", ar: "مكعبات" }, { en: ["tiny stars", "perfect marbles", "little hearts"], ar: ["نجوم صغار", "طابات مدورة", "قلوب صغار"] },
          { en: "Their intestines have stiff and soft bands that mould the corners", ar: "مصارينها بتعمل الزوايا" }),
        demo("demo-fact-02", "fact_blank", { original: "An octopus has ___ hearts", translit: null, display: { ar: "الأخطبوط عندو ___ قلوب" } },
          { en: "three", ar: "تلات" }, { en: ["two", "eight", "none at all"], ar: ["تنين", "تمانية", "ولا قلب"] },
          { en: "Two pump blood to the gills, one to the rest of the body", ar: "تنين للخياشيم وواحد لباقي الجسم" }),
        demo("demo-fact-03", "fact_blank", { original: "Butterflies taste their food with their ___", translit: null, display: { ar: "الفراشات بتدوق أكلها بـ___" } },
          { en: "feet", ar: "إجريها" }, { en: ["wings", "eyes", "tails"], ar: ["جوانحها", "عيونها", "ذنبها"] },
          { en: "Taste sensors sit on their feet: they taste the leaf by standing on it", ar: "حساسات الطعم موجودة بإجريها" }),
      ], { sourceLocale: "en", playableIn: ["en", "ar"] }),
      bluffPack("demo-no-truth", [
        demo("demo-final-01", "no_truth", { original: "What was the very first thing a cat ever said to a human?", translit: null, display: { ar: "شو أول جملة قالها بس لإنسان؟" } },
          {}, { en: ["You may feed me now", "This chair is mine", "I was here first"], ar: ["هلق فيك تطعميني", "هالكرسي إلي", "أنا كنت هون قبلك"] }, {}),
        demo("demo-final-02", "no_truth", { original: "Why do socks vanish in the washing machine?", translit: null, display: { ar: "ليش الكلسات بيختفوا بالغسالة؟" } },
          {}, { en: ["They go on holiday without telling anyone", "The machine keeps one as a tip", "They escape down the drain at night"], ar: ["بيسافروا بلا ما يخبروا حدا", "الغسالة بتاخد وحدة بخشيش", "بيهربوا من البربيش بالليل"] }, {}),
      ], { sourceLocale: "en", playableIn: ["en", "ar"] }),
    ],
  };
}
