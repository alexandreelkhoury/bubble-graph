# Content plan: Taqriban! Christmas pack (`taqriban-christmas`)

Owner request (2026-11-21): a Christmas pack for every game, for a Christmas dinner. This is the Taqriban! one.

- **File:** `content/taqriban/taqriban-christmas.json`, one pack holding en/fr/ar/es (same structure as
  `taqriban-world.json`; schema `shared/src/games/taqriban/schema.ts`, lint `tools/content-lint/src/games/taqriban.ts`).
- **Title:** "Christmas in numbers" / « Noël en chiffres » / «الميلاد بالأرقام» / "La Navidad en cifras".
- **Ids:** `txm-001` … (prefix `txm`, unique across Taqriban packs). Tier `free`, `review.status: "draft"`.
- **Size:** about 30 questions (≥ 28 for the lint), a mix of absolute-mode (< 100) and ratio-mode answers.

## Truth rules (GAME-TAQRIBAN §11.1)

- Every number is checked with a web search. `source` is the short public citation, `review.ref` lists the URL(s) checked
  and the exact figure found.
- Only dated records (Guinness entries with a date and place), official counts (census, chart companies, box-office
  trackers), operators' own figures, or numbers we can recompute (haversine, arithmetic).
- The year and the unit go in the question so there is one right number. No calendar years as answers (ask "how many
  years after…" instead). No church, religion, politics, war or tragedy numbers, even though the pack is about Christmas:
  write around them (e.g. the Thrissur Santa gathering is described without its organiser).
- Drop a fact when the sources disagree by more than a few percent or the figure changes every season without an official
  count (letters to Santa received by La Poste, Christmas trees sold, Byblos tree heights).

## Mix

| Theme | Planned questions |
|---|---|
| Christmas trees and lights | tallest cut tree (Seattle 1950), largest artificial tree (Colombo 2016), tallest Rockefeller tree (1999), crystals in the Rockefeller star, most lights on a house (2014), most expensive decorated tree (Abu Dhabi 2010), largest bauble (Dubai Mall 2018) |
| Records and gatherings | largest gathering of Santas (Thrissur 2014), tallest snowperson (Maine 2008), largest Christmas cracker, largest stocking |
| Songs, films and books | "White Christmas" sales, years until "All I Want for Christmas Is You" and "Last Christmas" hit No. 1, Home Alone box office, A Christmas Carol first printing, ghosts in A Christmas Carol, reindeer in "A Visit from St. Nicholas", first Christmas card print run, Rudolph booklet 1939 |
| Food | longest yule log (Lebanon 2018), largest gingerbread man, largest panettone, largest Christmas pudding |
| Money | PNC Christmas Price Index 2024, El Gordo prize per décimo |
| Winter and nature | record snowfall in one season (Mount Baker), coldest temperature measured (Vostok) |
| Lebanon and the Middle East | longest yule log (Mayfouk), Batroun letters-to-Santa record (2025), Mzaar top station, Beirut to the North Pole (haversine), Abu Dhabi tree, Dubai bauble |
| Geography | Christmas Island population (2021 census) |

## Families (one per game, GAME-TAQRIBAN §11.3)

| Family | Template | Items |
|---|---|---|
| `record-height` | "How tall was the record <tree/snowperson>…, in metres?" | Seattle 1950, Colombo 2016, Rockefeller 1999, Bethel snowwoman |
| `years-to-no1` | "How many years after its release did <song> reach No. 1?" | All I Want for Christmas Is You, Last Christmas |
| `record-weight` | "How much did the largest <food> weigh?" | gingerbread man, panettone, Christmas pudding (+ Levant pack: hummus, tabbouleh) |
| `record-length` | "How long/wide was the longest/largest <thing>, in metres?" | yule log, Christmas cracker, stocking, Dubai bauble |
| `copies` | "How many copies…?" | White Christmas, A Christmas Carol first printing, first Christmas card, Rudolph booklet |
| `population` (shared with the launch packs) | "What was the population of <place>…?" | Christmas Island |

## Dropped while planning

- Letters received by La Poste / Canada Post: no official end-of-season count (only "more than a million expected").
- Byblos Christmas tree height: changes every year, figures from 30 to 35 m without a dated official source.
- Chekka plastic-bottle tree (2019): 120 000 vs 129 000 bottles, 28.1 vs 28.5 m depending on the source.
- Gubbio tree on Monte Ingino: 650 m vs 750 m depending on the source.
- "Silent Night" translations: only "about 300".
- The Grinch (2018) box office: trackers differ by 7 % (re-releases).
- Gingerbread house record (Texas 2013): figure only in cubic feet; Christmas Island area: 135 vs 136 km².

## Review (2026-11-21, second check)

Every number re-checked by web search (Guinness pages through search results). Changes: the Rockefeller 1999 tree is
asked in metres (100 ft = 30.5 m); Batroun asked with the exact Guinness title ("most messages to Santa collected in 24
hours", 21 Dec 2025); Rudolph pinned to the Smithsonian's 2.4 million; "White Christmas" asked "according to Guinness"
(best-selling physical single); El Gordo dated to the 2025 draw; PNC index moved to 2025 ($51,476.12); the disputed
publication day of A Christmas Carol (16/17/19 Dec) removed; Arabic aligned with the Levant pack (ه endings, كلغ, أغنية
instead of ترنيمة for the song). Families: `tree-height` became `record-height` (adds the snowwoman), the bauble joins
`record-length`, a new `copies` family, and the Levant hummus/tabbouleh records join `record-weight`.
