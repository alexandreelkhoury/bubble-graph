# Christmas pack plan: Mish Ana! (2026-11-21)

The owner wants a Christmas pack in every game for a Christmas dinner. This is the Mish Ana! one.

## Packs

| Id | Locale | Register | Pairs | Tier | Status |
|---|---|---|---|---|---|
| `en-christmas-01` | `en` | Neutral English (UK and US words both known; UK-only items avoided) | ≥ 40 | free | draft |
| `fr-christmas-01` | `fr` | France French (réveillon, bûche, chapon, galette des rois) | ≥ 40 | free | draft |
| `ar-christmas-01` | `ar` | Lebanese colloquial, like `content/mishana/ar/lb-*.json` (Arabic script + readable translit, `sh` not `ch`, no chat digits) | ≥ 40 | free | draft |
| `es-christmas-01` | `es` | Spain first (turrón, roscón, Nochebuena, amigo invisible), with LatAm words as `alt` | ≥ 40 | free | draft |

Header, the same in all four: `"game": "mishana"`, `version: 1`, `ageRating: "all"`, `license: "CC-BY-4.0"`, `source: "original"`, `status: "draft"`,
`topics: ["traditions", "food", "music"]`, `tags: ["christmas", "seasonal", "winter", "food", "family"]`, title "Christmas" / "Noël" / "الميلاد" / "Navidad".
40 pairs is the release gate for a free pack (`STARTER_MIN_PAIRS`); each pack aims for 45 to 55 so a reviewer can cut weak pairs and stay above 40.

Difficulty: about 20 % level 1 (two clearly different things of the same family: Midnight / Noon), 60 % level 2 (close, the usual Undercover pair: Reindeer / Moose), 20 % level 3 (subtle, near neighbours: Tinsel / Garland, Dinde / Chapon, Turrón / Mazapán).

## Themes (each pack covers all of them, with its own pairs)

1. Decorations: tree, wreath, tinsel, mistletoe and holly, candles, stars, nativity scene (crèche, belén, مغارة).
2. Food and desserts: yule log / bûche / بوش دو نويل, panettone, turrón and polvorón, roscón, ka'ak and ma'moul, turkey (حبش), chestnuts, French starters (foie gras, huîtres).
3. Characters: Santa (Père Noël, Papá Noel, بابا نويل), elf, reindeer, angel, snowman, shepherd, Three Kings (Spain).
4. Winter and snow: snowflake, mittens, sledging and skiing, blizzard, fireplace, Lebanese ski resorts.
5. Gifts: wrapping paper, Secret Santa / amigo invisible, letter to Santa / to the Kings, عيدية.
6. Carols and music: carol vs lullaby, choir, bells.
7. Church and nativity, stated neutrally: nativity scene, shepherd, the ox and the donkey, a carol or hymn. No word for God, Jesus, church or prayer (the other games' lints ban those; Mish Ana!'s does not, but the pack stays family-neutral).
8. New Year's Eve: fireworks, confetti, countdown, resolutions, midnight, the Spanish twelve grapes and bells.

No alcohol (mulled wine, champagne, cava are left out of an all-ages pack) and no brand names.

## Pair rules followed (tools/content-lint/src/lint.ts, SPEC §12.5)

- The two words of a pair never normalise to the same string, and share no `text` / `alt` / `translit` form.
- No pair repeats one that already exists in the same language (exact or after alt expansion).
- Neither word contains the other, neither is a translation of the other, and no word is ambiguous at a Christmas table (English "Mass", French "pétard", Spanish "cometa" and "brazo de gitano" are left out).
- Latin plural-looking words get a singular `alt` (Fireworks → Firework). Arabic translit uses no digits and no `ch`.
- No `%`, no profanity tokens.
- Pairs differ between languages on purpose: each pack uses what that table actually eats and says.

## The "one free pack per language" rule

PAYMENTS-SPEC §1.5 makes "exactly one `tier: "free"` pack per language" a lint error, and `content/test/packs.test.ts` pins the four Everyday packs.
The owner asked for free Christmas packs, so the rule changes to **exactly one free starter pack per language**, where a free pack tagged
`seasonal` does not count as the starter. A seasonal free pack still follows every other free-pack rule (unregional locale, ageRating `all`,
≥ 40 pairs at release). It is not in the room's default `packIds` (still the Everyday starters), so a free room plays it only when the host
selects it. The spec note is dated 2026-11-21.

## Wiring

- Register the four files in `content/mishana/index.ts` (sorted by id within each language).
- `content/test/registry.test.ts` pack count 23 → 27; `content/test/packs.test.ts` free-pack test (starter vs seasonal).
- `tools/content-lint` rule + test for the seasonal exemption.
- Unit test (`content/test/christmas.test.ts`): in a free room, with only the Christmas pack selected, START succeeds in each language and deals a Christmas pair.
- README "Packs (content/mishana/)" counts, SPEC/JAMAA-PLATFORM where Mish Ana! packs are listed, PAYMENTS-SPEC §1.5 note.
