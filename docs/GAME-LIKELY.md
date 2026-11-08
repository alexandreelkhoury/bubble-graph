# GAME-LIKELY — "Who's most likely to…" (JAMAA game #3)

Status: **binding design spec**, draft 1, 2026-11-08. Game id: `likely`. Display names: EN **Most Likely**, FR **Qui risque le plus ?**, AR **«مين فينا؟»** (`[native review]`).

Rules, state machine, timers, scoring, edge cases, screens, settings, copy, content schema and the first 68 prompts for the "Who's most likely to…" game. The JAMAA hub owns the lobby, game picker, characters, ⓘ button, entitlements, mute, reconnect and room lifetime; **the platform contract is [JAMAA-PLATFORM.md](JAMAA-PLATFORM.md) (§2.11 for this game); where it names a shared concept differently, the platform name wins.** i18n keys written `likely.*` here live under `game.likely.*`; intents travel as `GAME {gameId:"likely", i}`; `HOST_ADVANCE` is the platform host-advance intent. Conventions follow [SPEC.md](SPEC.md) (pure engine with `TICK`, RNG in state, authoritative Durable Object, per-client projections, all keys present). `[VERIFY]` = check before shipping; `[native review]` = native speaker approval needed.

---

## 1. The game in one paragraph

A card appears on the TV: "Who's most likely to… **cry at a wedding**?" Everyone secretly taps a player on their phone (yourself included, if you're honest). Reveal: every character runs to the person they voted for, a conga line forms behind the "winner", a spotlight drops and they get the **Waterworks Award**. You score "Read the Room" points when you voted with the group. At the end, everyone leaves with their signature award ("The Drama Award", "The Two-Minutes Award") and the best mind reader wins.

Players: **3–12**. It's the warm-up game: no typing, one tap per card, ~6–10 minutes.

---

## 2. Platform hooks used

| Hook | Value |
|---|---|
| `gameId` | `"likely"` |
| Players | min 3, max 12 (platform). Start blocked under 3 connected |
| Settings | 3 (§9) |
| How to play | 4 steps (§10.1), shown the first time in a room; ⓘ always |
| Characters | Expressions used: `idle`, `done`, `point` (points at a target), `pointSelf`, `shock`, `laugh`, `smug`, `shy`, `cheer`, `away`. Map to the platform set if names differ |
| Content language | Each card has EN/FR/AR text; the card shows in the room's content language |
| Entitlement | Free room: `tier:"free"` cards of the Family pack. JAMAA Pass: all cards and packs (Spicy pack when it exists) |
| Host | TV remote (always) + VIP phone |

---

## 3. Structure

| Length | Cards |
|---|---|
| Short | 8 |
| **Normal** (default) | 12 |
| Long | 16 |

Each card: CARD → VOTING → REVEAL. After the last card: AWARDS → RESULTS.

---

## 4. State machine

```mermaid
stateDiagram-v2
  [*] --> INTRO: start (≥3 connected)
  INTRO --> CARD: deadline / host HOST_ADVANCE
  CARD --> VOTING: deadline / host HOST_ADVANCE
  CARD --> CARD: host SKIP_CARD
  VOTING --> CARD: host SKIP_CARD (votes discarded)
  VOTING --> REVEAL: all connected voters voted (+1 s) / deadline
  REVEAL --> CARD: next card
  REVEAL --> AWARDS: after the last card
  AWARDS --> RESULTS: deadline / host HOST_ADVANCE
  CARD --> HOLD: fewer than 3 connected at card start
  HOLD --> CARD: 3 connected again
  HOLD --> AWARDS: host END_GAME
```

### 4.1 Phases and deadlines

| Phase | Deadline kind | Duration | Ends early | Who acts |
|---|---|---|---|---|
| `INTRO` | `INTRO` | 15 000 ms | host `HOST_ADVANCE` | host |
| `CARD` | `CARD` | 3 500 ms (reading time; votes not yet open) | host `HOST_ADVANCE` | host: `SKIP_CARD` |
| `VOTING` | `VOTING` | `clamp(14 000 + 1 000 × n, 18 000, 26 000)`, n = players in game | all connected, non-`left` players voted → `deadline = now + 1 000` (last-second change window) | players: `VOTE`; host: `SKIP_CARD` |
| `REVEAL` | `REVEAL` | `revealDurationMs` (§12.2): 6 000–9 500 ms | host `HOST_ADVANCE` | host |
| `HOLD` | none | — | 3 connected | host: `END_GAME` |
| `AWARDS` | `AWARDS` | `3 000 + 2 000 × ceil(players / 3)` + 4 000 (Mind Reader) | host `HOST_ADVANCE` | host |
| `RESULTS` | none | — | — | host: platform play again / back to hub |

`HOST_ADVANCE` is ignored in VOTING (nobody gets cut off by a remote press).

Why a separate CARD phase: everyone reads the prompt on the TV together and laughs **before** phones light up, which keeps eyes on the shared screen.

---

## 5. Voting rules

1. **Eligible voters:** every non-`left` player. Disconnected players abstain.
2. **Eligible targets:** every non-`left` player **including yourself** and including disconnected players (being away doesn't save you).
3. **One vote**, changeable until VOTING ends.
4. **Voting for yourself is allowed** — decision: honesty is funny ("I know, it's me") and it makes 3-player games work. A self-vote is visible in the reveal (in public mode) as the character pointing at itself.
5. Votes are hidden until REVEAL (the TV shows only who has voted).

### 5.1 The result of a card

- `counts` = votes per target.
- `topIds` = targets with the highest count, if that count ≥ 1.
- **Chaos:** if ≥ 3 votes were cast and every voted target has exactly 1 vote (everyone picked someone different), there is **no winner**: `topIds = []`, `chaos = true`. The TV says "Total chaos! You don't agree on anything." No award, no points.
- **Unanimous:** ≥ 3 votes and all of them on one target → `unanimous = true`.
- **Ties:** all tied top targets share the card's award.

---

## 6. Scoring ("Read the Room")

Being picked is not a merit, so it scores no points; it earns **awards** (§6.2). Points reward reading the group.

| Event (per card) | Points |
|---|---|
| Your vote went to a top target (any of the tied ones) | **+100** |
| Unanimous card (you're in the unanimous majority) | **+200** instead of +100 |
| You voted for **yourself** and you're a top target ("Self-aware") | **+100** extra |
| Chaos card, abstain, or your vote missed | 0 |

The **Mind Reader** (most points) is the game's "winner" on the results screen; ties share. Points never go down.

**Why.** The vote is already a prediction of the group's opinion, so "voting with the majority" is the natural skill and needs no second step. Small, round points keep it light: a Normal game has a 1 200–2 400 ceiling, enough for a ranking without making anyone feel judged by their score. The Self-aware bonus rewards the funniest behaviour in the game (owning it).

### 6.1 Herd behaviour

Points could tempt players to always vote for the same "obvious" friend. Counter-measures: votes are blind until reveal (no bandwagon), the deck mixes very different traits so no one is "top" for everything, and the TV calls it out with humour when the same player tops 3 cards in a row ("{name} AGAIN?!", `likely.reveal.again`).

### 6.2 Awards

Every card has an **award name** (e.g. "Waterworks Award"). Awards are written as prizes, not as person nouns, so they are gender-neutral in all three languages ("Prix des grandes eaux", «جايزة الدموع»).

At AWARDS, **every player gets exactly one signature award**:
1. Among the cards where the player was top, pick the one with the highest vote share (`count / votesCast`); tie → the later card. That card's award is their signature award, shown with the prompt ("for being most likely to cry at a wedding").
2. A player who was never top gets **The Mystery Award** (EN) · **Prix du mystère** (FR) · «جايزة اللغز» (AR): "Nobody could pin you down."
3. Extra cards (if anyone qualifies): **Tonight's Star** (most cards topped, ≥ 3) · Star de la soirée · «نجم السهرة»; **Self-aware** (most correct self-votes, ≥ 2) · Lucidité · «جايزة الصراحة».
4. Last: **Mind Reader** · Prix télépathe · «جايزة قراءة الأفكار» (an action noun, not «قارئ», so it stays gender-neutral).

---

## 7. Edge cases

| Case | Behaviour |
|---|---|
| **3 players** | Self-votes allowed, so every vote is meaningful. Ties are frequent and shared. Chaos needs all 3 voting differently |
| **12 players** | Phone grid 3 × 4; TV jury arc of 12 characters at 72 dp. Reveal conga lines stack up to 11 deep (they curl into a spiral after 6) |
| **Nobody votes** | Reveal shows "No votes? Shy tonight!" (`likely.reveal.none`); no award, no points |
| **One vote only** | That target is top (count 1); the voter gets +100. (Chaos requires ≥ 3 votes) |
| **Disconnect in VOTING** | Abstains; can still be voted for |
| **Reconnect in VOTING** | Can vote; `me.myVote` restores their earlier choice |
| **Player leaves (`left`)** | Not a target from the next card on. If they had voted on the current card, the vote stays. Their awards so far stay in AWARDS (greyed) |
| **Late joiner** | Spectator until the next CARD, then voter and target; eligible for awards. "New" ribbon on their first card |
| **< 3 connected at card start** | `HOLD` (TV: "Waiting for players… {count}/3", code + QR) |
| **Host skips a card** | New card drawn; current votes discarded; the card counter does not advance. Skips are unlimited (a safety valve for a card that lands badly), drawn from the pool |
| **Pool exhausted** | Prefer cards not in `room.usedCardIds` (platform room history, FIFO 500); then least recently used, with a "Rerun!" tag. `startBlocker = NO_CARDS_AVAILABLE` if the selected packs have fewer cards than the length (free rooms: free cards only) |
| **Two players with the same name** | Impossible (platform `nameKey` uniqueness); characters also differ |
| **Same player tops many cards** | Allowed; the "AGAIN?!" line (§6.1) |
| **Private-mode tie** | In anonymous mode the tie reveal shows counts only |

---

## 8. Screens

### 8.1 Secrecy

| Data | Before REVEAL | In REVEAL and after (public mode) | In REVEAL and after (anonymous mode) |
|---|---|---|---|
| Who has voted | `votedIds` (all) | — | — |
| Your own vote | `me.myVote` (own phone only) | own phone + public | own phone only |
| Voter → target | never | `reveal.ballots` | **never projected to anyone, ever** (not in AWARDS either) |
| Counts per target | never | `reveal.counts` | `reveal.counts` |

Anonymous mode also drops `Self-aware` from the awards (it would reveal a self-vote); self-vote points still apply privately (shown on the voter's phone only, aggregated into the score).

### 8.2 Per phase

| Phase | TV | Phone |
|---|---|---|
| INTRO | 4 how-to steps animated (§10.1) | Same 4 steps, compact; VIP "Start" |
| CARD | The card flips in: small header "Who's most likely to…", the phrase big (`type.tv.display`), card counter "4 / 12". Jury arc of characters below, `idle` | "Read the TV…" with the phrase in small type (accessibility) and a countdown to voting |
| VOTING | Same card, timer ring; characters who voted switch to `done` (arms crossed, sealed lips); no target is shown | Grid of every player tile (character + name), own tile labelled "Me" with a dashed outline. Tap = vote (selected state, haptic 20); tap another to change. Header repeats the phrase |
| REVEAL | §12.2 conga reveal (public) or ballot rain (anonymous); award stamp on the top target(s); points chips fly to correct voters | "You got 3 votes!" or "You voted with the group: +100", award banner if top, "Self-aware! +100" when applicable |
| HOLD | "Waiting for players… {count}/3" | Same |
| AWARDS | One card per player, 3 at a time (§12.4), then Mind Reader podium | Own signature award card, big, shareable look (no share button in v1) |
| RESULTS | Mind Reader ranking + all signature awards wall; host "Play again" / "Choose another game" | Own award + points; VIP buttons |

ⓘ on the phone top bar in every phase; on the TV via Back → pause menu → "Rules".

---

## 9. Settings (3)

| Setting | Values | Default |
|---|---|---|
| `packIds` | Likely packs (Family; Spicy later, Pass-only and age-gated 16+ with a confirmation dialog on the TV) | Family |
| `length` | `short` 8 · `normal` 12 · `long` 16 | `normal` |
| `showVoters` | `true` (public: who voted for whom) · `false` (anonymous: counts only) | `true` |

---

## 10. Copy

### 10.1 How to play (keys `likely.howto.1..4`)

| # | EN | FR | AR `[native review]` |
|---|---|---|---|
| 1 | **A card appears:** "Who's most likely to…" | **Une carte s'affiche :** « Qui risque le plus… » | **بتطلع كرت:** «مين فينا ممكن…» |
| 2 | **Vote on your phone** for the person who fits best. Yes, you can vote for yourself. | **Votez sur votre téléphone** pour la personne qui colle le mieux. Oui, on peut voter pour soi. | **صوّتوا عالتلفون** للشخص يلّي لابقلو أكتر. وإيه، فيكن تصوّتوا لحالكن. |
| 3 | **Reveal!** See who got picked, and by whom. | **Révélation !** Découvrez sur qui tombe le choix, et qui l'a fait. | **الكشف!** شوفوا مين انختار، ومين اختارو. |
| 4 | **Vote with the group** to score, and collect your award at the end. | **Votez comme le groupe** pour marquer des points, et repartez avec votre prix. | **صوّتوا متل الجماعة** لتربحوا نقاط، وكل واحد بياخد جايزتو بالآخر. |

(FR avoids « qui a été choisi », whose participle would be gendered.)

### 10.2 ⓘ Rules sheet (keys `likely.rules.*`)

EN:
- **Vote.** One vote per card, for any player, yourself included. You can change it until time's up.
- **Points.** +100 if you voted for the most-voted player (+200 if everyone agreed). +100 more if you voted for yourself and you were right.
- **Chaos.** If everyone votes for someone different, nobody wins the card.
- **Awards.** Each card has an award. At the end, everyone gets their signature award. The most points wins the Mind Reader award.
- **Secret votes.** If the host turned off "Show who voted", only the number of votes is shown.

FR:
- **Vote.** Un vote par carte, pour n'importe qui, vous compris. Modifiable jusqu'à la fin du temps.
- **Points.** +100 si vous votez pour la personne la plus choisie (+200 si tout le monde est d'accord). +100 de plus si vous votez pour vous et que c'est vrai.
- **Chaos.** Si chaque vote va à une personne différente, personne ne gagne la carte.
- **Prix.** Chaque carte a son prix. À la fin, chacun repart avec son prix signature. Le plus de points remporte le Prix télépathe.
- **Votes secrets.** Si l'hôte a désactivé « Montrer les votes », seul le nombre de votes s'affiche.

AR `[native review]`:
- **التصويت.** صوت واحد عكل كرت، لأيّ حدا، حتى لحالك. فيك تغيّرو لآخر ثانية.
- **النقاط.** ‎+100 إذا صوّتت للّي أخد أكتر أصوات (‎+200 إذا الكل اتّفقوا). و‎+100 زيادة إذا صوّتت لحالك وطلع معك حق.
- **فوضى.** إذا كل واحد صوّت لحدا غير، ما حدا بيربح الكرت.
- **الجوايز.** كل كرت إلو جايزة. بالآخر كل واحد بياخد جايزتو. واللي معو أكتر نقاط بياخد جايزة قراءة الأفكار.
- **تصويت سرّي.** إذا المضيف طفى «فرجي مين صوّت»، بيطلع بس عدد الأصوات.

### 10.3 Key microcopy

| Key | EN | FR | AR `[native review]` |
|---|---|---|---|
| `likely.card.header` | Who's most likely to… | Qui risque le plus… | مين فينا ممكن… |
| `likely.vote.me` | Me | Moi | أنا |
| `likely.vote.locked` | Vote in! You can still change it. | Vote enregistré ! Tu peux encore changer. | صوتك انحسب! بعد فيك تغيّرو. |
| `likely.reveal.youGot` (P) | You got {count} vote(s)! | {count} vote(s) pour toi ! | أخدت {count} صوت! |
| `likely.reveal.withGroup` | You read the room! +{points} | Tu as lu dans les pensées du groupe ! +{points} | قريت أفكار الجماعة! ‎+{points} |
| `likely.reveal.selfAware` | Self-aware! +100 | Lucidité ! +100 | صراحة! ‎+100 |
| `likely.reveal.unanimous` | Unanimous! | À l'unanimité ! | بالإجماع! |
| `likely.reveal.chaos` | Total chaos! You don't agree on anything. | Chaos total ! Vous n'êtes d'accord sur rien. | فوضى! ما اتّفقتو على شي. |
| `likely.reveal.again` | {name} AGAIN?! | Encore {name} ?! | {name} كمان مرّة؟! |
| `likely.reveal.none` | No votes? Shy tonight! | Aucun vote ? Timides ce soir ! | ولا صوت؟ مستحيين الليلة! |
| `likely.awards.mystery` | The Mystery Award: nobody could pin you down. | Prix du mystère : impossible de te cerner. | جايزة اللغز: ما حدا قدر يعرفك. |

---

## 11. Content

### 11.1 Content rules (binding)

**Family pack = the "Teta test": you would happily play it with your grandmother in the room, and you'd laugh if you were picked.**

Banned in every pack (lint keyword list + human review):
- appearance, body, weight, age-shaming, health, disability;
- religion, sects, politics, ethnicity, nationality stereotypes;
- sexuality, romantic or sexual behaviour (Family), alcohol and drugs (Family);
- money status (being poor), job loss, divorce, death, crime beyond harmless mischief;
- anything that could humiliate rather than tease ("most likely to be fired", "to be single forever").

Style: verb phrase completing the header, ≤ 60 graphemes; affectionate; Lebanese-flavoured where it's universal (dabke, tawleh, Teta, Fairuz, "two minutes" culture) without folklore clichés.

**Spicy pack (later, Pass, 16+):** cheeky not explicit (e.g. "stalk an ex's profile at 2 a.m.", "lie about their age", "pretend to know a song they don't"). Same banned list minus the romance/alcohol lines; never sexual acts, never about bodies.

### 11.2 Schema (`shared/src/games/likely/schema.ts`; packs in `content/likely/<pack-id>.json`, read through the platform `ContentAdapter`, JAMAA-PLATFORM §5.2)

```ts
const L3 = z.strictObject({ en: z.string().min(1).max(60), fr: z.string().min(1).max(70), ar: z.string().min(1).max(60) });
export const LikelyCardSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),       // "fam-001"
  tier: z.enum(["free", "pass"]),
  spice: z.union([z.literal(0), z.literal(1), z.literal(2)]),   // 0 family, 1 cheeky, 2 spicy
  tags: z.array(z.enum(["party", "food", "family", "travel", "habits", "lebanon", "tech", "music", "sport", "future"])).min(1).max(3),
  prompt: L3,       // verb phrase completing likely.card.header (FR includes "de"/"d'")
  award: L3,        // "… Award" / "Prix …" / "جايزة …"
  review: z.strictObject({ status: z.enum(["draft", "native-reviewed"]) }),
});
export const LikelyPackSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  game: z.literal("likely"),
  title: z.strictObject({ en: z.string(), fr: z.string(), ar: z.string() }),
  description: z.strictObject({ en: z.string(), fr: z.string(), ar: z.string() }),
  ageRating: z.enum(["all", "teen16"]),
  cards: z.array(LikelyCardSchema).min(30),
});
```

Lint: ids unique; EN phrase starts with a lowercase letter or digit, doesn't start with "to " and has no trailing "?"; FR phrase starts with `de ` or `d'`; AR phrase does not contain «مين»; EN award ends with "Award", FR award starts with "Prix", AR award starts with «جايزة»; `spice:0` in `ageRating:"all"` packs only; banned-keyword list per locale; ≥ 40 % of the Family pack free (so a free room can play Long = 16 twice without reruns: 33 free cards).

**AR grammar note.** After «مين» the verb takes the masculine 3rd person (`يبكي`, `ينسى عيد ميلادو`), which is the standard generic form for an unknown "who" and reads as neutral; no adjective about the subject is used. FR phrases avoid participles and adjectives that agree with the subject ("crier en premier", not « être le premier à crier »).

### 11.3 Draw

`drawCard`: from the selected packs, allowed tier, not in `usedCardIds` nor drawn this game; no two consecutive cards sharing a tag when avoidable; the first card of a game is drawn from `tags` containing `party` or `habits` (easy openers).

### 11.4 First content plan

| Pack | Cards | Free | Status |
|---|---|---|---|
| `likely-family` — Family Night · Soirée en famille · «سهرة عيلة» | 68 drafted (§14) | 33 (marked F) | draft, `[native review]` FR/AR |
| `likely-spicy` — After Midnight · Après minuit · «بعد نص الليل» | 60 planned | 0 | later, Pass, 16+ |
| `likely-lebanon` — Lebanese Life · Vie libanaise · «عيشة لبنانية» | 40 planned (traffic, power-cut humour kept light, family lunches, weddings) | 10 | later |

---

## 12. Signature moments

The server never waits for animations; OK on the remote skips to the end state; reduced motion per DESIGN §6.3.

### 12.1 Entering the world: "Awards Night on the Rooftop"

The Likely world (platform world id `rooftop`) is a glitzy, slightly ridiculous awards ceremony on a Beirut rooftop at night: string lights, a velvet curtain on a little stage, a golden arch of bulbs, a spotlight rig, the city glowing behind. Transition from the hub: the tile zooms in, the curtain **drops closed** over it (400 ms) and **opens** (700 ms) onto the stage with the characters seated in a jury arc; one fanfare sting. ≤ 2 s.

### 12.2 The reveal (public mode), 6–9.5 s

1. *Drumroll (0–800 ms):* lights dim, the card shrinks to the top.
2. *Run to your pick (800 ms → +100 ms per voter, ≤ 2.5 s):* each voter's character leaves its seat and hops to stand behind its target, forming a **conga line** (`point` expression; self-voters do `pointSelf` and stay in place with a cheeky shrug). Landing "tok" sounds, pitch rising per line length.
3. *Count (600 ms):* a counter bubble above each target rolls up.
4. *Spotlight (800 ms):* everything but the top target(s) dims; a spotlight drops with a "thoom".
5. *Award stamp (600 ms):* a golden rosette with the award name lands on the top target (`shock`, or `smug` if they voted for themselves, or `shy`); ties: one rosette each, smaller.
6. *Points (800 ms):* "+100" chips pop from the top target's rosette and fly to each correct voter's head; Unanimous: the whole room's confetti cannon (paper + amber, 1.2 s) and "+200".
7. *Hold (≥ 1 s):* "{name}, defend yourself!" caption (`likely.reveal.defend`) invites the table to talk; there is no mechanic, it's a social beat.

`revealDurationMs = 5 000 + 100 × votes + (unanimous ? 1 200 : 0) + (ties > 1 ? 600 : 0)`, max 9 500.

**Anonymous mode:** a ballot box at the centre shakes, envelopes burst out and fly to targets (no voter colour, all identical cream envelopes), counts roll, then steps 4–6 identically.

**Chaos:** characters run in all directions and bump into each other (a 1.2 s scramble), "Total chaos!" title; no spotlight.

### 12.3 Card entrance

Each card is dealt from a golden deck at the top-end corner, flips in mid-air (`motion.dramatic`, Y-axis) and lands centre with a soft bounce; header first, phrase second (150 ms later).

### 12.4 Awards ceremony

Three players at a time walk to podium marks; each rosette drops with their award name and the original prompt in small type underneath; a golden "glint" sweep crosses each. The Mystery Award plays a comedic "?" puff of smoke. Last: **Mind Reader** podium (steps 3-2-1), the winner gets a glowing crystal-ball prop.

### 12.5 Phone moments

- Your tile pulses when the card is about you being likely (after reveal), with haptic `[30, 60, 30]` if you topped.
- Award card on the phone flips in with a foil shimmer (CSS gradient sweep, 1 s, disabled in reduced motion).

### 12.6 Sounds (new; `tools/gen-sounds`)

`likely.deal` (card flick), `likely.tok` (landing), `likely.spot` (spotlight thoom), `likely.rosette` (bright chime), `likely.confetti`, `likely.scramble` (cartoon scurry), `sting.likelyIntro` (fanfare, darbuka tail).

### 12.7 Implementation notes

TV Compose: conga positions computed per target as a polyline behind the character (curling after 6); ≤ 12 moving characters at once; spotlight = a radial gradient drawn on a `Canvas` overlay (no blur). Web: same layout math in a shared TS helper (`shared/src/games/likely/layout.ts`) so TV mock and Kotlin produce identical positions (Kotlin mirrors it, with a fixture test on positions).

---

## 13. Protocol, view, tests

### 13.1 Intents

| Action | Payload | Who | Phase |
|---|---|---|---|
| `VOTE` | `{ cardId, targetId }` | player | VOTING |
| `SKIP_CARD` | `{ cardId }` | host | CARD, VOTING |
| `HOST_ADVANCE` | `{}` | host | INTRO, CARD, REVEAL, AWARDS |
| `END_GAME` | `{}` | host | HOLD |

Errors: `INVALID_TARGET` (unknown or `left`), `STALE_CARD`, `WRONG_PHASE`.

### 13.2 View (`LikelyPublic`)

`phase, cardIndex, cardCount, deadline, card {id, prompt, award} | null (CARD+), votedIds[], reveal | null, scores [{playerId, score, scoreBefore}], awards [] (AWARDS+), showVoters`.

`reveal = { counts: [{playerId, count}], topIds[], unanimous, chaos, ballots: [{voterId, targetId}] | null (null when !showVoters), deltas: [{playerId, points, reason: "withGroup"|"unanimous"|"selfAware"}] }`. In anonymous mode `deltas` is projected **only** to the player concerned (in `me.myDeltas`); the public `deltas` is `[]` and the TV animates score pills from `scoreBefore → score` without flying chips from voters (a voter's +100 would reveal their vote).

`me = { myVote | null, myDeltas[] }`.

### 13.3 Invariants

1. Every vote target is a non-`left` player; every voter is a non-`left` player; one vote per voter.
2. Before REVEAL no projection contains another player's vote.
3. If `!showVoters`, no projection ever contains `ballots`, public per-voter deltas, or the Self-aware award.
4. `chaos ⇒ topIds = []`; `unanimous ⇒ topIds.length = 1`.
5. Scores ≥ 0 and Σ deltas = Σ (score − scoreBefore).

### 13.4 Tests

- Result table tests: n = 3..12, all-different (chaos), unanimous, ties, one vote, none, self-votes.
- Scoring table tests incl. Self-aware and anonymous delta routing.
- Secrecy property test (fast-check): random games with `showVoters=false` never leak `voterId→targetId` in any projection, across all phases incl. AWARDS and RESULTS.
- Awards: signature-award selection (vote share, later-card tie), Mystery Award, Tonight's Star thresholds, Self-aware hidden in anonymous mode.
- Flow: early end + 1 s window; SKIP_CARD discards votes; HOLD; late joiner; `left` target rejected.
- Sim: `pnpm sim --game likely --players 3..12 --games 200`, invariants after every reduce.
- Pack lint for `likely-family` (all rules in §11.2).
- TV: conga layout fixture shared with TS; D-pad reach of pause menu "Skip card" and ⓘ; RTL arc mirrored.
- Web e2e: 3 phones + `/tv`, self-vote, change vote, reveal, awards.

---

## 14. Content draft — `likely-family` (68 cards)

Header: EN "Who's most likely to…" · FR « Qui risque le plus… » · AR «مين فينا ممكن…». Each cell: prompt phrase / *award*. **F** = free. All `review.status: "draft"`, FR and AR `[native review]`.

| # | F | Tags | EN | FR | AR |
|---|---|---|---|---|---|
| 1 | F | party | cry at a wedding / *Waterworks Award* | de pleurer à un mariage / *Prix des grandes eaux* | يبكي بعرس / *جايزة الدموع* |
| 2 | F | habits | forget their own birthday / *Goldfish Award* | d'oublier son propre anniversaire / *Prix poisson rouge* | ينسى عيد ميلادو / *جايزة السمكة الحمرا* |
| 3 | F | tech | go viral on social media / *Viral Award* | de faire le buzz sur les réseaux / *Prix du buzz* | يصير ترند عالسوشيال ميديا / *جايزة الترند* |
| 4 | F | food | eat the last piece without asking / *Last Bite Award* | de manger le dernier morceau sans demander / *Prix du dernier morceau* | ياكل آخر شقفة بلا ما يسأل / *جايزة آخر لقمة* |
| 5 | F | travel | get lost even with GPS / *Lost & Found Award* | de se perdre même avec le GPS / *Prix de l'orientation* | يضيع حتى مع الـGPS / *جايزة الضياع* |
| 6 | | party | talk their way into the VIP area / *Smooth Talker Award* | d'entrer dans le carré VIP au culot / *Prix du baratin* | يفوت عالـVIP بالحكي / *جايزة الحكي الحلو* |
| 7 | F | party | still be dancing at sunrise / *Sunrise Award* | de danser encore au lever du soleil / *Prix de l'aube* | يضلّ يرقص لطلوع الضو / *جايزة طلوع الضو* |
| 8 | F | habits | arrive late to their own party / *Fashionably Late Award* | d'arriver en retard à sa propre fête / *Prix du retard chic* | يوصل متأخر عحفلتو / *جايزة التأخير* |
| 9 | F | habits | text "on my way" while still in bed / *On My Way Award* | d'écrire « j'arrive » encore au lit / *Prix du « j'arrive »* | يبعت «واصل» وهوّي بعدو بالتخت / *جايزة «واصل»* |
| 10 | | future | adopt five cats / *Cat Lover Award* | d'adopter cinq chats / *Prix des chats* | يتبنّى خمس قطط / *جايزة القطط* |
| 11 | F | lebanon | lead the dabke line / *Dabke Leader Award* | de mener la dabké / *Prix de la dabké* | يمسك راس الدبكة / *جايزة راس الدبكة* |
| 12 | F | habits | know the gossip before anyone else / *Breaking News Award* | de connaître les potins avant tout le monde / *Prix du scoop* | يعرف الأخبار قبل الكل / *جايزة الخبر العاجل* |
| 13 | | food | win a cooking show / *Top Chef Award* | de gagner une émission de cuisine / *Prix grand chef* | يربح برنامج طبخ / *جايزة الشيف* |
| 14 | F | habits | fall asleep during a movie / *Nap Award* | de s'endormir devant un film / *Prix de la sieste* | ينام بنص الفيلم / *جايزة القيلولة* |
| 15 | | habits | laugh at their own joke before the punchline / *Self-Laugh Award* | de rire de sa propre blague avant la chute / *Prix de l'autorire* | يضحك عنكتتو قبل ما يخلّصها / *جايزة الضحكة المبكرة* |
| 16 | F | tech | send a five-minute voice note / *Podcast Award* | d'envoyer un vocal de cinq minutes / *Prix du podcast* | يبعت فويس خمس دقايق / *جايزة البودكاست* |
| 17 | F | tech | look for their phone while holding it / *Phone Hunt Award* | de chercher son téléphone en le tenant / *Prix du téléphone perdu* | يدوّر عتلفونو وهوّي بإيدو / *جايزة وين تلفوني؟* |
| 18 | | lebanon | haggle in a fixed-price shop / *Haggling Award* | de marchander dans un magasin à prix fixes / *Prix du marchandage* | يفاصل بمحلّ أسعارو ثابتة / *جايزة المفاصلة* |
| 19 | F | family | call their mum three times a day / *Mum's Favourite Award* | d'appeler sa mère trois fois par jour / *Prix chouchou de maman* | يتّصل بإمّو تلات مرّات بالنهار / *جايزة حبيب الماما* |
| 20 | | future | become a millionaire / *Big Money Award* | de devenir millionnaire / *Prix du gros lot* | يصير مليونير / *جايزة المليون* |
| 21 | | habits | spend a whole month's pay in one weekend / *Big Spender Award* | de dépenser un mois de salaire en un week-end / *Prix flambeur* | يصرف معاش الشهر بويك إند / *جايزة البعزقة* |
| 22 | F | future | survive a zombie invasion / *Survivor Award* | de survivre à une invasion de zombies / *Prix du survivant* | يضلّ عايش إذا هجموا الزومبي / *جايزة الصمود* |
| 23 | F | party | scream first in a horror movie / *Scream Award* | de crier en premier devant un film d'horreur / *Prix du cri* | يصرّخ أوّل واحد بفيلم رعب / *جايزة الصرخة* |
| 24 | | travel | take 200 selfies on one trip / *Selfie Award* | de prendre 200 selfies en un seul voyage / *Prix du selfie* | ياخد ٢٠٠ سيلفي بسفرة وحدة / *جايزة السيلفي* |
| 25 | F | lebanon | show up with food for the whole street / *Hospitality Award* | d'arriver avec à manger pour toute la rue / *Prix de l'hospitalité* | يجي ومعو أكل لكل الحارة / *جايزة الكرم* |
| 26 | F | music | sing at the top of their lungs in the car / *Car Karaoke Award* | de chanter à tue-tête en voiture / *Prix karaoké-voiture* | يغنّي بأعلى صوت بالسيارة / *جايزة كاريوكي السيارة* |
| 27 | | food | say "diet starts tomorrow" while ordering dessert / *Diet Award* | de dire « régime demain » en commandant un dessert / *Prix du régime* | يقول «من بكرا ريجيم» وهوّي عم يطلب حلو / *جايزة الريجيم* |
| 28 | F | habits | forget why they walked into a room / *Why-Am-I-Here Award* | d'oublier ce qu'on venait chercher dans une pièce / *Prix du trou de mémoire* | ينسى ليش فات عالغرفة / *جايزة «ليش جيت؟»* |
| 29 | | music | become president of a fan club / *Superfan Award* | de présider un fan-club / *Prix du fan absolu* | يصير رئيس فان كلوب / *جايزة المعجب الأوّل* |
| 30 | | sport | still argue about a football match a week later / *Pundit Award* | de débattre d'un match de foot une semaine après / *Prix du consultant foot* | يضلّ يتناقش بماتش فوتبول بعد جمعة / *جايزة المحلّل الرياضي* |
| 31 | | party | cheat at cards / *Card Shark Award* | de tricher aux cartes / *Prix de la triche* | يغشّ بالشدّة / *جايزة الغشّ بالشدّة* |
| 32 | F | lebanon | win every game of tawleh / *Tawleh Master Award* | de gagner toutes les parties de tawlé (backgammon) / *Prix du tawlé* | يربح كل دقّ طاولة / *جايزة الطاولة* |
| 33 | F | party | get everyone on the dance floor / *Party Starter Award* | de faire danser tout le monde / *Prix de l'ambiance* | يقوّم الكل يرقصوا / *جايزة الجوّ* |
| 34 | F | tech | send a message to the wrong group chat / *Wrong Chat Award* | d'envoyer un message dans le mauvais groupe / *Prix du mauvais groupe* | يبعت رسالة عالغروب الغلط / *جايزة الغروب الغلط* |
| 35 | | travel | plan the whole trip down to the minute / *Tour Guide Award* | de planifier tout le voyage à la minute près / *Prix du guide* | يخطّط كل السفرة بالدقيقة / *جايزة الدليل السياحي* |
| 36 | | family | bring a gift for no reason / *Generosity Award* | d'offrir un cadeau sans raison / *Prix de la générosité* | يجيب هدية بلا مناسبة / *جايزة القلب الكبير* |
| 37 | F | food | take the longest to order / *Menu Marathon Award* | de mettre le plus de temps à commander / *Prix du marathon du menu* | ياخد أكتر وقت ليطلب من المنيو / *جايزة المنيو* |
| 38 | | party | organise a surprise party / *Surprise Award* | d'organiser une fête surprise / *Prix de la surprise* | ينظّم حفلة مفاجأة / *جايزة المفاجأة* |
| 39 | F | party | accidentally spoil the surprise / *Spoiler Award* | de gâcher la surprise sans faire exprès / *Prix du spoiler* | يخرب المفاجأة بلا قصد / *جايزة الحرق* |
| 40 | | lebanon | move abroad and fly back for the food / *Homesick Award* | de partir à l'étranger et revenir pour la cuisine / *Prix du mal du pays* | يسافر ويرجع كرمال الأكل / *جايزة الحنين* |
| 41 | | habits | talk to animals like they're people / *Animal Whisperer Award* | de parler aux animaux comme à des humains / *Prix de l'ami des bêtes* | يحكي مع الحيوانات متل البشر / *جايزة صديق الحيوانات* |
| 42 | | future | end up on TV by accident / *Headline Award* | de passer à la télé par hasard / *Prix de la célébrité* | يطلع عالتلفزيون بالصدفة / *جايزة الشهرة* |
| 43 | F | habits | give advice nobody asked for / *Free Advice Award* | de donner des conseils que personne n'a demandés / *Prix du conseil gratuit* | يعطي نصايح ما حدا طلبها / *جايزة النصيحة ببلاش* |
| 44 | | lebanon | have relatives in every city on earth / *Cousin Network Award* | d'avoir de la famille dans chaque ville du monde / *Prix du réseau familial* | يكون إلو قرايب بكل بلد بالعالم / *جايزة القرايب* |
| 45 | F | lebanon | say "two minutes" and take an hour / *Two-Minutes Award* | de dire « deux minutes » et mettre une heure / *Prix des deux minutes* | يقول «دقيقتين» وياخد ساعة / *جايزة «دقيقتين»* |
| 46 | | habits | keep a plant alive for ten years / *Green Thumb Award* | de garder une plante en vie dix ans / *Prix main verte* | يخلّي زرعة عايشة عشر سنين / *جايزة الإيد الخضرا* |
| 47 | | music | bring a speaker to the beach / *DJ Award* | d'apporter une enceinte à la plage / *Prix du DJ* | ياخد سبيكر عالبحر / *جايزة الدي جي* |
| 48 | | party | win a staring contest / *Poker Face Award* | de gagner un duel de regards / *Prix du regard d'acier* | يربح تحدّي بلا ما يرمش / *جايزة العين القوية* |
| 49 | F | habits | keep a secret forever / *Vault Award* | de garder un secret pour toujours / *Prix du coffre-fort* | يكتم سرّ لآخر العمر / *جايزة بير الأسرار* |
| 50 | | party | get the giggles at the worst moment / *Giggles Award* | d'avoir le fou rire au pire moment / *Prix du fou rire* | ياكلو الضحك بأسوأ وقت / *جايزة الضحكة بغير محلّها* |
| 51 | | future | write a bestseller / *Bestseller Award* | d'écrire un best-seller / *Prix du best-seller* | يكتب كتاب بيبيع ملايين / *جايزة الكتابة* |
| 52 | F | music | know every Fairuz song by heart / *Fairuz Award* | de connaître toutes les chansons de Fairouz par cœur / *Prix Fairouz* | يحفظ كل غنيات فيروز / *جايزة فيروز* |
| 53 | | habits | wake up before the alarm / *Early Bird Award* | de se réveiller avant le réveil / *Prix lève-tôt* | يفيق قبل المنبّه / *جايزة الفيقة بكّير* |
| 54 | F | habits | snooze the alarm ten times / *Snooze Award* | de repousser le réveil dix fois / *Prix du snooze* | يأجّل المنبّه عشر مرّات / *جايزة «خمس دقايق كمان»* |
| 55 | | food | try every new restaurant in town / *Foodie Award* | d'essayer tous les nouveaux restos de la ville / *Prix gourmand* | يجرّب كل مطعم جديد بالبلد / *جايزة الذوق* |
| 56 | F | party | say yes to every plan / *Yes Award* | de dire oui à tous les plans / *Prix du oui* | يقول «إيه أكيد» لكل طلعة / *جايزة «إيه أكيد»* |
| 57 | | family | cry at a cartoon / *Soft Heart Award* | de pleurer devant un dessin animé / *Prix du cœur tendre* | يبكي عرسوم متحرّكة / *جايزة القلب الطري* |
| 58 | | food | become best friends with the waiter / *Social Butterfly Award* | de devenir pote avec le serveur / *Prix du papillon social* | يصير رفيق الغرسون / *جايزة الاجتماعية* |
| 59 | F | habits | win an argument while being wrong / *Debate Award* | de gagner un débat en ayant tort / *Prix de la mauvaise foi* | يربح نقاش وهوّي غلطان / *جايزة الجدل* |
| 60 | | future | invent something genius / *Inventor Award* | d'inventer un truc génial / *Prix de l'invention* | يخترع شي عبقري / *جايزة الاختراع* |
| 61 | | family | spoil the grandkids rotten one day / *Teta & Jeddo Award* | de gâter ses petits-enfants plus tard / *Prix papi-mamie* | يدلّع أحفادو كتير بعدين / *جايزة تيتا وجدّو* |
| 62 | | party | dance until the band packs up / *Last Dance Award* | de danser jusqu'à ce que l'orchestre remballe / *Prix de la dernière danse* | يرقص لحتى الفرقة تلمّ غراضها / *جايزة آخر رقصة* |
| 63 | | habits | answer a question with another question / *Riddle Award* | de répondre à une question par une question / *Prix de l'énigme* | يجاوب عالسؤال بسؤال / *جايزة الحزّورة* |
| 64 | F | food | eat dessert before dinner / *Sweet Tooth Award* | de manger le dessert avant le plat / *Prix bec sucré* | ياكل الحلو قبل العشا / *جايزة السنّ الحلو* |
| 65 | | family | remember everyone's birthday / *Calendar Award* | de se souvenir de tous les anniversaires / *Prix du calendrier* | يتذكّر أعياد ميلاد الكل / *جايزة الروزنامة* |
| 66 | F | lebanon | turn a 10-minute visit into a 3-hour stay / *Long Visit Award* | de transformer une visite de 10 minutes en 3 heures / *Prix de la visite éternelle* | يحوّل زيارة عشر دقايق لتلات ساعات / *جايزة السهرة الطويلة* |
| 67 | | habits | fix anything with tape / *Fix-It Award* | de tout réparer avec du scotch / *Prix du bricolage* | يصلّح كل شي باللزّيق / *جايزة التصليح* |
| 68 | | future | start a business at 70 / *Never Too Late Award* | de lancer une entreprise à 70 ans / *Prix jamais trop tard* | يفتح بزنس بعمر السبعين / *جايزة «بعدها بكّير»* |

Free count: 33 (F), 49 %. Native reviewers: check «الشدّة» (cards), «دقّ طاولة» (a tawleh game), «غرسون» (waiter, Lebanese from French), «لزّيق» (tape), and that award names read naturally as titles.

---

## 15. Open items

- `[native review]` all FR and AR.
- Platform: confirm expressions `point`/`pointSelf`/`shy` exist or map them; confirm late-join policy.
- Decide whether the Spicy pack needs its own age gate on the TV (proposed: a confirmation dialog each time it's selected, default focus on "Cancel").
