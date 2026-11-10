// Trivia quizzes (JAMAA-PLATFORM §5.1, §6.1; GAME-TRIVIA §11.3, §11.5): content/trivia/<locale>/<pack id>.json, one pack
// per locale sharing a `family` (same question ids). Validated by the trivia ContentAdapter in consumers and by
// `pnpm lint:content` (tools/content-lint/src/games/trivia.ts). Order: en, fr, ar, es; packs sorted by id within a
// language. content-lint warns when a pack file under content/trivia/ is not listed here.
//
// Shipped: lb-quiz-01 only, the launch quiz of GAME-TRIVIA §11.5.
// Held back (JAMAA-GAP): the world-mix-01 family is not in the §11.5 plan, its Arabic is formal MSA rather than the light
// Lebanese register of lb-quiz-01, and it is unreviewed. Its four packs wait in held/*.json.held (outside the shipped
// scan; the trivia lint test still checks them). To ship it: the owner records it in §11.5 (id, stars, tier), a reviewer
// clears it, the files move back to <locale>/world-mix-01-<locale>.json and their imports are added here.
import enLbQuiz01 from "./en/lb-quiz-01-en.json";
import frLbQuiz01 from "./fr/lb-quiz-01-fr.json";
import arLbQuiz01 from "./ar/lb-quiz-01-ar.json";
import esLbQuiz01 from "./es/lb-quiz-01-es.json";

export const PACKS: readonly unknown[] = [enLbQuiz01, frLbQuiz01, arLbQuiz01, esLbQuiz01];
