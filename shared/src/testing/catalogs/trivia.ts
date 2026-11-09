// JAMAA-PLATFORM §2.2 / §6.1: Trivia's test catalogs (tests, fixtures and the sim only; never shipped).
// - `synthPack` / TRIVIA_SYNTH_CATALOG: unique-token questions, so `secretsFor` values match by whole-leaf equality
//   without false positives (leak and property tests).
// - TRIVIA_DEMO_CATALOG: a small, readable 9-question quiz in en/fr/ar/es for the published fixtures, so lanes B and C
//   build their screens against real-looking text (and real RTL) instead of tokens. Original writing, family-friendly.
import type { Locale } from "../../constants";
import { contentCatalog } from "../../content/catalog";
import type { ContentCatalog } from "../../content/catalog";
import type { Domain, Topic } from "../../content/vocab";
import type { TriviaCatalog, TriviaPack, TriviaQuestion } from "../../games/trivia/engine/types";
import { TEST_FREE_CATALOG } from "../test-catalog";

export const TRIVIA_LOCALES: readonly Locale[] = ["en", "fr", "ar", "es"];

export interface SynthPackOptions {
  family?: string;
  locale?: Locale;
  n?: number;
  stars?: 1 | 2 | 3;
  domain?: Domain;
  tier?: "free" | "premium";
  /** Difficulty of question i (default cycle 1,2,2,3,1,2,3,2: mean 2). */
  diff?: (i: number) => 1 | 2 | 3;
  /** A tf question every k questions (0 = none; default 8). */
  tfEvery?: number;
  easyIn?: (i: number) => Locale[];
  /** An `explain` line every k questions (0 = none; default 3). */
  explainEvery?: number;
  topics?: readonly Topic[];
}

const DIFF: readonly (1 | 2 | 3)[] = [1, 2, 2, 3, 1, 2, 3, 2];
const TOPIC_CYCLE: readonly Topic[] = ["music", "geography", "football", "food", "history", "dance"];

/** A pack whose every string is a unique token `<family>-<locale>-<what>-<i>`. Authored answers are spread over 0..3. */
export function synthPack(o: SynthPackOptions = {}): TriviaPack {
  const family = o.family ?? "syn-quiz";
  const locale = o.locale ?? "en";
  const n = o.n ?? 40;
  const tfEvery = o.tfEvery ?? 8;
  const explainEvery = o.explainEvery ?? 3;
  const topics = o.topics ?? TOPIC_CYCLE;
  const tok = (k: string): string => `${family}-${locale}-${k}`;
  const questions: TriviaQuestion[] = Array.from({ length: n }, (_, i) => {
    const tf = tfEvery > 0 && i % tfEvery === tfEvery - 1;
    const q: TriviaQuestion = {
      id: `q${String(i + 1).padStart(3, "0")}`,
      type: tf ? "tf" : "mc4",
      text: tok(`text-${i}`),
      options: tf ? [tok(`true-${i}`), tok(`false-${i}`)] : [0, 1, 2, 3].map((k) => tok(`opt-${i}-${k}`)),
      answer: tf ? i % 2 : i % 4,
      topic: topics[i % topics.length] as Topic,
      difficulty: o.diff ? o.diff(i) : (DIFF[i % DIFF.length] as 1 | 2 | 3),
      easyIn: o.easyIn ? o.easyIn(i) : [],
      source: tok(`src-${i}`),
    };
    if (explainEvery > 0 && i % explainEvery === 0) q.explain = tok(`explain-${i}`);
    return q;
  });
  return {
    id: `${family}-${locale}`, family, game: "trivia", version: 1, locale, script: locale === "ar" ? "Arab" : "Latn",
    title: { en: `${family} title en`, fr: `${family} title fr`, ar: `${family} title ar`, es: `${family} title es` },
    domain: o.domain ?? "lebanon", topics: [...new Set(questions.map((q) => q.topic))], featuredTopics: topics.slice(0, 3),
    stars: o.stars ?? 2, ageRating: "all", tier: o.tier ?? "free", license: "test", source: "synthetic", status: "draft",
    reviewedBy: [], tags: [], questions,
  };
}

/** A free 40-question quiz in all four locales + a Pass-only "world" quiz in en/fr (synthetic tokens). */
export const TRIVIA_SYNTH_CATALOG: TriviaCatalog = {
  packs: [
    ...TRIVIA_LOCALES.map((locale) => synthPack({ locale })),
    ...(["en", "fr"] as const).map((locale) => synthPack({ family: "syn-world", locale, tier: "premium", domain: "world", stars: 1, n: 24, topics: ["science", "nature", "art"] })),
  ],
};

// ─── the demo quiz (fixtures) ────────────────────────────────────────────────────────────────────────────────────────

type L4 = Record<"en" | "fr" | "ar" | "es", string>;
interface DemoQ {
  type: "mc4" | "tf"; topic: Topic; difficulty: 1 | 2 | 3; easyIn?: Locale[];
  text: L4;
  /** mc4: the right option FIRST (rotated into a spread position below); tf: [True, False] labels. */
  options: [L4, L4, L4, L4] | [L4, L4];
  tfAnswer?: 0 | 1;
  explain?: L4;
}
const TF: [L4, L4] = [
  { en: "True", fr: "Vrai", ar: "صح", es: "Verdadero" },
  { en: "False", fr: "Faux", ar: "غلط", es: "Falso" },
];
const DEMO: DemoQ[] = [
  {
    type: "mc4", topic: "geography", difficulty: 1,
    text: { en: "Which ocean is the largest?", fr: "Quel est le plus grand océan ?", ar: "أيّا محيط هوّي الأكبر؟", es: "¿Cuál es el océano más grande?" },
    options: [
      { en: "The Pacific", fr: "Le Pacifique", ar: "الهادئ", es: "El Pacífico" },
      { en: "The Atlantic", fr: "L'Atlantique", ar: "الأطلسي", es: "El Atlántico" },
      { en: "The Indian Ocean", fr: "L'océan Indien", ar: "الهندي", es: "El Índico" },
      { en: "The Arctic", fr: "L'Arctique", ar: "المتجمّد الشمالي", es: "El Ártico" },
    ],
    explain: { en: "It is bigger than all of Earth's land put together.", fr: "Il est plus vaste que toutes les terres émergées réunies.", ar: "أكبر من كل اليابسة عالأرض إذا جمعناها.", es: "Es más grande que todas las tierras del planeta juntas." },
  },
  {
    type: "mc4", topic: "food", difficulty: 1, easyIn: ["ar"],
    text: { en: "Hummus is mostly made from which legume?", fr: "Le houmous est surtout fait avec quelle légumineuse ?", ar: "الحمّص بطحينة بيتعمل بالأساس من أيّا حبوب؟", es: "¿De qué legumbre se hace sobre todo el hummus?" },
    options: [
      { en: "Chickpeas", fr: "Les pois chiches", ar: "الحمّص", es: "Garbanzos" },
      { en: "Lentils", fr: "Les lentilles", ar: "العدس", es: "Lentejas" },
      { en: "Fava beans", fr: "Les fèves", ar: "الفول", es: "Habas" },
      { en: "Green peas", fr: "Les petits pois", ar: "البازيلّا", es: "Guisantes" },
    ],
  },
  {
    type: "tf", topic: "nature", difficulty: 1, tfAnswer: 0,
    text: { en: "An octopus has three hearts.", fr: "Une pieuvre a trois cœurs.", ar: "الأخطبوط عندو تلات قلوب.", es: "Un pulpo tiene tres corazones." },
    options: TF,
    explain: { en: "Two pump blood through the gills, one through the rest of the body.", fr: "Deux irriguent les branchies, le troisième le reste du corps.", ar: "تنين للخياشيم، والتالت لباقي الجسم.", es: "Dos bombean sangre a las branquias y el tercero al resto del cuerpo." },
  },
  {
    type: "mc4", topic: "science", difficulty: 2,
    text: { en: "Which planet has the shortest year?", fr: "Quelle planète a l'année la plus courte ?", ar: "أيّا كوكب سنتو الأقصر؟", es: "¿Qué planeta tiene el año más corto?" },
    options: [
      { en: "Mercury", fr: "Mercure", ar: "عطارد", es: "Mercurio" },
      { en: "Venus", fr: "Vénus", ar: "الزهرة", es: "Venus" },
      { en: "Mars", fr: "Mars", ar: "المرّيخ", es: "Marte" },
      { en: "Earth", fr: "La Terre", ar: "الأرض", es: "La Tierra" },
    ],
    explain: { en: "It circles the Sun in about 88 days.", fr: "Il fait le tour du Soleil en 88 jours environ.", ar: "بيلفّ حول الشمس بحوالي ٨٨ يوم.", es: "Da la vuelta al Sol en unos 88 días." },
  },
  {
    type: "mc4", topic: "music", difficulty: 2,
    text: { en: "How many keys does a standard modern piano have?", fr: "Combien de touches compte un piano moderne standard ?", ar: "قدّيش في مفاتيح بالبيانو العادي؟", es: "¿Cuántas teclas tiene un piano moderno estándar?" },
    options: [
      { en: "88", fr: "88", ar: "٨٨", es: "88" },
      { en: "76", fr: "76", ar: "٧٦", es: "76" },
      { en: "92", fr: "92", ar: "٩٢", es: "92" },
      { en: "64", fr: "64", ar: "٦٤", es: "64" },
    ],
    explain: { en: "52 white keys and 36 black ones.", fr: "52 touches blanches et 36 noires.", ar: "٥٢ أبيض و٣٦ أسود.", es: "52 teclas blancas y 36 negras." },
  },
  {
    type: "mc4", topic: "geography", difficulty: 1,
    text: { en: "Which is the longest river in Africa?", fr: "Quel est le plus long fleuve d'Afrique ?", ar: "شو أطول نهر بإفريقيا؟", es: "¿Cuál es el río más largo de África?" },
    options: [
      { en: "The Nile", fr: "Le Nil", ar: "النيل", es: "El Nilo" },
      { en: "The Congo", fr: "Le Congo", ar: "الكونغو", es: "El Congo" },
      { en: "The Niger", fr: "Le Niger", ar: "النيجر", es: "El Níger" },
      { en: "The Zambezi", fr: "Le Zambèze", ar: "الزمبيزي", es: "El Zambeze" },
    ],
  },
  {
    type: "mc4", topic: "science", difficulty: 3,
    text: { en: "Which element has the chemical symbol K?", fr: "Quel élément a pour symbole chimique K ?", ar: "أيّا عنصر رمزو الكيميائي K؟", es: "¿Qué elemento tiene el símbolo químico K?" },
    options: [
      { en: "Potassium", fr: "Le potassium", ar: "البوتاسيوم", es: "Potasio" },
      { en: "Krypton", fr: "Le krypton", ar: "الكريبتون", es: "Kriptón" },
      { en: "Calcium", fr: "Le calcium", ar: "الكالسيوم", es: "Calcio" },
      { en: "Carbon", fr: "Le carbone", ar: "الكربون", es: "Carbono" },
    ],
    explain: { en: "The K comes from its Latin name, kalium.", fr: "Le K vient de son nom latin, kalium.", ar: "الـK جايي من اسمو اللاتيني «كاليوم».", es: "La K viene de su nombre latino, kalium." },
  },
  {
    type: "mc4", topic: "sports", difficulty: 1,
    text: { en: "How many players does a football team have on the pitch?", fr: "Combien de joueurs une équipe de foot aligne-t-elle sur le terrain ?", ar: "قدّيش لاعب بيكون لكل فريق فوتبول عالملعب؟", es: "¿Cuántos jugadores tiene un equipo de fútbol en el campo?" },
    options: [
      { en: "11", fr: "11", ar: "١١", es: "11" },
      { en: "10", fr: "10", ar: "١٠", es: "10" },
      { en: "9", fr: "9", ar: "٩", es: "9" },
      { en: "12", fr: "12", ar: "١٢", es: "12" },
    ],
  },
  {
    type: "tf", topic: "nature", difficulty: 2, tfAnswer: 1,
    text: { en: "Bananas grow on trees.", fr: "Les bananes poussent sur des arbres.", ar: "الموز بيطلع عالشجر.", es: "Los plátanos crecen en árboles." },
    options: TF,
    explain: { en: "The banana plant is a giant herb: its \"trunk\" is rolled-up leaves.", fr: "Le bananier est une herbe géante : son « tronc » est fait de feuilles enroulées.", ar: "شجرة الموز عشبة عملاقة: «جذعها» ورق ملفوف.", es: "La platanera es una hierba gigante: su «tronco» son hojas enrolladas." },
  },
];

/** The demo quiz in one locale (9 questions; under the shipping minimum on purpose: it never goes through `parse`). */
export function demoPack(locale: Locale): TriviaPack {
  const questions: TriviaQuestion[] = DEMO.map((d, i) => {
    let options = d.options.map((o) => o[locale]);
    let answer: number = d.tfAnswer ?? 0;
    if (d.type === "mc4") {
      const k = i % 4; // spread the authored position (the engine reshuffles for display anyway)
      options = [...options.slice(4 - k), ...options.slice(0, 4 - k)];
      answer = k;
    }
    const q: TriviaQuestion = {
      id: `q${String(i + 1).padStart(3, "0")}`, type: d.type, text: d.text[locale], options, answer, topic: d.topic,
      difficulty: d.difficulty, easyIn: d.easyIn ?? [], source: "test fixture (not shipped)",
    };
    if (d.explain) q.explain = d.explain[locale];
    return q;
  });
  return {
    id: `demo-quiz-01-${locale}`, family: "demo-quiz-01", game: "trivia", version: 1, locale, script: locale === "ar" ? "Arab" : "Latn",
    title: { en: "Studio warm-up", fr: "Échauffement en studio", ar: "تحمية الاستوديو", es: "Calentamiento en el estudio" },
    domain: "general", topics: ["geography", "food", "nature", "science", "music", "sports"], featuredTopics: ["science", "geography", "music"],
    stars: 2, ageRating: "all", tier: "free", license: "test", source: "test fixture", status: "draft", reviewedBy: [], tags: [], questions,
  };
}

export const TRIVIA_DEMO_CATALOG: TriviaCatalog = { packs: TRIVIA_LOCALES.map(demoPack) };

/** A full platform ContentCatalog: the Mish Ana! test packs plus the given Trivia catalog (others empty). */
export function withTrivia(trivia: TriviaCatalog, base: ContentCatalog = contentCatalog(TEST_FREE_CATALOG)): ContentCatalog {
  // JAMAA-GAP (P1): ContentCatalog types the trivia slot as PackCatalog<never> until P widens it to the game's pack type.
  return { ...base, trivia: trivia as unknown as ContentCatalog["trivia"] };
}
