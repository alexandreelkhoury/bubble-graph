# ART-DIRECTION — how JAMAA should look drawn by a hand

Status: **art direction, draft 1**, 2026-11-08. Owner request: *"It should feel like a real artist drew stuff, it should feel alive, not AI vibe coded."*

**What this file is.** The illustration and motion *style* layer of JAMAA: the mood, the references, how lines, shapes, colour, texture, lettering and characters are drawn, how they move, what to commission from a human illustrator, and what never to do. It sits **on top of** [DESIGN-JAMAA.md](DESIGN-JAMAA.md) and [DESIGN.md](DESIGN.md) and does not change their geometry, tokens, timings or accessibility rules.

**Precedence.** JAMAA-PLATFORM → GAME-* → DESIGN-JAMAA → DESIGN win, in that order, as stated in DESIGN-JAMAA's header. Everything here is either (a) a **style rule** that fits inside the existing specs (most of this file), or (b) a change marked **[PROPOSAL-ART]** that does not apply until the owner and the spec owners accept it (all are collected in §13). Two hard constraints from the specs shape every rule below:

1. **Characters and worlds are code-drawn vector data**, shared by the browser TV, the phone and the native Compose TV (platform §3.4, §3.7; DESIGN-JAMAA §6.4). So "hand-made" must be produced by **path data, layering and timing**, not by bitmaps, blur filters or a WebGL shader. Every technique in this file is chosen so it renders identically in SVG and in Compose `Canvas`, stays inside the phone budget (character renderer ≤ 3 KB gz) and holds ≥ 50 fps on a 2 GB Android TV.
2. **Nothing is copied from Jackbox or anyone else** (BLUEPRINT §3.3), and **no AI image generation** is used anywhere in the pipeline, for finals or for "reference". The freelance contract says so (§12.6).

Tags: **[E]** = our estimate or judgement. Numbers in square brackets like [3] point to §14 Sources.

**Contents:** 1 The idea · 2 What we learned from others · 3 Line · 4 Shape · 5 Colour per world · 6 Texture · 7 Lettering · 8 Characters · 9 Illustration inventory · 10 Motion · 11 Do / don't board · 12 Freelance illustrator brief · 13 Proposals · 14 Sources

---

## 1. The idea

### 1.1 One sentence

**"A Beirut sign painter and a riso print shop made a party game for their friends."**

Everything should look like it was **drawn with a brush or a marker, cut from coloured paper and printed with a few inks that never quite line up**, then brought to life by an animator who draws on twos. It is warm, a little rough at the edges, bilingual by nature, funny, and clearly made by people.

### 1.2 Mood words

| Yes | No |
|---|---|
| hand-inked, sign-painted, cut paper, printed | glossy, rendered, plastic, chrome |
| warm night light (lamp, sodium streetlight, string bulbs) | neon cyberpunk, RGB gaming glow |
| chunky, confident, slightly wonky | perfectly symmetric, sterile, "generated" |
| funny, theatrical, hospitable | cute-for-babies, corporate-friendly, "mascot" |
| Levantine everyday life (balconies, cafés, rooftops, shop signs) | postcard folklore (cedars, camels, tarboush, genie lamps) |
| a few inks, flat shapes, one shadow | gradients on everything, soft 3D blobs |

### 1.3 Why this direction fits JAMAA

- **The geometry is already ours.** Twelve body shapes, a doorway arch, three dots in a wordmark: the platform has a strong graphic skeleton. What it lacks is a *hand*. A consistent hand applied to fixed geometry is the cheapest way to look authored (Ko Takeuchi's WarioWare and Rhythm Heaven characters are simple shapes with bold lines whose life comes from expression and timing [9][10]).
- **Imperfection must be designed, not random.** Untitled Goose Game's flat look came from embracing a constraint, not fighting it [6]; Townscaper feels organic because the *grid itself* is irregular, not because noise was sprinkled on top [12]. We do the same: the wobble lives in the paths and the timing, with rules.
- **The region has its own print and sign culture.** Beirut's hand-painted shop signs are lettered in Ruq'ah [16]; 1960s–70s Lebanese cinema posters were bold, solid-coloured and often bilingual [19]; Lebanese cement floor tiles carry a living pattern language [17]. The region has its own design history to draw from, documented on its own terms [21]. These give us a look nobody else in party games has, without a single cedar.
- **It survives the TV.** Flat shapes, few colours and thick lines are exactly what reads at 3 m on a cheap panel. Fine painterly detail does not.

---

## 2. What we learned from others (and what we take)

We study *why* things feel alive, then take the principle, never the look (BLUEPRINT §3).

| Reference | What makes it feel hand-made / alive | Principle we take | What we don't take |
|---|---|---|---|
| **Jackbox Party Packs** | Each game has its own art lead and look; shared UI and structure hold a pack together while art makes each game memorable [1][2]; artists review each other's work regularly [1]; Drawful's timer is a hand-drawn cat arm [3] | **One cast + one hand across the platform, one "world" per game** (already DESIGN-JAMAA §1.5). A weekly art crit between whoever draws worlds | Any of their characters, lettering, hosts or per-game looks |
| **WarioWare** (Ko Takeuchi) | Wildly mixed styles (stick figures, papercraft, scribbles, photos) inside one frame of bold-lined characters [4][5] | Our **reaction bursts, empty states and celebrations may change medium** (marker doodle, cut paper, stamp) while characters stay consistent | Chaos as a default: our hub stays calm |
| **Rhythm Heaven** | Clean bold lines, flat characters, expressive animation, visual jokes; the team chose 2D over 3D because it carried the flow better [10] | **Simple bodies, acting through timing.** No limbs needed if the body squashes, leans and holds | — |
| **Mario Party** | Board-game theatre: big reactions, characters celebrate and despair on cue | The **"characters are the score"** rule (DESIGN-JAMAA §1.1) staged as theatre: every point has a giver and a receiver | Glossy 3D |
| **Untitled Goose Game** | Flat colour, untextured, storybook "ur-village" timelessness, an aesthetic that came from vector tooling [6] | **Flat fills, no texture on objects, timeless setting** (not 2026 gadgets) | No outlines (we keep ink lines for TV legibility) |
| **Townscaper** | Organic because the underlying grid is irregular [12] | **Irregular construction grids** for backgrounds (rooflines, tiles, windows never on a perfect grid) | — |
| **Alto's Adventure / Odyssey** | Minimal, impressionistic, "moving art"; reads 2D when still and gains depth in motion [13] | **Two-layer parallax** (platform) with atmosphere carried by light, not detail | Gradient skies as the whole look |
| **Florence** | All art made by hand; simple style leaves room for the player; two lovers drawn in different line styles that merge as they fall in love [7] | **Line style as storytelling**: a character's line can change with emotion (the liar's line goes jittery when caught, §10.4) | — |
| **Chicory** | Chunky, bold line art, a coloring-book world [11] | **Chunky line weight** that survives small screens | — |
| **Gris** (Conrad Roset) | Watercolour washes with fine ink lines [14] | **Light as a wash**: lamp glows and window light are the only soft things | Watercolour textures (too heavy for code-drawn TV) |
| **Cuphead** (Studio MDHR) | ~50 000 hand-drawn frames, pencil then ink; watercolour backgrounds; deliberately reproduces 1930s imperfections: varied line thickness, on-screen noise [8] | **Varied line thickness** and **film/print noise** as the two cheapest signals of a hand. Rubber-hose *springiness* in squash and stretch | Rubber-hose limbs, 1930s pastiche |
| **Risograph / screenprint / linocut** | Each ink is a separate pass, so layers overprint translucently and never register perfectly; 1–4 spot colours; flaws are features [15] | **Limited inks per scene, multiply overprint, a small fixed misregistration** (§5.4, §6.2) | Heavy halftone dots, illegible offsets on text |
| **Line boil** | The shimmer of outlines traced several times; once a mistake, now deliberate texture; done digitally by stepping a displacement seed at 8–12 fps rather than every frame [20] | **Stepped boil at 8–12 fps** from 3 pre-drawn path variants (§10.3) | Per-frame random wobble (reads as glitch) |
| **Beirut shop signs, truck art, yafta banners** | Ruq'ah lettering by sign painters; hand-painted trucks and cloth banners still commissioned [16] | **Ruq'ah-based Arabic display lettering**, sign-painter brush logic for Latin too (§7) | Religious or political text, real shop names |
| **Lebanese cinema posters (1960s–70s)** | Bold, solid colours; multiple poster designs per film; Arabic and Latin lettering together [19] | **Bilingual title lockups** where both scripts are drawn as one composition (§7.3), solid-colour poster compositions for game key art | Film stills, photo collage |
| **Lebanese cement tiles** (e.g. Blatt Chaya, since 1881) | Hand-made, natural pigments (rust reds, saffron, deep blues), patterns named after towns, a thick white edge typical of old tiles [17] | **Ornament vocabulary** for frames, dividers and the hub floor (§9.4) | Literal copies of a producer's catalogue pattern |

---

## 3. Line

### 3.1 The ink line

All characters, props and near scenery have an **ink line**. It is not black: it is the world's **ink** colour (§5.2), a very dark, slightly warm tone that on dark stages reads as a crisp cut edge and on bright fills reads as a drawn line.

**Units.** Character sizes in this file are in **body units** (the 24-unit viewBox of DESIGN §5.2). At the 96 dp game-stage size, 1 unit = 4 dp.

| Element | Mean weight | Range along the path (thick-thin) | Floor |
|---|---|---|---|
| Character body outline | **0.9 unit** (3.6 dp at 96 dp) | 0.7–1.2 | 1.5 dp / 1.5 px |
| Face features (mouth, closed eyes, brows) | as DESIGN-JAMAA §4.2 (0.7–0.8 face units) | taper the ends to 60 % | per DESIGN-JAMAA size floor |
| Props on characters | 0.7 unit | 0.55–0.9 | 1.25 dp |
| Near scenery (furniture, podiums, café door) | 2.5 dp on the 960 × 540 canvas | 2–3.5 | 2 dp |
| Mid scenery (buildings, lantern strings) | 1.5 dp | 1.25–2 | — |
| Far scenery (skyline, sky) | **no line**: silhouettes in flat tone only | — | — |
| UI icons (DESIGN §5.1) | unchanged 2 px round | **no variation** | — |

**Depth by line** is the main scenery rule: near = thick line, mid = thin line, far = no line. It gives depth without blur (which lite motion forbids anyway).

### 3.2 Thick and thin

A brush or marker line is thicker where the hand presses. Our rule is a **fixed light direction: light comes from the top-start** (top-left in LTR, mirrored in RTL like every other start/end rule). The outline is **thickest on the bottom-end side (in shadow) and thinnest on the top-start side (in light)**: weight = mean × (1 + 0.3 × (n · s)), where n is the outward normal and s the unit vector toward bottom-end.

How it ships: the outline is **not a stroke**. It is a **filled ring shape** (outer contour minus the body contour) precomputed by `tools/gen-characters` at build time, so SVG and Compose draw one filled path each and look identical. **[PROPOSAL-ART P1]**

### 3.3 Imperfection rules (the "hand budget")

Imperfection is measured, so the shapes stay recognisable and CVD-safe identity (shape + colour + name) never breaks.

| Rule | Value |
|---|---|
| Point displacement from the canonical shape | ≤ **1.5 %** of the shape's size (≤ 0.35 unit on a 24-unit body) |
| Silhouette match | the hand-drawn body overlaps its canonical DESIGN §5.2 glyph with **IoU ≥ 0.92** (a test, §12.5) |
| Corners | no two corners of one shape have the same radius: vary between 0.3 and 0.8 unit |
| Symmetry | no shape is mirror-perfect: the two halves differ by 1–3 % in width or height. Eyes differ by ≤ 5 % in size |
| Straight lines | every "straight" edge has a slight belly (sagitta 0.5–1 % of its length), alternating sides |
| Line ends (props, scenery only) | ends overshoot joins by 0.2–0.4 unit, as a sign painter's strokes cross at corners. **Never on character bodies** (it would read as a tear) |
| Repetition | repeated elements (bulbs, tiles, windows, coins) use 3–4 drawn variants in a non-repeating sequence, never one clone |
| Randomness | always **seeded and stored** (the seed is in the data), never generated per client: both renderers draw the same wonk, and screenshots are reproducible |

### 3.4 What the line never does

- No hairlines, no 1 px strokes on TV.
- No perfectly uniform stroke on illustration (uniform weight is for UI icons only, where it signals "button", not "drawing").
- No sketchy multi-stroke "pencil" lines on characters: one confident line. Sketchiness is a special effect (§10.4).
- No outer glow on lines. Glow belongs to light sources and the focus ring (DESIGN §4.6).

---

## 4. Shape language

### 4.1 Families

| Family | Where | Construction |
|---|---|---|
| **Soft-chunky** (hospitality) | hub, characters, buttons in illustration, the café, the rooftop | big rounded masses, small details clustered on one side, bottom-heavy (things sit, they don't float) |
| **Arch** (*bab*) | portals, frames, windows, the lilac character, poster tops | the flat-bottomed arch of DESIGN §5.2, drawn slightly asymmetric, never a pointed Gothic or mosque arch |
| **Cut paper** | celebrations, confetti, empty states, reaction bursts | shapes with straight "scissor" edges and slightly rounded corners, a tiny offset shadow (paper lifting) |
| **Sign** | title lockups, ticket cards, labels, prices | brush-stroke logic: stroke contrast follows a flat brush held at an angle (Latin ~30°, Arabic per Ruq'ah) |

### 4.2 Rules

- **Big, medium, small.** Every illustration has one big mass, a few medium shapes and a cluster of small ones, never evenly sized parts.
- **Bottom-heavy.** Characters' face boxes already sit low on the triangle and the drop (DESIGN-JAMAA §4.2). Props and furniture follow: weight down, wobble up.
- **Tangents are banned.** Two shapes either overlap clearly (≥ 1 unit) or keep a clear gap; edges never just touch (it reads as a mistake at TV distance). Exception: the mark's ring, where touching is the meaning (and the gap stroke is specified).
- **No geometric stock filler.** No floating circles, blobs, squiggles or dot grids added "for energy". Every shape on screen is *a thing*: a lamp, a tile, a coin, a confetti piece cut from a character's colour.
- **The 12 bodies stay the 12 glyphs.** The artist redraws them by hand inside the §3.3 budget; nobody adds limbs, hair or clothes. Personality comes from faces, motion and the one prop (DESIGN-JAMAA §4.5).

---

## 5. Colour per world

### 5.1 General rules

1. **Existing tokens stay binding.** Text, status, focus ring and the 12 player colours never change between worlds (DESIGN-JAMAA §1.5). Every world keeps its `deep / stageTop / surface / elevated / accent / accentText / onAccent / glow / signal` values.
2. **Flat fills for objects, gradients only for light.** A gradient means "light is falling here" (lamp cone, window glow, stage top glow). Objects, characters, props and buildings are **flat** with **one shadow shape and at most one highlight mark** (brush ticks or a hatch, never a glossy crescent).
3. **Riso logic: 3 inks + paper per illustration.** Each scene picks at most **three illustration inks plus the world's paper and ink** (§5.2). Player colours on characters are extra and don't count. A fourth colour appears only as an overprint (two inks multiplied), exactly as real riso layering produces new colours [15].
4. **Shadows are an ink, not black.** The shadow shape is the world's ink at 22–30 % in multiply blend (SVG `mix-blend-mode: multiply` / Compose `BlendMode.Multiply`; both are cheap). Its edge is hand-cut, not soft.
5. **Saturation lives in the characters and the accent.** Backgrounds sit 15–30 % less saturated than player colours, so the gang is always the brightest thing (DESIGN §1.1: "the biggest element is the thing to do now").

### 5.2 New per-world illustration tokens **[PROPOSAL-ART P2]**

Two tokens per world for illustration only (never for text or UI chrome): **`world.ink`** (line and shadow colour) and **`world.paper`** (the highlight / "unprinted paper" tone, for highlights, paper gaps and cut-paper pieces), plus **three named illustration inks**. Values below are starting points for the illustrator's palette test; the contrast check is not needed for decorative art but the colour test of DESIGN-JAMAA §9 should record them.

| World | `world.ink` | `world.paper` | Illustration inks (3) | The light | Signature material |
|---|---|---|---|---|---|
| **Hub** (palette B, the living room at 11 p.m.) | `#160B26` violet-black | `#FFF1DC` lamp cream | tile rust `#C8553D`, saffron `#E8A33A`, tile blue `#2F5DA8` | one amber lamp (`accent` glow) + the TV's cool spill | cement-tile floor, cushion fabric |
| **`night-market`** Mish Ana! | `#140818` | `#FFE9C7` sodium cream | poster magenta `#E2477F`, sodium orange `#F29B38`, shutter teal `#2A7F86` | sodium streetlights, one neon sign | peeling posters, rolling shutters, hand-painted signs |
| **`hakawati-cafe`** Bluff | `#1A0F07` coffee-black | `#FFEBC2` lantern paper | brass `#E9A23B` (= accent), copper red `#B5452B`, tawleh green `#3D6B4F` | lanterns (`#FFE3A3` glow) | brass rakweh, backgammon boards, painted mirror frames, wood grain as line hatching |
| **`rooftop`** Most Likely | `#06141C` | `#E9FFF9` string-bulb white | pool teal `#29D3C2` (= accent), water-tank blue `#3A6EA5`, terracotta `#D2694A` | string lights, a city glow on the horizon | water tanks, plastic chairs, satellite dishes, laundry lines, plant tins |
| **`quiz-studio`** Trivia | `#070B22` | `#FFF6D6` bulb white | studio blue `#5B7CFF` (= accent), marquee gold `#FFD84D`, set red `#E5484D` | two spotlight cones, marquee bulbs | a 1970s TV set: rounded podiums, wood veneer, felt letters |

### 5.3 Light and shadow recipe (every scene)

1. Stage gradient (existing world stage spec).
2. Far layer: flat silhouettes in `world.surface` and `world.elevated`, no line.
3. Mid layer: flat shapes, thin ink line, one shadow shape.
4. Light: one radial wash per light source, `world.glow` at 12–20 %, **screen** blend; lamp cones are hand-drawn polygons with a soft end only at the far edge.
5. Near layer and characters: ink line, flat fill, shadow shape, highlight mark (`world.paper` brush ticks at 60–75 %) on the top-start side.
6. Grain and paper (§6) on top.

### 5.4 Misregistration (the "second pass")

The **fill layer** of characters, props and near scenery is offset from its ink line by a **fixed vector for the whole screen**: 0.4 unit (1.6 dp at 96 dp) toward the bottom-end, as if one press printed all the colour and another printed all the line. Because it is one vector for the whole screen, it reads as *print*, not as an error.

- **Never on text, numbers, QR, focus rings, timers or player-name labels.**
- Off at character sizes < 64 dp (it would eat the shape).
- Shapes overlap so no gap shows on the line side larger than 0.3 unit (trapping [15]).
- Lite motion keeps it (it costs nothing: one translate on one layer).

---

## 6. Texture

### 6.1 Paper and grain

- **Replace fractal noise with paper tooth.** The existing stage grain (one 128 × 128 tile, 6 %, off in lite and calm modes; DESIGN-JAMAA §1.5) stays technically the same. Its *content* changes from uniform fractal noise to a **scanned-looking paper tooth**: a tile drawn from fibres and soft specks, with slightly directional fibres. The artist delivers it; we bake it into the same 128 × 128 tile and data-URI. **[PROPOSAL-ART P3]**
- **Ink density mottling** on large flat fills (backgrounds, poster areas ≥ 200 dp): a second 256 × 256 tile at 3–4 % multiply that makes flat ink look slightly uneven, like a riso drum. Off in lite and calm modes; never on characters < 96 dp.
- **No texture on characters' bodies** at game sizes (they must stay crisp at 72–96 dp). At 160 dp spotlight and in marketing art, the mottling may be on.

### 6.2 Other texture tools (cheap, vector)

| Effect | How (vector, both renderers) | Where |
|---|---|---|
| Hatching (wood, shadow on walls) | 3–5 parallel hand strokes, never more, as filled paths | café wood, rooftop walls |
| Stipple | 6–15 dots clustered, drawn in 3 sizes | shadow under tables, old wall stains |
| Halftone | **only** as a decorative band in the quiz studio (1970s TV graphics), coarse dots ≥ 3 dp | quiz studio set panels |
| Cut-paper edge | a 1 dp offset shadow in `world.ink` at 40 % | confetti, empty-state pieces |

### 6.3 What texture never does

No photo textures, no "grunge" overlays, no scratched-film filters, no animated noise every frame, no texture over text.

---

## 7. Lettering

### 7.1 Two jobs: type and lettering

- **UI text is type**: Cairo 600/700/900 everywhere (DESIGN-JAMAA §1.6). Unchanged. A hand-lettered UI font would cost budget and hurt legibility.
- **Display words are lettering**: the game titles, the "LIE!" stamp, award names, the "Tonight's cup" sign, big reveal words. These are drawn by a letterer, shipped as outlines per locale, exactly like the current generated lockups (`assets/games/<id>/title_{en,fr,ar}.svg`). **[PROPOSAL-ART P4]**: hand-lettered outlines replace the Cairo-based treatments for the four game titles and a short list of display words; the *treatments* (neon for Bluff, gold for Likely, marquee for Trivia) stay as the material the lettering is painted in.

### 7.2 Latin lettering (EN, FR, ES)

- **Sign-painter casual**, not script: a flat-brush upright casual with visible stroke contrast, slightly bouncing baseline (± 2 % of cap height), letters that lean into each other.
- **Accents and punctuation are part of the design**: É, È, Ç, Ñ, and the Spanish opening **¡ ¿** are drawn, not bolted on. Spanish titles get the opening mark ("¡BLUFF!").
- Never a font that imitates Arabic ("Arabian" fake-script Latin fonts).
- Max one drop shadow (offset, flat, `world.ink`), no bevel, no chrome, no 3D extrusion except the Trivia title's felt-letter depth (≤ 4 % of cap height).

### 7.3 Arabic lettering

- **Base style: Ruq'ah**, the everyday hand of Beirut's sign painters [16], fast, without elongation or ornament [18]. It feels like the street, not the mosque or the court.
- **Avoid Thuluth and ornate Diwani** for game titles: they carry ceremonial and religious associations and are hard to read at a glance [18]. Kufic only as a geometric ornament reference for tile borders, never with words inside.
- **Never write religious phrases, Quranic text or God's names** anywhere in decoration, including "random" calligraphy texture.
- **Legibility first**: dots (nuqat) always present and clearly placed; no letters stacked so that a 10-year-old can't read the title at 3 m; no kashida stretching purely for width in titles under 6 letters.
- **Lettered by a native Arabic letterer** or reviewed by one; never by mirroring or by tracing a Latin layout.
- **Lebanese voice**: the titles are colloquial («مين فينا؟», «بلوف!»); lettering should feel like a café sign or a cinema poster of the 1970s, which often set Arabic and French or English **together** in one composition [19].
- **Bilingual lockups** are designed as one piece (the Mish Ana! "shared bang" already does this): the two scripts share a baseline mood, a weight and one ornament, and neither is a "translation tag" under the other. In AR-first contexts the Arabic leads (DESIGN-JAMAA §1.3).

### 7.4 Lettering acceptance

Every display word is checked at 120 dp wide on the TV and 96 px on the phone, in all four locales, in the target colour on the world's deep and surface. Arabic is checked by a native reader for dots, joins and readability, and against the RTL rules of DESIGN §10.

---

## 8. Characters (the shilleh)

### 8.1 Construction (unchanged geometry, new hand)

The rig, face boxes, feature geometry, expressions, props, legibility thresholds and secrecy rule of DESIGN-JAMAA §4 and platform §3.7 are binding. The art direction adds **how they are drawn**:

| Layer (back to front) | Drawn as |
|---|---|
| Ground shadow | hand-cut ellipse (not a perfect ellipse: one side flatter), `world.ink` at 30 % (spec says `#000` at 30 %; using the world ink is a tint change only) |
| Fill | the player colour, flat, offset by the misregistration vector (§5.4) at ≥ 64 dp |
| Shadow shape | `world.ink` at 22 % multiply on the bottom-end third of the body, a hand-cut curve |
| Highlight | `world.paper` at 60–75 %, **two short brush ticks** on the top-start shoulder, clipped to the body (absent on lemon, aqua and mint, which are already near white). Not a filled crescent: a filled crescent reads as a glossy plastic highlight, which §11 forbids |
| Ink outline | the variable-weight ring of §3.2 |
| Face | DESIGN-JAMAA §4.2 features in the glyph colour; mouths with tapered ends; eye highlight dots kept |
| Badges and props | cut-paper style with a 0.7-unit line |

The low-contrast colours keep their 24 % cream ring (DESIGN §2.3); it sits **outside** the ink line.

### 8.2 Faces

- **Eyes carry 80 % of the acting.** Slight asymmetry (≤ 5 %), and in every expression one eye is fractionally higher than the other, the way a hand draws.
- **Mouths are a brush stroke**: thick in the middle, tapered at the ends.
- **Brows only when they act** (think, smug, shock, sad).
- **No noses, no ears, no teeth, no pupils except in `shock`.** The simplicity is the style (Florence: by simplifying, every element matters more [7]).

### 8.3 The 13 expressions, as acting notes

Geometry is in DESIGN-JAMAA §4.3. These notes tell the illustrator and the animator what each one *means*, so the drawn versions and the motion agree.

| Expression | The acting in one line | Key drawing (the frame you'd put on a poster) | Hand-made touch |
|---|---|---|---|
| `idle` | "I'm here, I'm comfortable" | relaxed, soft smile, weight settled | boil + breathing; blink timing irregular |
| `think` | "hmm… wait…" | eyes up to the end side, one brow up, mouth pushed aside | a tiny 3-line "thinking scribble" above the head on boil frames only |
| `done` | "sent!" | eyes closed in satisfied arcs, a small nod | the check badge lands slightly rotated (≤ 6°), like a stamp |
| `happy` | "yay!" | ^ ^ eyes, open smile, a hop | squash on landing exaggerated by 1 frame |
| `laugh` | "I can't breathe" | squeezed > < eyes, huge mouth | body shakes on 12 fps steps, not smooth |
| `smug` | "fooled you" | half-lidded, one brow up, side smirk, leaning back | a 2-frame "glint" stroke near the eye |
| `shock` | "WHAT?!" | circle eyes with tiny pupils, O mouth, jump back | 2 frames of an over-stretched smear before the jump (see §10.2) |
| `sad` | "oh no" | droopy lids, worried brows, frown, sinking | the body sags 1 frame after the face (follow-through) |
| `facepalm` | "I knew it" | hand disc over eyes, lean forward | the hand disc lands with a squash, holds 4 frames |
| `shy` | "who, me?" | looking down, rosy cheeks, tiny smile | cheeks drawn as 2–3 short hatch strokes, not a gradient blush |
| `point` | "it's YOU" | leans hard toward the target, nub pointing | a dashed "accusation" line toward the target in the reveal moments |
| `cheer` | "WE WON" | star eyes, wide mouth, hop loop | confetti pieces are cut from the character's own colour |
| `away` | "brb" | closed lines, floating "z" | the "z" is lettered (hand-drawn Latin z in every locale, it is an icon, not text) |

### 8.4 Poses

Within the existing rig (y, squash, lean, look, blink, expression, prop), the illustrator delivers **key poses** used for posters, key art and the hub:

`sit` (on the hub sofa or floor: squash 0.92, shadow wider), `peek` (half behind a door or podium edge), `hop` (top of arc), `lean-in` (whispering, two characters), `point`, `pointSelf`, `cheer` (top of hop), `slump` (sad, squash 0.9), `carry` (holding a prop at the hand anchor), `sleep` (away), `huddle` (3–5 bodies overlapping with clear gaps, the "gang" pose for the hub and marketing).

New poses that need rig changes (for example a *sit* that changes the body path) are **[PROPOSAL-ART P5]**; until accepted, `sit` is squash + shadow only.

### 8.5 Idle life

- **Breathing**: as specified (squash 1.00 ↔ 1.02, 3.2 s).
- **Blink**: as specified (every 3–6 s), with 1 in 6 blinks a **double blink**.
- **Boil**: §10.3.
- **Glances**: every 8–15 s, an idle character glances (look offset) at a random neighbour or at the camera for 600–900 ms. Not during secrets-sensitive phases if it could be read as a tell: glances are random per client and never target a specific player in Mish Ana! CLUES/VOTING (secrecy rule, DESIGN-JAMAA §4.3).

---

## 9. Illustration inventory (what has to be drawn)

Everything here is delivered as vector paths (§12.3) and drawn by code; the list says what the code draws.

### 9.1 Hub

| Piece | Description |
|---|---|
| Hub room | A Beirut living room at 11 p.m., seen as a shallow stage: a cement-tile floor strip (3 tile variants), a long sofa silhouette, a tall arched balcony window (the bab arch, with a city night outside), one standing lamp (the amber dot, the brand's lamp), a low table with a rakweh and small cups, plant tins on the balcony rail. Calm: it must let the posters glow (DESIGN-JAMAA §1.1) |
| Ambient (≤ 12 elements) | lamp warmth breathing, steam from the cups, a curtain moving, one window light in the far city switching on/off, the cat's tail on the balcony |
| Gathering state | characters sit on the sofa and floor as they join (sit pose), with a "tfaddalo" wave on arrival |
| Tonight's cup | a hand-lettered sign + a small dented trophy cup (brass), drawn in 3 states (empty, a few names, full) |

### 9.2 Game key art (poster, 210 × 290 dp, and marketing 1:1, 16:9, 9:16)

One per world, composed like a 1970s Lebanese cinema poster: one big gesture, solid colour fields, bilingual lettering, 3 characters acting the game (DESIGN-JAMAA §2.2 cast). The poster version is the code-drawn simplification; the marketing version may be richer (more characters, mottling on, spotlight 160 dp faces).

| World | Poster gesture |
|---|---|
| Mish Ana! | two characters point at a third under a sodium streetlight; peeling poster wall |
| Bluff | a smug character holding the moustache-on-a-stick at a café table, two thinking over their cups; brass lantern overhead |
| Most Likely | on a rooftop at night, one shy character wearing a rosette, two pointing; string lights and water tanks |
| Trivia | three characters behind rounded podiums, one cheering, two spotlight cones crossing; marquee bulbs |

### 9.3 World backgrounds

Per world: **far layer** (silhouettes, no line), **mid layer** (thin line), **near props** (2–3, thick line, used in the portal parallax and on the poster), and the world's **door** for the entrance (DESIGN-JAMAA §3.2: lamp on a cord, café door, velvet curtain, spotlights). Each layer is drawn at the 960 × 540 canvas, extended 10 % on each side for parallax, and mirrored safely in RTL (no lettering inside backgrounds except designated signs, which have per-locale variants).

Signs inside scenes (shop signs, café name, studio marquee) are **invented names**, bilingual, lettered by hand. No real brands, no real shops.

### 9.4 Ornaments

| Ornament | Source | Use |
|---|---|---|
| Tile borders (3 patterns) | drawn new from the cement-tile vocabulary: quatrefoils, eight-point stars, petals, with the thick "white edge" [17] | ticket card frame, results panel border, hub floor strip |
| Arch frames | the bab arch, 3 proportions | poster tops, setup title frame, empty states |
| Dividers | a hand brush stroke, a tile row, a string of bulbs | section breaks in rules overlay and results |
| Corner flourishes | a small cut-paper petal cluster | "New" badges, cup sheet |

Patterns are **never** wallpapered behind text at full opacity: max 8 % on surfaces, or confined to frames.

### 9.5 Icons and bursts

- **UI icons** (DESIGN §5.1) stay uniform-stroke and geometric: they are controls, and controls should look like controls. Only change: corners and caps match the illustration's round brush feel (already 2 px round).
- **Reaction bursts** (tears, "!", sweat drop, heart, rain cloud, confetti; platform §3.7) are **illustration**, drawn by the artist in the marker style with 3 boil variants each.
- **Role emblems** (house, mask, empty card; DESIGN §5.3) get a hand-drawn version with the same silhouettes (IoU ≥ 0.92).

### 9.6 Empty and error states

Each is a tiny scene with one character, never a stock illustration of "a person with a laptop":

| State | Scene |
|---|---|
| Waiting for players (hub, < 3) | one character on the sofa holding the door open, "tfaddalo" |
| Room not found / bad code | a character looking at a door with the wrong number on it |
| Reconnecting | a character holding a TV antenna up, boil faster (12 fps) |
| No packs in this language yet | a character with a phrasebook, confused |
| Game ended / thanks | the gang waving from the balcony, lamp switching off |

### 9.7 Celebrations

- **Confetti** is cut paper in the players' own colours and shapes (tiny circles, squares, stars, crescents…), 3 sizes, falling with paper flutter (rotation + sideways drift), not glitter, not particles with glow.
- **Winner podium** (all games): the winner at 160 dp in `cheer`, a hand-lettered "Champion" / «البطل» banner (cloth *yafta* banner shape [16]), a brass cup.
- **The LIE! stamp** (Bluff): a rubber-stamp lettering with uneven ink coverage (3 drawn variants of the ink gaps).

---

## 10. Motion

### 10.1 Two clocks

| Clock | Rate | What runs on it |
|---|---|---|
| **UI clock** | 60 fps (display rate) | focus, scrolling, sheets, portal masks, entrances, coin flights, timers, the stage. Smooth is correct for UI: it is the "machine" |
| **Drawing clock** | **12 fps** (83 ms steps; "on twos" at 24 fps) and **8 fps** (125 ms) for idle boil | line boil, character *acting* (expression key changes, laugh shakes, smears), reaction bursts, confetti rotation, lantern flicker, the reconnecting antenna |

The contrast between a smooth camera and characters drawn on twos is what makes hand-drawn animation feel hand-drawn. Character **travel** (run-ins, hops along an arc, conga lines) stays on the UI clock so it doesn't stutter on TVs; the character's **pose and drawing** step on the drawing clock. **[PROPOSAL-ART P6]**: the shared sampler gets an optional `steps: 12 | 8` field on a step, quantising its output time (`floor(t × fps) / fps`), identical in TS and Kotlin and covered by the `choreo.json` fixture.

### 10.2 Principles (with numbers)

| Principle | Rule |
|---|---|
| **Anticipation** | before every hop or jump: a 1-step (83 ms) pre-squash to 0.94. Before a big reveal: a 2-step "inhale" (squash 1.04) |
| **Squash and stretch** | volume preserved (rig formula); stretch along the motion direction up to 1.10, squash on contact to 0.88. On landing: 1 step at 0.88, then back through 1.03 |
| **Smears** (for `shock`, the liar popping out, fast points) | 1–2 frames where the body is drawn stretched 1.25–1.4 along the motion with the outline thinned; delivered as drawn smear variants per body |
| **Hold frames** | every reveal holds its key drawing for **8–12 drawing frames (0.66–1 s)** while the boil keeps it alive. A held pose that stops boiling looks dead; one that boils looks like it's waiting |
| **Follow-through and overlap** | props lag the body by 1 step and settle 1 step after; the face lands 1 step before the body in `sad` (the body follows the feeling) |
| **Arcs** | everything that travels uses an arc (coins already do, DESIGN §6.2 B). No straight-line tweening of characters |
| **Timing variety** | in group moments (12 characters cheering), each character starts 0–3 drawing steps late (seeded), and hops on a slightly different period (±10 %) so the crowd isn't a chorus line |
| **Easing** | UI keeps DESIGN §6.1 curves. Character springs keep `spring.hop` / `spring.bouncy` sampled by the shared runner |

### 10.3 Line boil

- Each body, prop, burst and near-scenery element has **3 drawn variants** (A, B, C): the same drawing traced again inside the §3.3 hand budget with ≤ 0.25 unit additional displacement. Cycle A → B → C → A (not ping-pong, which reads mechanical) at **8 fps when idle**, **12 fps during acting or reveals**.
- Face features boil too but with **half** the displacement (faces must stay readable).
- **One clock for all**: all elements switch on the same tick, but each element starts on a seeded offset (A, B or C), so the screen doesn't pulse.
- **Off** in calm / reduced motion (variant A held) and in lite motion on the TV (variant A held). The boil is motion.
- **Cost:** variants are precomputed path data. On the phone, store variants for the 12 bodies only at sizes ≥ 64 px and generate them at build time; budget estimate ≈ 12 bodies × 2 extra variants × ~140 B ≈ 3.4 KB raw, ~1.3 KB gz **[E]**, which must fit the character renderer's 3 KB gz budget or be lazy-loaded with the first game chunk. On the TV, `Path` objects are cached per variant (36 body paths), switching is a reference swap. Alternative if the budget is tight: a deterministic **seeded jitter function** (~0.3 KB) that perturbs the canonical path's control points at build or load time, ported to Kotlin and pinned by the characters fixture. **[PROPOSAL-ART P7]**
- Background far layers **never** boil (stability; the eye needs a still horizon). Mid layers boil at 4 fps only if the illustrator's test proves it pleasant.

### 10.4 Line as emotion (special effects, sparingly)

- **The liar is caught** (Bluff reveal): for 1 s the liar's outline switches to a **jittery, sketchy double line** (two of its boil variants drawn at once at 70 % opacity) while `shock` plays. Then it snaps back to the clean line. It's the visual "busted".
- **Eliminated / away**: line goes thin (0.6 unit) and fill desaturates (spec), boil slows to 4 fps: the character is "fading out of the drawing".
- **Winner**: line goes slightly thicker (1.1 unit) for the podium hold: "drawn bolder".

### 10.5 Reduced, calm and lite

The DESIGN §6.3 and platform §3.8 rules win. In calm/reduced motion: no boil, no smears, no shakes, holds stay, expressions crossfade (120 ms) as specified. In lite motion: no boil, no mottling, no paper grain (spec), misregistration and line weight kept (static, free).

---

## 11. Do / don't board (in words)

| Do | Don't |
|---|---|
| Draw every element as a **thing** (lamp, tile, coin, cup) | Add decorative blobs, floating circles, abstract squiggles "for energy" |
| Flat fills + one hand-cut shadow + one highlight | Gradients on objects, glossy highlights, plastic 3D shading |
| Gradients only for **light** (lamp cones, window glow, stage glow) | Purple-to-pink "app" gradients, mesh gradients, aurora backgrounds |
| Thick-thin ink line in the world's ink colour | Uniform 2 px strokes on illustration, pure black outlines, hairlines |
| Seeded, stored imperfection within the hand budget | Random per-frame wobble, glitch effects, perfect symmetry |
| Stepped 8–12 fps boil and acting, smooth 60 fps UI | Everything smooth (feels like a template) or everything stepped (feels broken) |
| 3 inks + paper + ink per scene; overprint for a 4th | Rainbow palettes, every player colour in the background |
| Paper tooth grain, riso misregistration on art layers | Grunge overlays, film scratches, noise on text |
| Ruq'ah-based Arabic display lettering, drawn by a native letterer | Fake-Arabic Latin fonts, mirrored Latin lettering, Thuluth/Diwani for fun titles, any religious text as ornament |
| Bilingual lockups designed as one composition | An Arabic "translation tag" in small type under a big Latin logo |
| Beirut everyday life: balconies, plant tins, water tanks, plastic chairs, shop signs, café brass, rakweh, tawleh, cement tiles, tangled wires | Cedars, flags, camels, palm-tree oases, desert dunes, tarboush, belly dancers, genie lamps, mosque domes, "Arabian Nights" gold-on-black [22] |
| Invented, bilingual shop names lettered by hand | Real brands, real shops, political or sectarian signs, war imagery |
| Characters act with eyes, lean, squash and timing | Adding limbs, clothes, hair, noses or teeth to the shilleh |
| Cut-paper confetti in the players' colours and shapes | Glitter, glowing particles, generic emoji-style stickers |
| A human illustrator signs off every final asset | AI-generated images, AI "references" or AI upscales anywhere in the pipeline |
| One look per world, one hand across all worlds | Copying any Jackbox game's look, host or lettering (BLUEPRINT §3) |

**The "AI vibe" test.** Before shipping a screen, ask: could this image have come out of a generic prompt? Warning signs: a gradient background with soft blobs; perfect radial symmetry; every element equally detailed; glossy 3D icons; meaningless texture; a palette of six saturated hues; lettering that is just a font with an outline and a glow. Any two of these and the screen goes back to the illustrator.

---

## 12. Brief for a human freelance illustrator

### 12.1 Who we're looking for

An illustrator (or a pair: illustrator + Arabic letterer) with **flat vector or print-based work** (riso, screenprint, linocut, editorial), **character acting** in simple shapes, and ideally **Levantine roots or deep familiarity with Beirut**. Bilingual lettering (Arabic + Latin) is a strong plus; if the illustrator doesn't letter Arabic, we hire a separate Arabic letterer for §12.2 item 6. Portfolio check: at least 3 pieces with limited palettes and visible hand, and one animated or multi-pose character piece.

### 12.2 Deliverables (phased)

| # | Phase / item | Contents | Format |
|---|---|---|---|
| 0 | **Paid style test** (1 week) | 3 characters (circle, star, arch) in `idle`, `shock`, `cheer` with the thick-thin line, shadow and highlight; one 960 × 540 hub background sketch; one tile border; palette test on the hub and one world | SVG + PNG previews; layered source |
| 1 | **Character sheet** | All 12 bodies redrawn within the hand budget (§3.3), 3 boil variants each; 13 expressions as face features for the 12 × 9 face space (+ boil variant for each, half displacement); smear variants (2 per body); key poses (§8.4) as rig settings + drawings; ground shadow | SVG, one path per layer, named ids |
| 2 | **Props and bursts** | the 10 props of DESIGN-JAMAA §4.5 + 6 reaction bursts + check / wifi-off / crown badges (hand version) + role emblems, 3 boil variants each | SVG |
| 3 | **Hub** | hub room in 3 layers + 12-element ambient pieces + Tonight's cup (3 states) | SVG layers, motion notes |
| 4 | **Worlds × 4** | far / mid / near layers, the world's door, 2–3 parallax props, invented bilingual signs (per locale where lettered) | SVG layers |
| 5 | **Key art × 4** | poster (210 × 290 dp, code-drawable) + marketing versions 1:1, 16:9, 9:16, 1280 × 720 TV banner background | SVG (poster), layered source + PNG/JPG (marketing) |
| 6 | **Lettering** | 4 game titles × EN / FR / ES / AR (ES with ¡ ¿; FR with accents), the JAMAA display words list (≈ 12: LIE!, Champion, Tonight's cup, Correct, Mind Reader, …) × 4 locales; bilingual lockups for the 4 titles | SVG outlines (no live text) |
| 7 | **Ornaments** | 3 tile borders, 3 arch frames, 3 dividers, corner flourish | SVG, tileable where relevant |
| 8 | **Empty states and celebrations** | the 5 empty-state scenes (§9.6), confetti set (12 shapes × 3 sizes), winner banner, LIE! stamp (3 ink variants) | SVG |
| 9 | **Textures** | paper tooth tile, ink mottling tile | 512 × 512 grayscale PNG, seamless (we downsample) |
| 10 | **Optional set-pieces** | confetti burst, cup trophy, title stingers as Lottie | Lottie JSON without expressions, images or text layers, ≤ 80 KB each (platform §3.8) |
| 11 | **Style guide** | 6–10 page PDF: the rules as the artist applied them, with examples, for future artists | PDF |

### 12.3 Technical rules for the SVG (so code can draw it)

- **Plain SVG paths only**: `path`, `circle`, `ellipse`, `rect`. No filters, no masks unless agreed, no embedded bitmaps, no live text, no strokes in finals (outline strokes to fills; we need the thick-thin ring as a filled path).
- **Character units**: bodies in the 24 × 24 viewBox of DESIGN §5.2; face features in the 12 × 9 face space; props in body units at the anchors of DESIGN-JAMAA §4.5.
- **Scenes**: the 960 × 540 canvas, +10 % bleed each side, layers as separate files.
- **Colours**: only the token hexes of §5.2 and DESIGN; opacity and blend noted in the layer name (e.g. `shadow__ink__22__multiply`).
- **Node budget**: ≤ 60 nodes per body variant, ≤ 30 per face feature set, ≤ 400 per scene layer **[E]**, so the phone budget and Compose path parsing stay cheap.
- **Naming**: `body_<shape>_<A|B|C>.svg`, `face_<expression>_<A|B>.svg`, `prop_<id>_<A|B|C>.svg`, `world_<id>_<far|mid|near|door>.svg`, `title_<game>_<locale>.svg`.
- **RTL**: anything with a handed direction (pointing, the hand anchor, signs) is delivered in LTR; mirroring follows DESIGN §10. Lettering is never mirrored: Arabic versions are separate drawings.

### 12.4 Process

1. Kickoff with this file + DESIGN-JAMAA §4 + the token tables.
2. Style test (phase 0), paid whether or not we continue.
3. Weekly crit (30 min): the artist shows work in progress *rendered by our code* (we turn SVGs into the `/tv` mock within 48 h), on a real TV at 3 m when possible.
4. Two revision rounds per phase included; further rounds billed hourly.
5. Arabic lettering reviewed by a native reader before sign-off.

### 12.5 Acceptance tests (automatable where marked)

- Body IoU vs canonical glyph ≥ 0.92 (auto).
- Node budgets (auto).
- Faces legible at 72 dp on TV and expressions doubled by motion at 40–64 dp (render test, existing §9 checks).
- No colour outside the token list (auto).
- RTL render check; Arabic native review.
- The "AI vibe" test (§11) by the owner.

### 12.6 Contract essentials

- **Work for hire / full IP assignment** of all deliverables and sources, worldwide, all media, including the right to modify and to animate (BLUEPRINT §3.4 already requires a written IP assignment for commissioned work).
- **No AI generation** at any stage (sketch, reference, texture, upscale); the artist warrants the work is original and not traced from third-party art.
- Credit in the app's credits screen and store listing (artists value it; it costs nothing).
- Payment: 30 % on kickoff of each phase, 70 % on acceptance.

### 12.7 Budget ranges (with sources)

Market benchmarks found (2025–2026, mostly agency or marketplace guides, so treat as rough and possibly skewed high by agencies, low by marketplaces):

| Benchmark | Range | Source |
|---|---|---|
| 2D game character design, per character | $300–2 000 | Pixune [23] |
| Game character design, per character | $500–2 500 | Fueler [24] |
| Concept art piece | $200–1 500 | Rocketbrush [25] |
| Mid-tier freelance illustrator, hourly | $40–80/h | Rocketbrush [25] |
| Junior freelance, hourly | $30–55/h | Fueler [24] |
| Fixed-price marketplace character packages | $30–185 | Fiverr [26] (a different, low segment: not suitable for this brief) |
| Pricing and licensing customs | Graphic Artists Guild Handbook, 17th ed. (MIT Press, 2025) [27] | for contract terms; game-specific numbers are thin there |

Our estimate for this brief **[E]** (our characters are fixed geometry, so "12 characters" is closer to one character style sheet plus variants than to 12 full designs):

| Phase | Low | High |
|---|---|---|
| 0 Style test | $400 | $1 000 |
| 1 Character sheet (12 bodies × 3 variants, 13 expressions, smears, poses) | $2 500 | $6 000 |
| 2 Props, bursts, badges, emblems | $1 000 | $2 500 |
| 3 Hub | $1 200 | $3 000 |
| 4 Worlds × 4 | $3 200 | $8 000 |
| 5 Key art × 4 (poster + marketing crops) | $2 000 | $6 000 |
| 6 Lettering (4 titles × 4 locales + display words + 4 bilingual lockups) | $2 000 | $6 000 |
| 7–9 Ornaments, empty states, celebrations, textures | $1 500 | $3 500 |
| 11 Style guide | $300 | $800 |
| **Total (without optional Lottie)** | **≈ $14 000** | **≈ $37 000** |
| 10 Optional Lottie set-pieces (3) | $900 | $3 000 |

How to land at the low end: hire an illustrator based in Lebanon or the region (rates are often lower than US agency rates **[E]**), keep phase 0 strict, and start with the hub + one world (Bluff) + characters (≈ $8 000–18 000 **[E]**), then commission the other worlds as each game ships.

---

## 13. Proposals collected (none applies until accepted)

| Id | Proposal | Touches |
|---|---|---|
| P1 | Character outline as a precomputed variable-weight filled ring (thick bottom-end, thin top-start) | DESIGN-JAMAA §4.2, `tools/gen-characters`, characters fixture |
| P2 | Per-world `world.ink`, `world.paper` and three illustration inks (illustration only) | DESIGN-JAMAA §1.5 / §8, `shared/src/worlds/palettes.ts` |
| P3 | Grain tile content: paper tooth instead of fractal noise; optional ink-mottling tile on large fills | DESIGN §2.1 stage, DESIGN-JAMAA §1.5 |
| P4 | Hand-lettered title lockups and display words replace the generated Cairo treatments (treatments kept as material) | DESIGN-JAMAA §1.6, `assets/games/<id>/title_*.svg` |
| P5 | Poses that change the body path (e.g. a real `sit`) | platform §3.7 rig |
| P6 | A second animation clock: `steps: 12 \| 8` on choreography steps for character acting and boil | platform §3.8 sampler, `choreo.ts`, `Choreo.kt`, fixture |
| P7 | Line boil from 3 stored path variants (or a seeded jitter function), off in calm and lite | platform §3.7–3.8 budgets, characters fixture |
| P8 | Ground shadow tinted `world.ink` instead of `#000` | DESIGN-JAMAA §4.2 |

---

## 14. Sources

Fetched or searched on 2026-11-08. Jackbox's own blog host could not be fetched from the authoring container; its content is cited from search-result extracts and should be re-read before quoting.

1. Jackbox Games, "Behind the scenes of PP10 art": https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-art (mirror seen: www-origin2.jackboxgames.com)
2. MCV/Develop, Allard Laban and Belia Portillo on Jackbox Party Pack 11: https://mcvuk.com/?p=228822
3. The Nerd Stash, Drawful 2 review: https://thenerdstash.com/drawful-2-review
4. Super Mario Wiki, WarioWare series: https://www.mariowiki.com/WarioWare
5. Slant Magazine, WarioWare: Get It Together! review: https://www.slantmagazine.com/games/warioware-get-it-together-review/
6. Game Developer, "Road to the IGF: House House's Untitled Goose Game": https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i- ; Nintendo Life feature: https://www.nintendolife.com/news/2019/09/feature_how_a_joke_hatched_gamings_most_horrible_goose
7. Game Developer, "Designing Florence to convey the ineffable feeling of being in love": https://gamedeveloper.com/audio/designing-i-florence-i-to-convey-the-ineffable-feeling-of-being-in-love ; FZine interview with Ken Wong: https://www.fzine.com/culture/ken-wong-mountains-interview-florence-creative-director
8. GamesRadar, "The making of Cuphead": https://gamesradar.com/the-making-of-cuphead ; Kill Screen, "Where did Cuphead come from": https://www.killscreen.com/where-did-cuphead-come/
9. Kotaku, "Ko Takeuchi is the master of nerd culture doodles": https://kotaku.com/ko-takeuchi-is-the-master-of-nerd-culture-doodles-1785573509
10. Wikipedia, Rhythm Heaven (video game) (2D vs 3D prototypes): https://en.wikipedia.org/wiki/Rhythm_Heaven_(video_game) ; Iwata Asks, Rhythm Heaven: https://iwataasks.nintendo.com/interviews/ds/rhythm-heaven/0/5
11. Destructoid, "How Chicory: A Colorful Tale fuses creativity and colors": https://destructoid.com/?p=266364
12. Game Developer, "How Townscaper works": https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making ; Sylves, Townscaper grid tutorial: https://boristhebrave.com/docs/sylves/1/articles/tutorials/townscaper.html
13. Game Developer, "Road to the IGF: Team Alto's Alto's Odyssey": https://www.gamedeveloper.com/business/road-to-the-igf-team-alto-s-i-alto-s-odyssey-i- ; 80.lv, "Alto's Adventure: a game with style": https://80.lv/articles/altos-adventure-a-game-with-style
14. CCCB, Conrad Roset: https://cccb.org/en/participants/file/conrad-roset/232979
15. College for Creative Studies Imaging Center, "Registration & Trapping": https://campus.collegeforcreativestudies.edu/imaging-center/2021/06/22/registration-trapping/ ; Moniker Press, Risograph print guide: https://monikerpress.ca/printing
16. Khtt.net, Beirut hand-painted street signs in Ruq'ah (Tarek Atrissi, UNESCO DigiArts): https://www.khtt.net/en/id/2402 ; The National, Lebanon's truck art: https://www.thenationalnews.com/arts-culture/books/how-one-photographer-tracked-down-the-artist-behind-lebanon-s-truck-art-1.855626 ; AUB, "Letters with Voices": https://www.aub.edu.lb/art_galleries/Pages/Letters-with-Voices.aspx
17. Lebanon Traveler, "Evolving towards the past at Blatt Chaya": https://www.lebanontraveler.com/en/magazine/evolving-towards-the-past-at-blattchaya/ ; Al Jazeera, "Lebanese artisan revives mosaic tile tradition": https://www.aljazeera.com/gallery/2016/8/6/lebanese-artisan-revives-mosaic-tile-tradition ; ABE Journal on cement tiles in Syria and Lebanon: https://journals.openedition.org/abe/10849
18. Rosetta Type, "A brief overview of the various Arabic calligraphic styles": https://old.rosettatype.com/blog/2016/05/24/Arabic-calligraphic-styles ; Wikipedia, Arabic typography: https://en.wikipedia.org/wiki/Arabic_typography
19. AIGA Eye on Design, "The bold graphics and hidden stories behind the golden age of Lebanese film": https://eyeondesign.aiga.org/the-bold-graphics-and-hidden-stories-behind-the-golden-age-of-lebanese-film/ ; MERIP, Zeina Maasri, "Off the Wall": https://merip.org/2009/11/maasri-off-the-wall/ ; Designboom, "Brilliant Beirut": https://www.designboom.com/design/dubai-design-week-brilliant-beirut-lebanon-dubai-design-district-rana-salam-11-03-2015/
20. Camillo Visini, "Simulating hand-drawn motion with SVG filters" (seed stepped at 8–12 fps): https://camillovisini.com/coding/simulating-hand-drawn-motion-with-svg-filters ; PremiumBeat, "How to create line boil animations": https://www.premiumbeat.com/blog/how-to-create-line-boil-animations
21. Bahia Shehab and Haytham Nawar, *A History of Arab Graphic Design* (AUC Press, 2020), via New Books Network: https://newbooksnetwork.com/a-history-of-arab-graphic-design
22. Communicate Online, "The art in contemporary Arabic branding" (calligraphy and Orientalism as clichés): https://communicateonline.me/news/the-art-in-contemporary-arabic-branding/
23. Pixune, "How much does character design cost? 2026 pricing guide": https://pixune.com/blog/how-much-does-a-character-design-cost/
24. Fueler, "Freelance illustration rates 2026: character vs commercial": https://fueler.io/blog/freelance-illustration-rates-character-vs-commercial
25. Rocketbrush, "2D character art prices" and "Character concept art cost": https://rocketbrush.com/blog/2d-character-art-prices-and-tips-to-cut-costs , https://rocketbrush.com/blog/character-concept-art-cost-a-full-guide
26. Fiverr cost guides: https://fiverr.com/resources/guides/costs/anime-illustrator
27. Graphic Artists Guild Handbook: Pricing & Ethical Guidelines, 17th ed.: https://graphicartistsguild.org/handbook-17-edition/
