# Fact-check of the live Bluff! packs (2026-11)

Scope: `content/bluff/` fact packs `bluff-year-facts` (45), `bluff-odd-facts` (59), `bluff-me-facts` (77), `bluff-world-facts` (44), plus `bluff-lb-teta-words` (54 word-meaning items) and the four `bluff-no-truth-*` final-round packs (28 each, no truth by design).
Method: each fact checked once against the sources, then the FR/ES/AR text checked for the same fact and answer (numbers, years, answer wording). Items were not machine-verified one by one against a live page for every claim: well-established facts (e.g. Emu War, Wright brothers, Rosetta Stone) were confirmed against encyclopaedia-level knowledge and an encyclopaedia URL; every doubtful or non-obvious item was checked with a web search (URLs in the table and in each item's `review.source`). `review.source` of every fact item now reads `[VERIFY] fact-checked 2026-11, <url>`; the `[VERIFY]` prefix is kept on purpose (the lint/test requires it while items are drafts; a native-speaker review is still pending). All items remain `draft`.

## Totals (fact packs: 225 items)

| Checked | Confirmed (unchanged) | Fixed | Deleted | Doubtful, kept |
|---|---|---|---|---|
| 225 | 206 | 13 | 1 | 5 |

("Fixed" items were also confirmed after the fix. "Doubtful, kept" items are true as worded but come with a caveat in the table; the 206 confirmed items only had their source note updated.)
No pack minimum broke: facts per locale stay above the 200 minimum (224), free facts above 100.
Teta words (54): spot-checked etymologies and meanings, no errors found. No-truth packs: EN fully read, nothing offensive and nothing false presented as true (the Vindolanda "socks and birthday party" and "pigeons carried messages for thousands of years" notes are accurate); AR/FR/ES are translations of the same items and were skimmed only.

## Non-confirmed items

| id | Issue | Action | Source |
|---|---|---|---|
| me-065 | All three fake answers were TRUE: "Cleopatra lived closer in time to the ___ than to the pyramid" is true for the car, French Revolution, First Olympics (EN/AR) and for Everest, South Pole, America (FR/ES). FR/ES prompt also said "first steps on ___" while EN/AR said "event" | Fakes replaced by events older than the midpoint (invention of writing, Stonehenge, last mammoths); FR/ES prompt and answer aligned with EN | https://en.wikipedia.org/wiki/Cleopatra |
| of-007 | Fake "Grass" is true (sharks, about 450 My, predate grasses); "Insects" and "Coral reefs" are disputed or true depending on definitions | Fakes replaced by oceans, trilobites, jellyfish (all clearly older than sharks) | https://www.livescience.com/animals/sharks/are-sharks-really-older-than-trees |
| of-041 | "Canada has more lakes than the rest of the world combined" is rated false (Snopes); note "60 percent" unsupported | Rewritten to "more lakes than any other country" (true), note rewritten, 4 languages | https://www.snopes.com/fact-check/canada-lakes/ |
| wf-037 | "Honey in Egyptian tombs still edible" is a repeated story with no reliable archaeological source for a tasting | Deleted | https://scienceblog.com/honey-recovered-from-egyptian-tombs-sealed-more-than-3000-years-ago-can-remain-edible-because-honeys-low-water-content-acidic-ph-and-bee-made-peroxide-chemistry-make-it-almost-impossible-for-bact/ (summary: no primary source for the tasting) |
| me-069 | "one fewer rib": Arabians (often) have one fewer PAIR (17 vs 18 pairs); not all have it | Prompt and answer changed to "pair of ribs" in 4 languages | https://horsenation.com/?p=155671 |
| me-061 | Ibn Firnas flight rests on a single source written about 700 years later (al-Maqqari); presented as fact | Prompt reworded "Legend says...", note says it is a late chronicle, 4 languages | https://en.wikipedia.org/wiki/Abbas_ibn_Firnas |
| me-056 | "Since 2013 ... Bugatti": Veyron joined the Dubai Police fleet in 2013/2014 (sources disagree; Aventador was first) | Year removed from the prompt (4 languages) | https://www.automotive-fleet.com/116774/bugatti-veyron-joins-dubai-police-fleet |
| me-060 | Note said the figure struck a "cymbal"; sources split between drum and cymbal | Note rewritten to the agreed mechanism (falling ball, phoenix, driver), 4 languages | https://en.wikipedia.org/wiki/Elephant_clock |
| me-044 | Raouché etymology (French rocher) is likely but not settled (Arabic/Aramaic alternatives proposed) | Hedged with "probably" in prompt and note, 4 languages | https://en.wikipedia.org/wiki/Raouch%C3%A9 |
| me-001 | biblion <- Byblos is the traditional explanation; the direction (city to word, or word to city name) is debated | Prompt hedged "traditionally linked to", 4 languages | https://www.etymonline.com/word/Bible |
| yf-038 | Randy Gardner's run was 28 Dec 1963 to 8 Jan 1964, not "1964" | Prompt now "1963-64", 4 languages | https://en.wikipedia.org/wiki/Randy_Gardner_sleep_deprivation_experiment |
| wf-003 | Note said unicorn in Scottish heraldry "since the 1300s"; tradition says 12th century (William I) | Note fixed, 4 languages | https://www.visitscotland.com/inspiration/culture/national-animal-unicorn |
| of-038 | Note "oldest land animal ever recorded" overclaims (Guinness: oldest known LIVING land animal) | Note fixed, 4 languages | https://www.guinnessworldrecords.com/world-records/511806-oldest-living-land-animal |
| of-025 | AR answer spelled "تمرة" (a date fruit) instead of "ثمرة" (fruit) | AR answer corrected | n/a (translation) |
| yf-029 | Tulip mania "a bulb cost as much as a house": supported (Goldgar cites 1,100 guilders as a nice house; 10,000 for Semper Augustus is repeated but contested), the wider legend is exaggerated | Kept, doubtful | https://www.historytoday.com/node/54516 |
| yf-034 | Potato "first vegetable grown in space" (NASA/UW, STS-73, 1995) is the standard claim but "first" is qualified (earlier Soviet potato experiments) | Kept, doubtful | https://www.pbs.org/wgbh/nova/article/spuds-crops-in-space |
| of-003 | "Only birds that can fly backwards": true for sustained backward flight; other birds only shuffle back briefly | Kept, doubtful | https://southwest.audubon.org/node/1701 |
| of-058 | Mpemba effect is real as a reported phenomenon but contested/hard to reproduce | Kept, doubtful ("sometimes") | https://en.wikipedia.org/wiki/Mpemba_effect |
| of-060 | Kangaroos outnumber people: estimates (35-43 million vs about 27 million) are for harvested species and state-dependent | Kept, doubtful | https://www.environment.nsw.gov.au/topics/animals-and-plants/wildlife-management/kangaroo-management/kangaroo-population-monitoring-and-reporting |

Checked and confirmed with a web source: me-007 (10,452 kg, 8 May 2010, Guinness), me-077 (3,557 kg, 25 Oct 2009), me-027 (IUCN 2011), me-046 (Haigazian rocket society), me-073 (12 camels, NPR), wf-034 (France 12 zones, Russia/US 11), wf-035 (Iceland mosquito, Oct 2025), of-016 (Fitzroy turtle, days underwater), of-038 (Jonathan, 1832/1882).

## Guessable answers (not changed)

me-051 (Sahara = "deserts"), me-036 (Lebanese cedar, "Lebanese" is in the clue context), me-014 (no permanent rivers), of-035 (speeding fine depends on income), of-029 (St Mark's pigeons). Consider replacing if playtests show these are won too easily.

## Notes

- Translations: numbers and years were diffed automatically across the 4 languages; the only differences were Arabic punctuation. FR/ES salaire/sueldo for "income" (of-035) and AR "البجع" for mute swans (of-032) are loose but not wrong in meaning.
- `server/test/content.test.ts` fails in this worktree because `server/src/content-modules.gen` is not generated (unrelated to this change); `pnpm vitest run content` passes (138 tests) and content-lint reports 0 errors.
