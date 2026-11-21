# Christmas pack for Bluff!: `bluff-christmas` (plan, 2026-11-21)

Owner request: a Christmas pack for every game, for a Christmas dinner. This is the Bluff! one.

## What the format allows (from the code, not from memory)

- Item types (GAME-BLUFF §11.1, `shared/src/games/bluff/schema.ts`): `fact_blank` (rounds 1 and 2; round 1 draws facts
  through the §11.4 short-pool rule since sayings were archived), `word_meaning` / `expression_meaning` (round-2 fillers),
  `no_truth` (the final). `proverb_end` is archived. Year facts are `fact_blank` items whose prompt names the year
  ("In 1966, … ___"): a bare year cannot be a truth, because the lint wants at least 2 letters in every truth.
- Layout: one pack, `sourceLocale: "en"`, `playableIn: ["en","fr","ar","es"]`; `prompt.display` carries FR/AR/ES;
  `truth`, `truthAlt`, `houseLies` (3 per locale) and `note` (≤ 140) are per locale; facts keep
  `review: {status: "draft", source: "[VERIFY] fact-checked 2026-11-21, <url>"}` like the other packs.
- Lint rules that shape the writing: truths and house lies ≤ 60 graphemes (aim ≤ 50), sentence case, no final `.`/`!`,
  no tashkeel, no typographic quotes; house lies must not collide with or be "too close" to the truth; a truth word
  should not already be in the prompt; every number in a truth must appear in `review.source`; banned tokens in every
  text: god / jesus / christ / church / mosque / war and their FR/ES/AR forms (so: no nativity, mass, church or angels).
  "Christmas", "Noël", "Navidad", "الميلاد", "بابا نويل" are not banned by the Bluff lint, so no `occasion` field is
  needed here (unlike Trivia).
- The engine filters by the selected pack ids: with only one pack selected, the final can come only from that pack. The
  lint required finals to live in their own packs, so a facts-only Christmas pack could never start alone
  (`NO_CONTENT_AVAILABLE`). **Decision:** `bluff-christmas` carries its own finals. The lint rule becomes: a pack that
  mixes `no_truth` with other types is a *themed pack* and must be playable alone (≥ 8 free truth items not `knownIn`
  each playable locale, enough for a Long game, and ≥ 3 free finals). Spec note in GAME-BLUFF §11.3 and §11.5. The draw
  already splits by type, so the engine does not change.

## Pack

- id `bluff-christmas`; titles Christmas Bluff · Bluff de Noël · «كذبة الميلاد» · Bluff navideño; `ageRating: "all"`.
- ~41 items: **33 `fact_blank`** (8 year facts, 22 traditions around the world incl. 3 Lebanese, 3 odd facts) and
  **8 `no_truth`** festive finals written in all four languages.
- Tiers: most facts free (as written: 27 of 33; the six harder ones are `pass`), every final free, so a free room can
  play a Long game from this pack alone.
- Note: with no pack selected (`packIds: []` = all packs), the Christmas facts and finals also join the general pool.
  Nothing in the engine is seasonal; leaving it that way keeps the engine unchanged.
- `knownIn`: items most people at a table of that language would know are skipped there (Lebanese customs in AR,
  Provence's 13 desserts in FR, El Gordo's singing children in ES).

## Planned items (each confirmed by a web search; dropped if unverifiable or disputed)

| # | Prompt idea | Truth | Area |
|---|---|---|---|
| 1 | In 1966, Gävle built a giant straw ___ | Goat | Sweden, year |
| 2 | In 1847, a London sweet maker invented the Christmas ___ | Cracker | UK, year |
| 3 | In 1939, Rudolph was created to promote a ___ | Department store | USA, year |
| 4 | In 1965, astronauts played Jingle Bells on bells and a ___ | Harmonica | space, year |
| 5 | In 1955, a misprinted Santa hotline reached a ___ | Military command centre | USA, year |
| 6 | Since a 1974 campaign, Japan eats ___ at Christmas | Fried chicken | Japan, year |
| 7 | Since 1962, French letters to Santa are answered from ___ | Libourne | France, year |
| 8 | In 1882, the first electric Christmas tree also ___ | Rotated | USA, year |
| 9 | Oaxaca's December 23 contest of carved ___ | Radishes | Mexico |
| 10 | Czech carp spent its last days in the ___ | Bathtub | Czechia |
| 11 | 3 pm on Christmas Eve, Sweden watches ___ | Donald Duck cartoons | Sweden |
| 12 | Iceland's Yule Cat eats those without new ___ | Clothes | Iceland |
| 13 | Danish almond in the rice pudding wins a ___ | Marzipan pig | Denmark |
| 14 | Peru: hot chocolate and ___ | Panettone | Peru |
| 15 | Colombia opens the season on Dec 7 with ___ | Candles and paper lanterns | Colombia |
| 16 | Filipino Christmas songs start in ___ | September | Philippines |
| 17 | Chinese Christmas Eve gift: a wrapped ___ | Apple | China |
| 18 | Japanese December sing-alongs of ___ | Beethoven's Ninth | Japan |
| 19 | Spain's Christmas lottery numbers are ___ | Sung by schoolchildren | Spain |
| 20 | Polish Christmas Eve table: an extra ___ | Place for a stranger | Poland |
| 21 | Greek island Christmas decoration: a little ___ | Boat | Greece |
| 22 | Catalan log is tucked under a ___ | Blanket | Catalonia |
| 23 | Sinterklaas arrives from Spain by ___ | Steamboat | Netherlands |
| 24 | Puerto Rican kids leave a box of ___ for the camels | Grass | Puerto Rico |
| 25 | Ukrainian trees decorated with ___ | Spider webs | Ukraine |
| 26 | Provence ends Christmas Eve with ___ desserts | Thirteen | France |
| 27 | Lebanese families sprout ___ on wet cotton | Wheat and lentils | Lebanon |
| 28 | Dec 4 in Lebanon: costumes and ___ | Boiled wheat with sugar | Lebanon |
| 29 | Lebanese meghli is also made for ___ | A new baby | Lebanon |
| 30 | The first tinsel was made of real ___ | Silver | Germany, history |
| 31 | Santa's antlered reindeer are probably ___ | Female | odd |
| 32 | Nordmann fir seeds are picked in ___ | Georgia | odd |
| 33 | Millions of red ___ march across Christmas Island | Crabs | odd |

Finals (no truth): what the reindeer argued about on the way home; the secret ingredient of North Pole hot chocolate;
what the first snowman said; what the elves complain about at their year-end meeting; what a Christmas tree dreams
about all year; page one of the sleigh's manual; what Christmas lights whisper at night; what the first gift wrap was.

Considered and dropped before writing: Riga/Tallinn "first Christmas tree" (disputed between the two cities), the
"German" Christmas pickle and the Coca-Cola red Santa (myths), mistletoe as "dung on a twig" (etymology disputed),
Norway's hidden brooms and Syria's gift camel (only trivia and travel blogs), Lauscha "invented" glass baubles (dates
disputed), Boston's 1659 ban and Venezuela's roller-skating to mass (religion), the 1914 truce (war), Canada's
H0H 0H0 postal code (an AR truth needs Arabic letters), Strasbourg 1570, Iceland's book flood, Gubbio's light tree,
the Nutcracker premiere and the poinsettia's names (kept the pack at ~40 items).

## Wiring and checks

Register in `content/bluff/index.ts`, bump the pack count in `content/bluff/bluff.test.ts`, add tests (Christmas pack
alone: `startBlocker` null in every locale and length, free room included; a seeded bot game with only this pack
reaches RESULTS and every drawn prompt, final included, comes from it), a lint test for the themed-pack rule, GAME-BLUFF
§11.3 and §11.5 notes. Then `pnpm i`, `pnpm run content:emit`, content-lint (0 errors),
`server/scripts/gen-content-modules.mjs`, `pnpm test`, `pnpm typecheck`.
