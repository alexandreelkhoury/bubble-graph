# Content plan: `likely-christmas` (Most Likely, Christmas pack)

Owner request: a Christmas pack for every game, for a Christmas dinner with family and friends of mixed ages. This is
the Most Likely one ("Who's most likely to…?", everyone votes for a player in the room).

## Format (same as `likely-family`)

- File `content/likely/likely-christmas.json`, `schemaVersion: 1`, `game: "likely"`, `locales: ["en","fr","ar","es"]`.
- Title: Christmas Dinner · Le réveillon · «عشا الميلاد» · Cena de Navidad.
- `ageRating: "all"` (as `likely-family`): every card `spice: 0`, `namesPlayer: false`, no `romance` tag. So it is
  playable in family mode, bundled by `content:emit:production` (only `"adult"` packs are excluded) and kept by
  `catalogFor` when `LIKELY_SPICY_ENABLED` is `"0"`. No config change is needed for production.
- Tier: **all cards `free`** (the pack is a seasonal gift): ≥ 40 % free and ≥ 33 free cards hold.
- ~60 cards, ids `xmas-001`… (unique across Likely packs; `fam-`/`spicy-` are taken).
- `review.status: "draft"` on every card: FR/AR/ES native review is still needed before a release build, like the
  Family pack (`content-lint --release` refuses free drafts).
- Tags from the schema list only (there is no "christmas" tag): `food`, `family`, `party`, `habits`, `music`,
  `lebanon`, `tech`, `future`, `travel`, `sport`. Plenty of `party`/`habits` cards so the opener draw (§11.3) has
  choice, and tags mixed so consecutive cards rarely share one.
- The Likely lint has no holiday-word ban (unlike Trivia), so no `occasion` header field is needed here.

## Card rules (GAME-LIKELY §11.1–11.2, lint)

- EN: lowercase verb phrase after "Who's most likely to…", ≤ 60 graphemes, no trailing punctuation.
- FR: starts with « de »/« d' » after « Qui risque le plus… », ≤ 70; no adjective or participle agreeing with the
  subject; French as spoken in France (bûche, réveillon, scotch, petit-déj).
- AR: Lebanese colloquial like the Family pack, masculine generic 3rd person verb after «مين فينا ممكن…», ≤ 60, never
  the string «مين» (also not inside «لمين» or «قايمين»), Western digits.
- ES: infinitive phrase after "¿Quién es más capaz de…?", ≤ 70, neutral Spanish (avoid Spain-only or LatAm-only
  words: "suéter", "tomar fotos", "cuenta regresiva", "amigo secreto"; no "cuernos").
- Awards: "… Award" / "Prix …" / «جايزة …» / "Premio …", one award per card, never the re-run tag word (rerun /
  rediffusion / «إعادة» / reposición: the TV shows "Rerun!" next to a repeated card).
- Family keyword lists respected: no alcohol (so no vin chaud, no liqueur chocolates), no romance (no mistletoe), no
  body words (no "ugly sweater": "loudest"/« kitsch »/«فاقعة»/"llamativo"), no religion (Christmas as a family
  holiday only: no mass, no nativity, no hymns: «أغاني الميلاد», not «ترانيم»). Avoid review-flag words (mum, dad,
  « père Noël », «بابا نويل», "Papá Noel") so the pack lints with no warnings beyond the draft notice.
- Teasing, never mean: nothing on bodies, money status, jobs or relationships (no "when are you getting married").

## Themes and rough split (~60; 64 written)

| Theme | ≈ cards | Examples |
|---|---|---|
| Dinner and food | 12 | third slice of bûche, Teta's third plate, carving the turkey, chocolates, chestnuts, leftovers for breakfast |
| Presents | 12 | opening early, shaking presents, wrapping badly, forgotten gift, re-gift, 6 a.m. wake-up, "I love it!" |
| Secret Santa | 4 | guessing yours, spilling yours, buying it on the way, wanting to keep it |
| Decorations and the tree | 6 | 100 photos of the tree, tangled lights, the star, tree up until February, decorating before Halloween |
| Music, films, party | 8 | carols loudest, Christmas songs from November, Christmas dabke, card game final, reindeer antlers, family photo |
| Family visits | 6 | five visits in an afternoon, "so, what's new?" ten times, kids' table, Lebanese goodbye, late arrival |
| New Year and resolutions | 6 | countdown too early, asleep before midnight, resolution forgotten on Jan 2, gym once, fireworks on a screen |
| Lebanese touches | 6 | maamoul "from Teta", ka'ak, the Byblos tree, traffic to see the lights, Faraya snow, a suitcase full of food |

## Wiring

- `content/likely/index.ts`: import and list the pack (sorted: christmas, family, spicy).
- `content/likely/test/likely.test.ts`: the pinned pack list, plus a Christmas test (all free, all-ages, size).
- `tools/content-lint/test/platform.test.ts`: the production emit (`--exclude-adult`) keeps `likely-christmas`.
- GAME-LIKELY §11.4 table: a row for the pack.
- Checks: `pnpm run content:emit`, `pnpm --filter @jamaa/content-lint run lint`, `server/scripts/gen-content-modules.mjs`,
  `pnpm test`, `pnpm typecheck`.
