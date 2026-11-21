# Content plan: the Christmas quiz (`xmas-quiz-01`)

Status: draft, 2026-11-21. Owner request: a Christmas pack for every game, for a Lebanese-French family Christmas dinner.
This file covers Quiz Night (GAME-TRIVIA §11). Wiring: `content/trivia/index.ts`, GAME-TRIVIA §11.5.

## 1. Pack header

One pack per locale, with the same question ids in each (like `world-mix-01`):
`content/trivia/{en,fr,ar,es}/xmas-quiz-01-<locale>.json`.

| Field | Value |
|---|---|
| `family` | `xmas-quiz-01` |
| `title` | en "Christmas Quiz" · fr « Le quiz de Noël » · ar «مسابقة الميلاد» · es "El quiz de Navidad" |
| `domain` | `world` |
| `topics` | `traditions`, `food`, `music`, `cinema-tv`, `history`, `nature`, `geography` (exactly the question topics) |
| `featuredTopics` | `traditions`, `food`, `music` |
| `stars` | 2 (planned mean difficulty ≈ 2.0) |
| `ageRating` / `tier` | `all` / `free` |
| `license` / `source` | `CC-BY-4.0` / `original` |
| `status` / `reviewedBy` | `draft` / `[]` |
| `occasion` | `christmas` (new optional header field, see §2) |

No vocabulary change: every topic already exists in `shared/src/content/vocab.ts`.

## 2. The sensitivity list and the `occasion` field

GAME-TRIVIA §11.2 allows holidays only if they are national and non-religious, and the lint bans `christmas`, `noel` and
`navidad` in every quiz string. Under that rule a Christmas quiz cannot even carry its title. The owner asked for
Christmas packs, so on 2026-11-21 the coordinator decided to add an opt-in pack header field, `occasion: "christmas"`.
It lifts **only** the Christmas words (christmas / noël / navidad, which also covers Père Noël and Papá Noel; the Arabic
list has no such term, so بابا نويل and الميلاد were already allowed). Church, religion, mosque, Easter, Ramadan, Eid and
the rest of the list stay banned in this pack. Questions state religious facts neutrally and never judge or mock them.

## 3. Question plan (60 questions)

- **Difficulty:** 18 × d1, 23 × d2, 19 × d3 (mean 2.02, stars 2). There are at least 15 d3, so the Long length (15 questions) is offered.
- **Types:** 51 `mc4` + 9 `tf` (5 True, 4 False = 56 %). The correct `mc4` index rotates 0→1→2→3 (13/13/13/12).
- **Topics:**

| Topic | Count | Content |
|---|---|---|
| `traditions` | 16 | France (réveillon, the 13 desserts of Provence), Lebanon (Saint Barbara, Papa Noël), Sweden (Lucia), Iceland (Yule Lads), Netherlands (Sinterklaas), Italy (Befana), Spain (Three Kings, Tió de Nadal), Mexico (Posadas), Colombia (little candles), Poland (Wigilia), Japan (KFC), the Philippines, UK (crackers) |
| `music` | 10 | Silent Night, Jingle Bells in orbit, White Christmas, Last Christmas, All I Want for Christmas Is You, Petit Papa Noël, Feliz Navidad, Fairuz's «ليلة عيد», Brenda Lee, the Nutcracker premiere |
| `nature` | 9 | reindeer (antlers, caribou, eye colour), poinsettia, mistletoe, snowflakes, polar bears and penguins, the solstice, Christmas in the southern summer |
| `history` | 8 | Saint Nicholas of Myra, the Coca-Cola myth, Rudolph, Prince Albert's tree, tinsel, the first electric tree lights, the German tree tradition, Dickens |
| `food` | 7 | bûche, panettone, turrón, galette des rois, burbara, mince pies, Portuguese bacalhau |
| `cinema-tv` | 7 | Home Alone, Elf, the Grinch, The Nightmare Before Christmas, It's a Wonderful Life, Klaus, Le Père Noël est une ordure |
| `geography` | 3 | Rovaniemi on the Arctic Circle, Oslo's tree for Trafalgar Square, Strasbourg "capital of Christmas" |

- `easyIn`: questions that are trivial for one audience (réveillon, bûche, galette, Tino Rossi, Le Père Noël est une
  ordure → `fr`; Three Kings, turrón, Feliciano → `es`; Saint Barbara, burbara, Fairuz, Papa Noël → `ar`).
- Sources were checked by web search on 2026-11-21. The session could not open pages directly (only search results
  and their summaries), so each `source` is the page that the search results showed stating the fact.
- Every question has an `explain` ("Did you know?") line of ≤ 200 characters and a `source` URL found by web search.

## 4. Rules followed

- GAME-TRIVIA §11.3 lint (`tools/content-lint/src/games/trivia.ts`): tf labels, 35–65 % True, no index above 40 %,
  topics = question topics, featured ⊂ topics, ≥ 15 d3, |stars − mean| ≤ 0.67, the sensitivity list (with the
  `occasion` exemption), and the same shape (type, answer, topic, difficulty, easyIn) in all four locales.
- No war, politics, borders or religious-community content, in questions or distractors. The origin of the Trafalgar
  Square tree (a wartime thank-you) is left out on purpose.
- One clearly correct answer. Where sources disagree (the first song ever performed in space, a recipe's exact year,
  a tree species' market share), the fact is avoided or the question is phrased around the part they agree on.
- Languages: natural EN; FR from France; Arabic in the light Lebanese register of `lb-quiz-01-ar` (not MSA); neutral Spanish.

## 5. Left out

Dropped while planning, because sources disagree, the fact could not be verified, or it brushes §11.2:
- the Japanese Christmas cake (the first Fujiya cake was a fruitcake, the strawberry one came later);
- Edison's own 1880 lights (the question asks about his partner's 1882 tree instead);
- "the first song played in space" (Wikipedia names an earlier song, so the question asks only what Gemini 6 played);
- the "German" Christmas pickle (mostly unknown in Germany);
- the Nordmann fir's share of French tree sales (figures vary by year and method);
- "Carol of the Bells" and its Ukrainian origin (kept away from current politics);
- Coptic and Armenian Christmas dates (religious communities, §11.2).
