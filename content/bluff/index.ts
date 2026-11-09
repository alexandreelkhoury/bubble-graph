// Bluff packs (JAMAA-PLATFORM §5.1, §6.1; GAME-BLUFF §11), owned by the G2 lane D. Sorted, explicit imports:
// content-lint warns when a pack file under content/bluff/ is not listed here (it would not ship).
// Round 1 (proverb_end): bluff-en-sayings, bluff-es-refranes, bluff-fr-proverbes, bluff-lb-proverbs.
// Round 2 (fact_blank, word_meaning): bluff-me-facts, bluff-world-facts, bluff-lb-teta-words.
// Final (no_truth), one pack per language, each written natively: bluff-no-truth-{ar,en,es,fr}.
import bluffEnSayings from "./bluff-en-sayings.json";
import bluffEsRefranes from "./bluff-es-refranes.json";
import bluffFrProverbes from "./bluff-fr-proverbes.json";
import bluffLbProverbs from "./bluff-lb-proverbs.json";
import bluffLbTetaWords from "./bluff-lb-teta-words.json";
import bluffMeFacts from "./bluff-me-facts.json";
import bluffNoTruthAr from "./bluff-no-truth-ar.json";
import bluffNoTruthEn from "./bluff-no-truth-en.json";
import bluffNoTruthEs from "./bluff-no-truth-es.json";
import bluffNoTruthFr from "./bluff-no-truth-fr.json";
import bluffWorldFacts from "./bluff-world-facts.json";

export const PACKS: readonly unknown[] = [
  bluffEnSayings,
  bluffEsRefranes,
  bluffFrProverbes,
  bluffLbProverbs,
  bluffLbTetaWords,
  bluffMeFacts,
  bluffNoTruthAr,
  bluffNoTruthEn,
  bluffNoTruthEs,
  bluffNoTruthFr,
  bluffWorldFacts,
];
