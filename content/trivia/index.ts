// Trivia quizzes (JAMAA-PLATFORM §5.1, §6.1; GAME-TRIVIA §11.3, §11.5): content/trivia/<locale>/<pack id>.json, one pack
// per locale sharing a `family` (same question ids). Validated by the trivia ContentAdapter in consumers and by
// `pnpm lint:content` (tools/content-lint/src/games/trivia.ts). Order: en, fr, ar, es; packs sorted by id within a
// language. content-lint warns when a pack file under content/trivia/ is not listed here.
import enLbQuiz01 from "./en/lb-quiz-01-en.json";
import enWorldMix01 from "./en/world-mix-01-en.json";
import frLbQuiz01 from "./fr/lb-quiz-01-fr.json";
import frWorldMix01 from "./fr/world-mix-01-fr.json";
import arLbQuiz01 from "./ar/lb-quiz-01-ar.json";
import arWorldMix01 from "./ar/world-mix-01-ar.json";
import esLbQuiz01 from "./es/lb-quiz-01-es.json";
import esWorldMix01 from "./es/world-mix-01-es.json";

export const PACKS: readonly unknown[] = [
  enLbQuiz01,
  enWorldMix01,
  frLbQuiz01,
  frWorldMix01,
  arLbQuiz01,
  arWorldMix01,
  esLbQuiz01,
  esWorldMix01,
];
