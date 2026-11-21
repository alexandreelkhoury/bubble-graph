// Bluff packs (JAMAA-PLATFORM §5.1, §6.1; GAME-BLUFF §11), owned by the G2 lane D. Sorted, explicit imports:
// content-lint warns when a pack file under content/bluff/ is not listed here (it would not ship).
// Rounds 1 and 2 ("Impossible but true", fact_blank; word_meaning fills): bluff-me-facts, bluff-odd-facts,
// bluff-world-facts, bluff-year-facts, bluff-lb-teta-words. Round 1 has no proverb_end pack, so it draws from this pool
// (GAME-BLUFF §11.4 short pools) and keeps its Spot-on rule.
// Final (no_truth), one pack per language, each written natively: bluff-no-truth-{ar,en,es,fr}.
// Themed (GAME-BLUFF §11.3, 2026-11-21): bluff-christmas carries facts AND its own finals, so selecting it alone plays a
// whole game (docs/content-plans/christmas-bluff.md).
// Archived (owner, 2026-11-12: sayings are out of the game): the four sayings packs live in content/archive/bluff/,
// which no registry, linter or test loads as live content. Re-import them here to bring round 1 sayings back.
import bluffChristmas from "./bluff-christmas.json";
import bluffLbTetaWords from "./bluff-lb-teta-words.json";
import bluffMeFacts from "./bluff-me-facts.json";
import bluffNoTruthAr from "./bluff-no-truth-ar.json";
import bluffNoTruthEn from "./bluff-no-truth-en.json";
import bluffNoTruthEs from "./bluff-no-truth-es.json";
import bluffNoTruthFr from "./bluff-no-truth-fr.json";
import bluffOddFacts from "./bluff-odd-facts.json";
import bluffWorldFacts from "./bluff-world-facts.json";
import bluffYearFacts from "./bluff-year-facts.json";

export const PACKS: readonly unknown[] = [
  bluffChristmas,
  bluffLbTetaWords,
  bluffMeFacts,
  bluffNoTruthAr,
  bluffNoTruthEn,
  bluffNoTruthEs,
  bluffNoTruthFr,
  bluffOddFacts,
  bluffWorldFacts,
  bluffYearFacts,
];
