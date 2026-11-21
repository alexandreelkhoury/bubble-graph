# GAME-TAQRIBAN — "Taqriban!" (JAMAA game #5)

Status: **design spec, draft 1** (built end to end on the agent branch; owner review pending). Game id: `taqriban`.
Display names: EN **Taqriban!**, FR **À peu près !**, AR **«تقريبًا!»**, ES **¡Más o menos!** (`[native review]` for FR/AR/ES).

Rules, state machine, timers, the closeness rule, edge cases, screens, settings, copy and content for the estimation
game. The platform contract is [JAMAA-PLATFORM.md](JAMAA-PLATFORM.md); where it names a shared concept differently, the
platform name wins. i18n keys written `taqriban.*` here live under `game.taqriban.*`; intents travel as
`GAME {gameId:"taqriban", i}`. Conventions follow [SPEC.md](SPEC.md) (pure engine with `TICK`, RNG in state,
authoritative Durable Object, per-client projections). `[VERIFY]` = check before shipping; `[native review]` = native
speaker approval needed.

Code: `shared/src/games/taqriban/` (meta, constants, schema, engine, projection, protocol), `content/taqriban/`,
`tools/content-lint/src/games/taqriban.ts`, `shared/src/testing/bots/taqriban.ts`, `tools/sim/src/games/taqriban.ts`,
`web-client/src/games/taqriban/` (phone + /tv), `tv-app/.../games/taqriban/` (Android TV).

---

## 1. The game in one paragraph

The TV asks a question whose answer is a number nobody knows exactly: "How many trees are there on Earth?", "How far is
Beirut from Paris as the crow flies, in km?". Everyone types a guess on their phone (a big keypad with **thousand /
million / billion / trillion** buttons, so "3 trillion" is three taps). Reveal: a number line draws across the TV, every
guess drops onto it one by one with its player's character, a beat, then the **true answer's red pin falls**. The closest
guess lights up with a **"Closest!"** stamp and wins 1,000 points; a guess within 2 % is a **Bullseye** (+500); the
wildest guess gets a "Way off! Omar said 3 trees" line. ~10 questions, the last one counts **double**.

Players: **2–12** (a duel works: closest of two). ~6–12 minutes.

---

## 2. Platform hooks used

| Hook | Value |
|---|---|
| `gameId` | `"taqriban"`, world `observatory` (new, §12.1) |
| Players | min 2, max 12. Start blocked under 2 connected; fewer playable questions than the length → `NO_CONTENT_AVAILABLE` |
| Settings | 3 (§9): `packIds`, `length`, `pace` |
| How to play | 4 steps (§10.1), per device, platform intro; ⓘ always |
| Score carry | `carriesScore: false`; `outcome` ranks by points (ties: questions won, then Bullseyes; still equal → shared place); 0-point and left players get no stars |
| Hooks | `join` (late joiners play from the next QUESTION), `projectSetup` → `{available}`, `memory` → question ids (≤ 120), `projectStatus` (`doneIds` = who guessed, `awaitedIds` = connected players still typing), `leakCheck`, `secretsFor` (the answer before REVEAL) |
| Pause items | Skip question (QUESTION, confirm), Next (REVEAL, LEADERBOARD, FINAL_INTRO), Finish now (HOLD, confirm) |

---

## 3. Length

| `length` | Questions | Leaderboards after question |
|---|---|---|
| short | 6 | 3 |
| normal (default) | 10 | 3, 6 |
| long | 14 | 3, 6, 9, 12 |

The **last question is the final**: points × 2, announced by FINAL_INTRO. A LEADERBOARD follows every 3rd question, never
directly before FINAL_INTRO and never after the final (RESULTS shows the standings).

---

## 4. State machine

```
start ──► QUESTION ──(deadline / all guessed + 0.8 s)──► REVEAL ──► next QUESTION
                                                          ├──► LEADERBOARD (every 3rd) ──► next QUESTION
                                                          ├──► FINAL_INTRO (before the last) ──► QUESTION (final)
                                                          └──► RESULTS (after the final)
any QUESTION start with nobody connected ──► HOLD ──(a player back / a join)──► QUESTION
HOLD ──(host "Finish now")──► RESULTS
```

### 4.1 Phases and deadlines

| Phase | Duration | Host |
|---|---|---|
| QUESTION | pace: relaxed 45 s, normal 30 s, fast 20 s (+ ENTRANCE_GRACE_MS on the first). Every connected player who may guess has guessed → the deadline moves to now + 0.8 s (never later) | Skip question (replaces it, §6); Next is ignored (nobody is cut off by a remote) |
| REVEAL | min(9 s + 250 ms × guesses, 13 s) | Next |
| LEADERBOARD | 6 s | Next |
| FINAL_INTRO | 4 s | Next |
| HOLD | none | Finish now |
| RESULTS | none (platform buttons) | — |

A guess is accepted until the QUESTION deadline, judged by server receipt time (`now > deadline.at` → WRONG_PHASE even
before the TICK runs).

---

## 5. Guessing and scoring

### 5.1 The closeness rule (binding)

Let `a` be the answer (always > 0) and `g` a guess (0 ≤ g ≤ 10^15, at most 2 decimals).

* **Ratio mode, `a ≥ 100`:** `error = |ln(g / a)|`; `g = 0` → `error = +∞`. Half and double are equally far
  (ln 2): "50 trees" and "200 trees" tie for an answer of 100. This is what makes "8 billion" vs "80 billion" fair.
* **Absolute mode, `a < 100`:** `error = |g − a|` (spider legs, percentages, small counts).
* **Ranks:** competition ranking on `error` (1, 1, 3); two errors within 1e-9 are equal (float noise of `ln`).
* **Closest:** every guess with the smallest error. **Ties: everyone tied wins** the full points.
* No guess → no rank, no points; a player who did not guess cannot be closest.

### 5.2 Points

| Event | Points | Final |
|---|---|---|
| Closest (each tied player) | 1,000 | 2,000 |
| Bullseye: `|g − a| ≤ 2 % × a` (independent of being closest) | +500 | +1,000 |

So a question pays at most 1,500 (3,000 on the final). Scores only go up. Bullseye uses the plain 2 % band in both modes
(for small integer answers that means "exactly right").

### 5.3 Standings and ties

Order: points ↓, questions won (`closest` count) ↓, Bullseyes ↓; still equal → shared place (competition ranks). The
platform `outcome.ranking` uses the same groups (0-point and left players excluded).

### 5.4 Reveal highlights

* `closestIds`, `bullseyeIds` as above.
* **Way off!** (`wildId`): the unique farthest guess, when there are ≥ 3 guesses, it is not closest, and it is ≥ 10× off
  (ratio mode: `error ≥ ln 10`) or at least the answer away (absolute mode: `|g − a| ≥ max(a, 1)`).
* `logLine`: the TV draws the line logarithmically when max/min of the positive values (answer + guesses) is ≥ 20.

---

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Nobody guessed | REVEAL shows the answer and "Nobody guessed!"; no points |
| Player leaves mid-question | their pending guess is dropped; not awaited; score frozen; shown as left |
| Disconnect | not awaited for the early end; can still guess if back before the deadline |
| Everyone disconnected at a question start | HOLD; a reconnect or a join resumes the same question index; host can Finish now → RESULTS |
| Late joiner | waits (`me.waitingForNext`) until the next QUESTION, joins with 0 points ("New" on their first question) |
| Skip question | host only, QUESTION only: the question is replaced in place by an unplayed one (fresh first, else least recently used); guesses are discarded; the skipped id goes to memory; no replacement → NO_CONTENT_AVAILABLE |
| Stale phone (old question id) | STALE_QUESTION |
| Second guess | ALREADY_GUESSED (a guess is locked once sent; the phone shows a preview before) |
| Invalid value (negative, > 10^15, > 2 decimals, NaN) | VALUE_INVALID |
| Access change mid-game (a Pass expired) | the next question that left the catalog ends the game at RESULTS with the points earned (`endedEarly`) |
| Not enough fresh questions | the draw reuses the least recently used ones (`rerun`) |

---

## 7. Anti-cheese and secrecy (§8.1)

Before REVEAL no view carries the answer or any guess: the TV and the phones see `answeredIds` only; a phone sees its
own guess in `me.myGuess`. `leakCheck` refuses `answer` / `value` / `guesses` keys outside `public.reveal`, `answeredIds`
outside QUESTION and `me` on the TV; `secretsFor` reports the answer as a whole-leaf secret during QUESTION (except when it
equals a public counter, a rank or a score-like multiple of 500, which whole-leaf equality cannot tell apart). Sources
(`review.ref`) and the RNG never leave the state.

---

## 8. Screens

### 8.1 Secrecy — see §7.

### 8.2 Direction

Numbers are LTR in every locale (Western digits, grouped with a narrow no-break space: `8 000 000 000`); the number line
grows to the right in every locale (it is never mirrored); the keypad is LTR. Text around numbers follows the page;
numbers inside sentences are LRI…PDI isolates, names FSI…PDI.

### 8.3 TV (960 × 540 dp, content inside the 864 × 486 safe area)

| Screen | Content |
|---|---|
| TQ-TV-01 Question | header (title, "Question 3 of 10" or "Final question · double points", ×2 chip); the question card auto-sized (40 → 20 sp, ≤ 4 lines) with the unit chip; timer ring + "Guesses in 3/5"; the cast row (a ✓ badge and a happy face when a player has guessed, never what) |
| TQ-TV-02 Reveal (the star) | the question (small, 2 lines); the line draws (0.3 s); every guess drops on its position in seat order, one every 260 ms, as the player's character in a disc with name + value above (close guesses stack in up to 4 lanes); 0.9 s beat; the red answer pin falls from above with its flag (digits, words, unit); 0.7 s later the closest disc(s) glow and grow, the others dim, "Closest!" (or "Tie! All of them score.") stamps in with the winners' names, "Bullseye!" if any, +points chips; "Way off! Omar said 3 trees" 0.7 s after; the source at the bottom. The whole show (≤ 12 guesses) ends inside the shortest REVEAL window. OK completes it at once; calm motion shows the end state |
| TQ-TV-03 Standings | rows by rank: rank, character, name, a bar growing from the previous board to now, "2 won", points; ≤ 8 rows normal, compact rows above |
| TQ-TV-04 Final intro | "Final question! ×2" + "Double points. Everything can still change." |
| TQ-TV-05 Results | "Maya wins!" / "It's a tie at the top!"; the standings; the cup panel; Play again / Change settings / Other games (D-pad, Play again focused) |
| Hold | "Paused: waiting for players" + the cast |

### 8.4 Phone

| Screen | Content |
|---|---|
| TQ-PH-01 Guess | eyebrow (question n/N, ×2, inline timer); the question (≤ 4 lines, auto-smaller when long); the display (LTR digits grouped as you type + the magnitude word + the unit; under it "= 8 000 000 000" or the error); the four magnitude chips (tap again to remove); the 3 × 4 keypad (1–9, ".", 0, ⌫; long-press ⌫ clears); **Lock it in** always on screen (the keypad is ours, never the OS keyboard; the screen never scrolls). A hardware keyboard types too (digits, "." / ",", Backspace, Escape, Enter) |
| TQ-PH-02 Locked | ✓ "Locked in!", your guess (digits + words + unit), "Waiting for the others… 3/5" + dots |
| TQ-PH-03 Result | the answer (red, drops in), "You said 1 000 000 000 000", "Closest!" / "#2 closest", "Bullseye!", +points, your score; confetti when you won the question |
| TQ-PH-04 Standings / TQ-PH-05 Results | your place, character (crown when first), points, questions won, Bullseyes |
| Waiting / Final intro / Hold | "Eyes on the TV!" with the observatory needle |

Coach marks (first question only): `taqriban.coach.<phase>`. Haptics: a tick per key, a lock buzz, a win buzz on
"Closest!" and on first place at RESULTS (never before the public REVEAL).

---

## 9. Settings

| Key | Values | Default |
|---|---|---|
| `packIds` | multi-select of playable packs (`[]` = all) | `[]` |
| `length` | short 6 / normal 10 / long 14 | normal |
| `pace` | relaxed 45 s / normal 30 s / fast 20 s | normal |

No premium keys. `SETTINGS_SCHEMA = 1`, `VIEW_VERSION = 1`, `STATE_SCHEMA = 1`.

---

## 10. Copy

EN is authoritative; FR/AR (Lebanese)/ES are drafts listed in `shared/i18n/games/taqriban/review.json`.

### 10.1 How to play

1. The TV asks a question whose answer is a number. Nobody knows it exactly.
2. Type your best guess on your phone. The thousand, million and billion buttons help with huge numbers.
3. Every guess lands on a number line, then the real answer drops in. Closest wins 1,000 points.
4. Within 2 percent? Bullseye bonus! The last question counts double.

### 10.2 ⓘ Rules sheet

Guess (QUESTION, HOLD) · Closest wins (REVEAL: the ratio/absolute rule in one sentence, ties all win) · Points (REVEAL,
LEADERBOARD) · Final question (FINAL_INTRO, RESULTS: double points, tie-breaks).

Number words: `taqriban.mag.thousand|million|billion|trillion` (FR mille / millions / milliards / billions; ES mil /
millones / mil millones / billones; AR ألف / مليون / مليار / تريليون).

---

## 11. Content

### 11.1 Truth policy (binding)

Only well-documented numbers: official statistics (censuses, UN, World Bank, national agencies), encyclopaedias
(Britannica), operators of the thing measured (SETE for the Eiffel Tower, CTBUH for skyscrapers), standards bodies, or
geometry we can recompute (great-circle distances between city centres, haversine, R = 6 371 km). Prefer stable facts
(heights, distances, historical counts, census results with the census year in the question) over fast-changing ones;
when a number changes, the year is in the question ("in 2023", "2020 census"). **No calendar years as answers** (±2 % of
2007 is ±40 years). No religion, politics-as-controversy, war or tragedy numbers. Every item carries a short public
`source` (shown on the reveal) and a `review.ref` (URL or computation) that a second person can check. Every launch item
is `review.status: "draft"` (content-lint warns; `--release` makes it an error) until a native review of the wording and a
second check of the number.

Questions deliberately left out of the owner's examples because no reliable number exists: the population of Beirut
(no census since 1932; estimates differ by a factor of 5) and "pregnant women in the USA right now" (no official count).
Lebanon's GDP is asked "in 2019, before the crisis" (World Bank: US$ 51.6 billion).

### 11.2 Schema (`content/taqriban/<pack>.json`, one pack holds every language)

```jsonc
{ "schemaVersion": 1, "id": "taqriban-world", "game": "taqriban", "title": {...}, "description": {...},
  "locales": ["en","fr","ar","es"], "ageRating": "all",
  "items": [{ "id": "tw-001",                // /^[a-z]{1,4}-\d{3,4}$/, unique across packs (short: memory budget)
              "tier": "free",               // "free" | "pass" (item-level, like Likely)
              "tags": ["geo"],              // 1–3 of geo people nature space body history tech sport food money culture lebanon
              "text": { "en": "How tall is the Eiffel Tower today, antennas included, in metres?", "fr": "…", "ar": "…", "es": "…" },
              "unit": { "en": "m", "fr": "m", "ar": "م", "es": "m" },   // short label for the line ("" = none)
              "answer": 330,                // > 0, ≤ 10^15, in the unit the question states
              "source": "SETE (Eiffel Tower operator)",
              "review": { "status": "draft", "ref": "https://www.toureiffel.paris/…" } }] }
```

Lint (`tools/content-lint/src/games/taqriban.ts`): ids unique across packs; source and ref present; no year answers;
≤ 3 decimals; each text ends with its language's question mark (ES "¿…?", AR "؟"); AR uses Western digits; no duplicate
question per language; ≥ 28 questions per pack; drafts are warnings (errors with `--release`).

### 11.3 Draw

`n = length` questions at start from the selected packs in the content language: unplayed in this room first (random),
then the least recently used (`rerun`); consecutive questions avoid sharing their first tag. Memory: the shown and skipped
ids, ≤ 120 (`TAQ_MEMORY_MAX`, so the room history stays inside the §2.6 budget with five games).

**One question per family (owner decision, 2026-11-21).** An item may carry `family` (`"area"`: "What is the area of
<place>?", `"population"`: "What was <country>'s population…?"). A game draws at most one item per family: fresh items
of a new family first, then old items of a new family, and a second item of a family only when nothing else is left. A
host skip's replacement avoids the families of the game's other questions the same way. The launch packs tag 6 area and
12 population questions; the Christmas pack adds `record-height` (3 trees and the snowwoman), `years-to-no1`, `record-weight`
(also the Levant hummus and tabbouleh records), `record-length` (incl. the bauble), `copies` (White Christmas, A Christmas
Carol, the first card, Rudolph) and one `population` item (2026-11-21, reviewed the same day).

### 11.4 Launch content (draft)

| Pack | Questions | Mix |
|---|---|---|
| `taqriban-world` "Around the World" | 102 | geo, space, people (censuses), body, nature, history, culture, sport, tech, food, money |
| `taqriban-levant` "Lebanon & the Middle East" | 38 | Lebanon (area, peaks, coast, Baalbek, hummus/tabbouleh records, the 1 507.5 LBP peg, GDP 2019, distances from Beirut), Arab world (censuses, areas, Suez, Petra, Abu Simbel, Qatar 2022) |
| `taqriban-christmas` "Christmas in numbers" (2026-11-21, owner's Christmas dinner) | 33 | Christmas records (tallest cut and artificial trees, Rockefeller tree and star, most lights on a house, Abu Dhabi's jewelled tree, Dubai's bauble, Santa gathering, snowwoman, cracker, stocking), songs/films/books (White Christmas, years to No. 1, Home Alone, A Christmas Carol, Rudolph, first card), food records (Mayfouk's 1 136 m bûche, gingerbread man, panettone, pudding), El Gordo, PNC index, winter extremes, Lebanon (Batroun letters to Santa, Mzaar, Beirut–North Pole). Families: `record-height`, `years-to-no1`, `record-weight`, `record-length`, `copies`, `population`. Plan: `docs/content-plans/christmas-taqriban.md` |

173 questions × 4 languages (140 at launch + 33 Christmas); ~25 % absolute-mode (answers < 100), the rest ratio-mode.

---

## 12. Signature moments

### 12.1 World: "The Observatory"

Deep teal-ink night (`deep #06161A`, `stageTop #0C2A30`), brass accent `#FFB547`, glow `#FFE7B0`, signal red `#FF6B5B`
(the answer pin, ×2). Poster: a dome slit of stars, a ruler line, the red pin; cast sand (think), lemon (shock), azure
(think). Lockup: brass letters over a ruler line with the red tick.

### 12.2 Sounds

`tools/gen-sounds`: the platform sting `world_taqriban_sting` (alias `sting.taqribanIntro`: a dome hum, rising ruler ticks, a bell) and `cues/taqriban.mjs`: `taqriban.drop` (a guess lands; /tv pitches it up per guess), `taqriban.pin` (the answer falls), `taqriban.closest` (the stamp). The /tv mock plays them on the reveal timeline; the Android TV plays the sting (game-level res/raw cues are not playable through the platform player yet, as for Likely: JAMAA-GAP).

---

## 13. Protocol, view, tests

### 13.1 Intents (`GAME {gameId:"taqriban", i}`)

| Intent | Who | Phase | Errors |
|---|---|---|---|
| `{type:"GUESS", questionId, value}` | a dealt-in player | QUESTION, before the deadline | NOT_IN_GAME, WRONG_PHASE, STALE_QUESTION, VALUE_INVALID, ALREADY_GUESSED |
| `{type:"SKIP_QUESTION", questionId?}` | host (TV or VIP) | QUESTION | NOT_HOST, WRONG_PHASE, STALE_QUESTION, NO_CONTENT_AVAILABLE |
| `{type:"HOST_ADVANCE"}` | host | REVEAL, LEADERBOARD, FINAL_INTRO (ignored in QUESTION) | NOT_HOST, WRONG_PHASE |
| `{type:"END_GAME"}` | host | HOLD | NOT_HOST, WRONG_PHASE |

### 13.2 View (`TaqribanPublic`)

`schema, phase, index, total, isFinal, deadline, durationMs, question {id, text, unit} | null, answeredIds (QUESTION),
reveal (REVEAL) {answer, source, mode, logLine, guesses [{id, value, rank, closest, bullseye, points}] value ↑,
missingIds, closestIds, bullseyeIds, wildId}, scores [{playerId, score, scoreBefore, rank, rankBefore, closest, bullseyes,
left}] seat order, newIds, waitingIds, rerun, endedEarly`. `me = {myGuess, waitingForNext}`. Setup extras `{gameId,
available}`. `scoreBefore`/`rankBefore`: before this question in REVEAL, the previous board in LEADERBOARD/RESULTS.

### 13.3 Invariants

Phase shape (a question exactly in QUESTION/REVEAL, deadlines everywhere but HOLD/RESULTS); guesses only in QUESTION, only
from dealt-in players, all valid; the last result re-scores identically from its guesses (the §5 rule is the single
source of truth); totals never exceed the questions revealed; scores are multiples of 500 and never go down; question ids
unique; skipped ids never back in play; memory ≤ 120.

### 13.4 Tests

`shared/test/games/taqriban` (rule, flow, secrecy, settings, 66 seeded bot games 2–12 players),
`content/taqriban/test` (packs, lint), `web-client/test/games/taqriban` (keypad entry, number line),
`tv-app/.../games/taqriban/TaqribanTest.kt` (wire decode, number words, line, timeline fits REVEAL),
`pnpm sim --game taqriban --players 2..12` and `pnpm sim --session --game taqriban` (room-level).
