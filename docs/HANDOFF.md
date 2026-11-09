# Handoff — where the JAMAA work stopped (2026-11-08)

The owner stopped the session for the night. This file lists what is done, what was interrupted, and how to resume.

## Done (committed)
- **Research:** `docs/JACKBOX-STUDY.md` (fact-checked) and `docs/BLUEPRINT.md` (what we copy, adapt and never copy, pricing grid, roadmap, README section).
- **Specs, reviewed:**
  - `docs/JAMAA-PLATFORM.md`;
  - `docs/GAME-BLUFF.md`, updated with the owner's decisions: 3 rounds (complete the saying / impossible facts / "no truth" final), own point values that are not Fibbage's, too-close warning ⇒ 0;
  - `docs/GAME-LIKELY.md`: secret mode shows percentages and gives no points; Spicy mode has an 18+ gate and `{player}` cards;
  - `docs/GAME-TRIVIA.md`;
  - `docs/DESIGN-JAMAA.md`.
- **P0:** the subscription billing restore (JAMAA Pass), then the rename to JAMAA (`app.jamaa.tv`, `@jamaa/*`, rename gate).
- **P1:** the contracts: room v2, protocol v2, the GameDefinition registry with stubs, fixtures v2, the i18n split and the `content/` move.
- **P2, finished lanes:**
  - **A (shared + server):** room engine, content loading, RoomCore v2, GAMES_ENABLED, characters/worlds/motion modules, sim session/ws modes, PAYMENTS-SPEC rev 4. 1307 tests green when it finished.
  - **D (content + generators):** gen-characters (CharacterPaths.kt, WorldColors.kt, Choreo.kt), 18 platform sound cues, content-lint, the DESIGN.md world palettes, a copy review of FR/AR/ES.
  - **E (growth + docs):** README rewritten for JAMAA with a Blueprint section, MONETIZATION set to the Pass, the site including `/es/`, marketing copy.

## Interrupted (partial work on disk / in the last commit)
- **P2 lane B (web: phone + `/tv`):**
  - Hub, setup, How to play, ⓘ rules, characters, portal, Pass store: mid-way. It was updating `model.ts` for v2 and rewriting the store UI.
  - Open asks: add the 18 new cue ids to `web-client/src/tv-mock/sound/cues.ts` (`CUE_IDS`); bring the phone bundle back under 60 KB gz (it was at 61.4 KB).
  - The web-client tests may be red.
- **P2 lane C (native TV):**
  - Hub, setup, rules, characters renderer, portal, Pass store, GameDecoders/GameScreens: mid-way. It was on the hub overlays file.
  - Open asks: add the 18 new `Cue` entries; set `SUPPORT_EMAIL` in `Products.kt` to match `shared/src/billing/products.ts`; wire in the generated CharacterPaths, WorldColors and Choreo files.
- **Games G2/G3/G4:** the three per-game workflows had only just started (lane A ports the engines, lane D installs the content); expect little or no output from them.
- **Art:** the study is done (`docs/ART-DIRECTION.md`). The characters are revised once; the game cards and the hub were being revised; no review board yet.
- **Platform review/fix/verify pass:** not started.

## Drafts preserved in `drafts/` (from the session scratchpad)
- `drafts/games-early.tar.xz` holds:
  - **Content drafts:** Bluff 529 items in 10 packs; Likely 108 family + 74 spicy prompts + 34 awards; Trivia: the Lebanon quiz and a world quiz. All in EN/FR/AR/ES, all `draft`, facts marked `[VERIFY]`.
  - **Draft pure engines with tests** (`engine/bluff`, `engine/likely`, `engine/trivia`), written against the spec types.
- `drafts/art-drafts.tar.xz`: the SVG illustrations (characters, game cards, hub, ornaments, icons), the hand-made generator and its sources. The PNG renders were not saved; re-render them from the SVGs.
- `drafts/tv-verify.tar.xz`: the JVM harness used to compile and test the TV's pure Kotlin.
- `drafts/jamaa-games.js`: the per-game workflow script, run with `{"game":"bluff"|"likely"|"trivia"}`. It expects the drafts at `<scratchpad>/games-early/`; extract them there first, or edit the paths.

## Resume order
1. `git pull`. Extract the drafts into the scratchpad (`tar -xJf drafts/<x>.tar.xz -C <scratchpad>`).
2. Finish P2 lanes B and C (continue from the files on disk), including the open asks above.
3. Run the platform review → fix → verify pass: rename gate, full gate, e2e, the TV harness.
4. Run the 3 game workflows in parallel, one per game.
5. Integrate the illustrations once the art critique has passed.
6. Final gate, README status, push, and a summary for the owner.

## Open owner decisions
- Bluff final: a "no truth" final (owner's idea, now in the spec) versus a normal x3 final. The spec follows the owner.
- Regional prices for the JAMAA Pass (BLUEPRINT §5.2 suggests US $3.99/month and $24.99/year, Lebanon about $9.99/year).
- Final game names (D4), the voice host budget, audience mode scope.
- Native review of all AR/FR/ES content, and of the facts marked `[VERIFY]`.
- Marking the four free `*-everyday-01` packs as reviewed. `pnpm run deploy` refuses draft free packs.

## Update 2026-11-09 (stopped again by the owner)
- **Platform (milestone P):** lanes A, B, C, D and E are all finished. Review done (architecture/security, design, TV remote). Fixes: lane A done; lanes B (web) and C (TV) were interrupted mid-fix; the verify step has not run.
- **Games:**
  - Bluff! and Most Likely: engine, content and TV screens done; web screens (phone + /tv) interrupted mid-way; reviews not started.
  - Quiz Night: engine, content, TV and web screens done; the security review is done; the rules/fun and design reviews were interrupted.
- **Art:** board in `docs/art-board/`, sources in `drafts/art-drafts.tar.xz`. Not integrated into the app yet.
- **Resume:**
  1. Rerun the platform review workflow; completed reviews replay from cache.
  2. Rerun the three game workflows with `{"game": ...}` and their run ids (wf_3b7ffa60-454 bluff, wf_7a96543e-a25 likely, wf_72a6948e-a0e trivia); completed agents replay from cache.
  3. Integrate the art.
  4. Final gate, then push.
