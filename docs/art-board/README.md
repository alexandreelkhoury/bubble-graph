# JAMAA: art review board

Eight contact sheets. Each one is 1920 px wide and comes in a dark version (the hub's night stage) and a light version (cream paper):

| Sheet | What's on it |
|---|---|
| `01-characters-{dark,light}.png` | All 12 characters as a group on the hub floor. The 12 in idle, with names. The full grid: 12 bodies × 13 expressions. How one character is built, layer by layer. The original shapes vs the hand-drawn ones, and the 3 "boil" tracings (A/B/C) on top of each other. |
| `02-games-{dark,light}.png` | 4 game posters with Latin titles. The same 4 with Arabic titles and the scene mirrored for RTL. Bilingual title lockups, including FR and ES versions. The colour set for each world. |
| `03-hub-{dark,light}.png` | The TV hub mocked up: posters, focus ring, join ticket, players strip, all on the living-room background. The room on its own, and the room with players arriving. 6 wordmark variants. Tile borders, arch frames, dividers, corner flourish. UI icons next to the hand-drawn reaction bursts. |
| `04-motion-{dark,light}.png` | A line-boil strip at 8 fps (3 characters × 8 frames). A hop drawn on twos at 12 fps (9 frames). "Line as emotion" (liar caught, eliminated, winner). The two clocks over one second. A short note. |

## The art direction, in plain words

**"A Beirut sign painter and a riso print shop made a party game for their friends."**

- **A hand, not a machine.** Every outline is a brush line: thicker on the side away from the light, thinner where the light hits, and never pure black (each world has its own very dark ink). No shape is perfectly symmetric. Edges wobble a little, but always by the same amount, so a character looks identical on every screen.
- **Printed, not rendered.** Colours are flat. Each object gets one hand-cut shadow and two short brush marks of light, never a glossy shine. The colour sits slightly off its outline, like a second pass on a riso press. Each scene uses 3 inks plus paper plus the world ink, and grain sits on top.
- **Gradients only where there is light.** That means lamp cones, window glow and spotlights. There are no purple-to-pink "app" gradients, no blobs and no floating decoration. Everything on screen is a real thing: a lamp, a tile, a cup, a shutter.
- **Levantine everyday life, not postcards.** Balconies, plant tins, water tanks, plastic chairs, brass lanterns, a rakweh, a tawleh, cement tiles, rolling shutters. No cedars, camels, domes or "Arabian Nights" gold.
- **Two scripts, one composition.** Arabic is lettered in Ruq'ah, the hand of Beirut shop signs, and sits at the same weight as the Latin title, never as a small "translation tag".
- **Alive on two clocks.** The interface moves smoothly. The drawings step at 12 fps when acting and 8 fps for the idle shimmer (the "boil"). A held pose keeps boiling, so it looks like it's waiting, not frozen.

Every image here is code-drawn vector art from seeded data. No AI image generation was used at any stage. The geometry comes from `shared/src/characters` and the brand files in `assets/brand`.

## What still needs a human illustrator

These sheets are a **direction and a working prototype**, not final art. Before shipping:

1. **Paid style test** (ART-DIRECTION §12.2, phase 0). An illustrator redraws 3 characters (circle, star, arch) in idle, shock and cheer, plus one hub sketch and one tile border. Their hand replaces the procedural wobble.
2. **Character sheet.** All 12 bodies drawn by hand, each with 3 real boil tracings, smear frames for shock and fast points, and the key poses: sit, peek, lean-in, huddle, slump. The faces here are the current spec faces with a light touch, so a person should also give them more acting.
3. **All display lettering.** The Latin titles here are a chunky font (Lilita One) redrawn with bounce and wobble. The Arabic titles are live text in Aref Ruqaa. Both are **stand-ins**. A letterer draws the four titles in EN, FR, ES and AR, plus the display words (LIE!, Champion, Tonight's cup…). A **native Arabic letterer** draws or reviews every Arabic word.
4. **The four worlds and the hub room.** Proper far, mid and near layers, the entrance doors, and invented bilingual shop signs. The scenes here are compositional sketches: they show what goes where and in which inks, not finished drawing.
5. **Marketing key art.** Richer 1:1, 16:9 and 9:16 versions and the TV banner, built from the poster compositions.
6. **Textures.** A real scanned-look paper-tooth tile and an ink-mottling tile. The grain here is a placeholder noise filter.
7. **Reaction bursts, props, role emblems, confetti set, LIE! stamp, winner banner, empty-state scenes.** Only the bursts and a few props are sketched here.
8. **Arabic review.** The Arabic taglines and titles still need `[native review]`.

Sources live in `../src`: `hand.js` (the hand layer), `chars.js`, `scenes.js`, `lettering.js`, `ornaments.js` and `b1…b4.html`. To re-render, run `cd ../tools && node render.mjs src/b1.html ../board/01-characters-dark.png dark …`. For a live boil loop, serve `../` and open `src/loop.html`.
