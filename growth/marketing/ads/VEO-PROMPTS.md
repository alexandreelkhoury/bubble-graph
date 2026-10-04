# Mish Ana! — Veo 3.1 prompts for MA_A_H1 and MA_B_H1

Written 2026-10-04. Goes with `SCRIPTS.md` (v2) and `REVIEW.md`. This file covers only the **people and the room**. Every game screen (TV lobby, QR, phone cards, votes, OUT stamp, role card, end card) is rendered in Remotion from the real UI, never by Veo.

**What's in here:** 1 Setup · 2 Cast sheet and reference stills · 3 Shot lists and prompts (shared BODY-1 shots, MA_A_H1, MA_B_H1) · 4 Take-selection checklist · 5 AI label and honest-use rules · Sources.

**At a glance**

| | AI shots to generate | AI seconds on screen | Motion / real UI seconds |
|---|---|---|---|
| Shared BODY-1 (used by both ads) | 6 | 7.5 s per ad | 3.0 s per ad (phone grid, TV reveal) |
| MA_A_H1 "IT WAS YOU?!" | 3 own + 6 BODY = **9** | ≈ 12.2 s of 20 s | ≈ 7.8 s |
| MA_B_H1 "Stop passing the phone" | 6 own + 6 BODY = **12** | ≈ 13 s of 20 s | ≈ 7 s |
| **Unique shots in total** | **15** | | |

Expected spend for one clean pass: **about 45 video generations, about 930 Flow credits.** That is roughly one month of Google AI Pro (1,000 credits). Plan for 10–15 re-rolls on top, which means waiting for next month's credits or buying a top-up. The budget table is in §1.6.

---

## 1. Quick setup for the owner

### 1.1 Use Flow, not the Gemini app
- **Use Google Flow** (labs.google/fx/tools/flow, the same Google account as your AI Pro plan). Flow lets you pick **Veo 3.1** explicitly, set **9:16**, use **Ingredients** (reference images) and download **1080p**.
- **Avoid the Gemini app for these shots.** In 2026 the Gemini app's video button reportedly defaults to the newer *Gemini Omni* model rather than Veo 3.1 (top output 720p), and Pro accounts get only about 3 videos a day there. Videos made in the Gemini app also can't be upscaled to 1080p; only Flow, the Gemini API and Vertex can do that. The Gemini app *is* fine for making the still reference images (§2), because image generation there doesn't use Flow credits.
- Check that Flow is available in your country (Flow Help → "Where you can use Google Flow").

### 1.2 One-time project setup
1. Open Flow → **New project** → name it `MishAna Ads R1`.
2. Upload the reference stills from §2 (`LINA.png`, `SAMI.png`, `MAYA.png`, `OMAR.png`, `KARIM.png`, `ROOM.png`, plus the two start frames `A01_start.png` and `A02_start.png`). They stay in the project as assets.
3. In the prompt box, make sure **Agent is off**. You want your prompt sent exactly as written.

### 1.3 Settings for every video generation
In the prompt box, click the **model name** (it defaults to the image model, Nano Banana Pro) → **Video**, then pick the mode:

| Setting | Value |
|---|---|
| Mode | **Ingredients** for almost every shot (drag in the reference images listed with the shot). **Frames** (start frame only) for the two hero shots A01 and A02 |
| Model | **Veo 3.1 – Lite** for a first test of a new prompt (10 credits). **Veo 3.1 – Fast** for real takes (20 credits). **Veo 3.1 – Quality** only for the Frames hero shots (100 credits). In Flow, *Quality does not support Ingredients*; Lite and Fast do |
| Aspect ratio | **Portrait 9:16** (check it on every shot: the default is landscape) |
| Length | **8 s** (Ingredients only allows 8 s, and Fast and Quality cost the same at 4, 6 or 8 s, so always take 8 s and trim in the edit) |
| Outputs | **1** for Lite tests, **2** for Fast runs (each output counts as one generation and is billed) |

### 1.4 Prompt workflow per shot
1. Paste the main prompt and attach the listed ingredients. Run it once on **Lite**.
2. If the action, framing and line are right, run the same prompt on **Fast with 2 outputs**.
3. If it's wrong, fix the prompt (or try Variation 1 or 2) on Lite before spending Fast credits.
4. Stop when you have **one take that passes the checklist in §4**. You only need 0.5–2.7 s of each clip.

### 1.5 Download and file naming
- Hover over the clip → **More (⋮)** → **Download** → choose the **1080p (upscaled)** option. Reports say this is included for subscribers; check the credit display before you confirm. Don't pick the original 720p or **270p**, which is the GIF option. 4K upscaling is reportedly Ultra-only and isn't needed: the ads render at 1080×1920.
- Rename every download: `{AD}_shot{NN}_take{N}.mp4`
  - Ad-specific shots: `A_H1_shot01_take1.mp4`, `B_H1_shot04_take2.mp4`
  - Shared BODY-1 shots: `BODY_shot03_take1.mp4`
- Rename the one take you choose per shot to end in `_PICK`, e.g. `A_H1_shot01_take3_PICK.mp4`. Keep the other takes.
- **Drop everything into `/home/alex/mishana-video/public/ai/`.** Put the reference stills in `/home/alex/mishana-video/public/ai/refs/`.
- Leave the clips untouched: no trims, no filters, no re-encoding. Veo outputs 24 fps; Remotion plays the clips inside the 60 fps composition. Don't speed-ramp AI clips in the edit, because ramps show the 24 fps judder.

### 1.6 Credit budget (Google AI Pro = 1,000 Flow credits a month; unused credits don't roll over)

| Item | Generations | Credits |
|---|---|---|
| 13 regular shots × (1 Lite test + 1 Fast run with 2 outputs) | 39 | 13 × (10 + 40) = 650 |
| 2 hero shots (A01, A02) × (1 Fast Ingredients test with 2 outputs + 1 Quality Frames take) | 6 | 2 × (40 + 100) = 280 |
| **Clean pass** | **≈ 45** | **≈ 930** |
| Re-roll buffer (realistic) | +10–15 Fast | +200–300 |

Ways to save credits: skip the Lite test when a prompt only swaps the character in a shot that already worked (BODY_shot02 → 03 → 04). If your account also shows a free 50-credit daily allowance, it covers 2 Fast drafts or 5 Lite tests a day. Reference stills made in the Gemini app don't touch Flow credits.

---

## 2. Cast sheet

Five friends, 25–35, at home on a weekend night. The names match `SCRIPTS.md` (Sami = Mole, Lina = accuser, Maya = peeker, Omar = skeptic, Karim = quiet one). The Host from the scripts is left out to keep the cast at five; see the caption note in MA_B_H1.

**Paste the cast text exactly as written below**: it appears word for word in every prompt. Changing a single word ("mustard" → "yellow") is enough to change the face or the outfit.

| Name | Paste-exact description |
|---|---|
| **LINA** | `LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans` |
| **SAMI** | `SAMI, a 31-year-old Arab man with warm light-brown skin, short black hair with a low fade, a neatly trimmed short black beard, a wide dimpled grin, wearing a plain forest-green crewneck sweatshirt with no logo over a white T-shirt collar` |
| **MAYA** | `MAYA, a 26-year-old Black woman with deep brown skin, a short rounded natural afro, round tortoiseshell glasses, wearing a plain lavender hoodie with no logo` |
| **OMAR** | `OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt` |
| **KARIM** | `KARIM, a 29-year-old East Asian man with straight black shoulder-length hair tied in a small low ponytail, clean-shaven, wearing a plain light-grey crewneck sweater with no logo` |

**Shared blocks** (pasted into every prompt):

- **ROOM:** `A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.`
- **LOOK:** `Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.`
- **PHONES** (only in shots that have phones): `Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.`
- **AVOID:** `Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.`

**Room geography** (keeps eyelines consistent across cuts):
- The **TV is where the camera is**: in front of the group, always out of frame. Faces get a soft cool-white glow from it, and in reveal shots that glow turns **orange** (the Mole card colour, `#FF8A3D`).
- On the sofa, left to right as the camera sees it: **MAYA, LINA, OMAR**. **SAMI** sits in the **armchair at frame right**. **KARIM** sits on a floor cushion at the front-left of the sofa.
- So people on the sofa look **toward frame right** when they look at Sami, and Sami looks **toward frame left** at them.

### 2.1 Reference stills (make these first)

Make them in the Gemini app (Nano Banana; no Flow credits) or in Flow with Nano Banana Pro. Use 9:16, and generate 3–4 options per character. Keep the one that looks most like an ordinary person you could meet, not a model. Save them as `LINA.png` and so on. Flow recommends subject references on a **plain background**, so the character stills use one.

**Character still** (repeat for each person, swapping in that person's paste-exact description):
```
Photorealistic portrait photo, vertical 9:16. [PASTE CAST DESCRIPTION]. Standing, framed from the knees up, facing the camera with a relaxed natural half-smile, arms loosely at the sides, hands relaxed and fully visible. Plain light-grey seamless studio background, soft even daylight, realistic skin texture with pores, no retouching, no makeup glam. The full outfit is clearly visible. No text, no logos, no jewelry other than what is described.
```

**ROOM plate** (`ROOM.png`, no people):
```
Photorealistic vertical 9:16 photo taken on a smartphone at night, eye level from where a TV would stand, looking at: [PASTE ROOM]. The sofa and armchair are empty. Warm amber lamp light, fairy lights, a soft magenta glow on the back wall, faint cool-white light falling on the sofa from the TV behind the camera. Slight phone-camera noise. No people, no text, no logos, no TV in frame.
```

**Start frames for the two hero shots** (attach the character still and `ROOM.png` as reference images):

`A01_start.png`:
```
Using the attached reference images for Lina and the living room: photorealistic vertical 9:16 smartphone photo, medium close-up. [PASTE LINA] is caught mid-leap up from the grey sofa, both feet off the cushion, body angled toward the camera, her right arm thrust out pointing just past the right side of the lens, mouth wide open in a shocked scream, eyes huge, curls flying. Her face is lit by a strong orange glow from a TV behind the camera, with a soft magenta glow on the wall behind her. Slight motion blur on her hand, handheld snapshot feel, realistic skin. No text, no logos, no TV in frame.
```
`A02_start.png`:
```
Using the attached reference images for Sami and the living room: photorealistic vertical 9:16 smartphone photo, medium close-up. [PASTE SAMI] sits in the grey armchair, leaning back, both palms raised at shoulder height in a "not me" gesture, a guilty wide dimpled grin, eyes looking just past the left side of the lens. Orange glow from a TV behind the camera on his face, warm lamp light, soft magenta wall glow behind. Handheld snapshot feel, realistic skin. No text, no logos, no TV in frame.
```

**Ingredients per shot:** the API allows **up to 3 reference images** per generation (Flow may allow more, but 3 is the safe number). That's one reason no shot has more than 3 people. Attach the characters who are in the shot; if there's room left, add `ROOM.png`.

---

## 3. Shot lists and prompts

How to read each shot:
- **Slot**: where the clip sits in the ad timeline. **Use**: how many seconds of the 8 s clip end up in the ad. Every shot is generated at 8 s.
- **Mode / Ingredients**: what to set in Flow.
- **Composite**: whether Remotion has to put real UI *into* the shot. "Overlay" means the UI sits on top as an edit graphic, so the plate needs nothing special.
- **Variations**: copy the main prompt, then replace only the lines named (usually ACTION and CAMERA).

Dialogue syntax follows Google's guide: speaker, colon, and the line in quotes. That's what triggers lip-sync and keeps the words out of on-screen text.

### 3.0 Shared BODY-1 "The Round" (generate once, used in both ads)

| BODY t (rel.) | Content | Source |
|---|---|---|
| 0.0–1.5 | Omar scans the TV | **AI BODY_shot01** + Remotion overlay: real "You're in!" phone screen + tile dropping into the TV lobby |
| 1.5–3.0 | 2×2 phone grid, PIZZA ×3 / PASTA, amber ring | **MOTION** (real card UI) |
| 3.0–5.5 | Clues: Lina "Cheese." · Omar "Oven." · Sami "…Fork?" (≈0.83 s each) | **AI BODY_shot02, 03, 04** + `Bubble` overlays + "1 clue each, out loud" chip |
| 5.5–7.0 | Vote on phones, Lina points at Sami | **AI BODY_shot05** + caption "Vote on your phone." |
| 7.0–8.5 | Chips fly → OUT → orange Mole card, "…the Mole! Nice catch." | **REAL UI** rendered in Remotion |
| 8.5–9.5 | The room explodes | **AI BODY_shot06** |

---

#### BODY_shot01 — Omar scans the TV (seen from the TV)
- **Slot:** BODY 0.0–1.5 · **Use:** 1.5 s · **Mode:** Ingredients, Fast · **Ingredients:** `OMAR.png`, `ROOM.png`
- **Composite:** overlay only. The camera *is* the TV, so the QR is "in the lens" and we only see the back of the phone. Remotion cuts or splits to the real "You're in!" screen and the lobby tile drop.

```
Using the provided reference images for Omar and the living room.
CAST: OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Omar sits forward on the sofa and holds his phone up at arm's length straight toward the camera, as if pointing its camera at the TV, squinting slightly. After a second he relaxes, lowers the phone to his chest and smiles, satisfied. The back of the phone faces the camera the whole time. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Static eye-level shot from the position of the TV, medium shot, Omar centered, very slight handheld drift.
LIGHT: Cool-white glow from the TV on his face, warm amber lamp light from the side, magenta wall glow behind.
AUDIO: Omar says quietly: "I'm in." Ambient sound only: soft room tone, friends murmuring off-screen, a light laugh. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION + CAMERA): `ACTION: Omar raises his phone with both hands toward the camera, holds it steady for a beat, then gives a small nod and a thumbs-up with his free hand while lowering the phone. The back of the phone faces the camera.` / `CAMERA: Static shot from the TV's position, slightly low angle, medium close-up.`
- **Variation 2** (ACTION): `ACTION: Omar leans forward off the sofa, holding the phone toward the camera at chest height, frowning in concentration, then grins and turns his head to frame left to say something to a friend. The back of the phone faces the camera.`

---

#### BODY_shot02 — Lina's clue: "Cheese."
- **Slot:** BODY 3.0–3.8 · **Use:** 0.8 s · **Mode:** Ingredients, Fast · **Ingredients:** `LINA.png`, `ROOM.png` · **Composite:** none (Bubble overlay)

```
Using the provided reference images for Lina and the living room.
CAST: LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Lina sits cross-legged on the sofa, holding her phone face-down against her knee. She looks around at her friends with a confident smirk and says one word, sure of herself, then raises her eyebrows. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Medium close-up, eye level, handheld, Lina slightly left of center.
LIGHT: Cool-white glow from the TV in front of her, warm amber lamp light, magenta wall glow behind.
AUDIO: Lina says confidently: "Cheese." Ambient sound only: quiet room tone, someone off-screen says "mm-hm". No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Lina leans toward the camera, taps one finger on her chin as if it's obvious, says one word, then leans back with arms crossed.`
- **Variation 2** (CAMERA): `CAMERA: Close-up, slightly low angle, a slow push-in as she speaks.`

#### BODY_shot03 — Omar's clue: "Oven."
- **Slot:** BODY 3.8–4.7 · **Use:** 0.8 s · **Mode:** Ingredients, Fast (skip the Lite test if shot02 worked) · **Ingredients:** `OMAR.png`, `ROOM.png` · **Composite:** none

Same prompt as BODY_shot02 with these lines swapped:
```
Using the provided reference images for Omar and the living room.
CAST: OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt.
ACTION: Omar sits on the sofa, elbows on his knees, phone held loosely in both hands with the screen toward him. He narrows his eyes skeptically at the group, then says one word in a flat, deliberate voice and shrugs. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Medium close-up, eye level, handheld, Omar slightly right of center.
AUDIO: Omar says flatly: "Oven." Ambient sound only: quiet room tone, a short giggle off-screen. No music.
```
- **Variation 1** (ACTION): `ACTION: Omar scratches his stubble, thinks for a beat, then says one word and points at the group with his phone hand, screen still facing him.`
- **Variation 2** (CAMERA): `CAMERA: Close-up from slightly left, handheld, a tiny quick zoom-in as he speaks.`

#### BODY_shot04 — Sami's clue: "…Fork?"
- **Slot:** BODY 4.7–5.5 · **Use:** 0.8 s · **Mode:** Ingredients, Fast · **Ingredients:** `SAMI.png`, `ROOM.png` · **Composite:** none

Same prompt as BODY_shot02 with these lines swapped:
```
Using the provided reference images for Sami and the living room.
CAST: SAMI, a 31-year-old Arab man with warm light-brown skin, short black hair with a low fade, a neatly trimmed short black beard, a wide dimpled grin, wearing a plain forest-green crewneck sweatshirt with no logo over a white T-shirt collar.
ACTION: Sami sits in the grey armchair at the right of the sofa, holding his phone face-down on his thigh. He hesitates, glances to frame left at his friends, and says one word with a nervous half-smile, his voice rising like a question. He freezes, smile stuck on his face. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Medium close-up, eye level, handheld, Sami slightly right of center, looking toward frame left.
AUDIO: Sami says hesitantly: "...Fork?" A beat of silence, then one friend off-screen repeats under their breath: "Fork?" Ambient room tone. No music.
```
- **Variation 1** (ACTION): `ACTION: Sami rubs the back of his neck, says one word too quickly, then takes a sip from a plain white mug to hide his face.`
- **Variation 2** (CAMERA): `CAMERA: Close-up, slightly high angle, handheld, a slow push-in that keeps going after he speaks.`

---

#### BODY_shot05 — The vote: phones down, eyes on Sami
- **Slot:** BODY 5.5–7.0 · **Use:** 1.5 s · **Mode:** Ingredients, Fast · **Ingredients:** `LINA.png`, `MAYA.png`, `ROOM.png` · **Composite:** none (caption "Vote on your phone.")

```
Using the provided reference images for Lina, Maya and the living room.
CAST: LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans. MAYA, a 26-year-old Black woman with deep brown skin, a short rounded natural afro, round tortoiseshell glasses, wearing a plain lavender hoodie with no logo.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Maya (left) and Lina (right) sit side by side on the sofa, each holding her own phone low in front of her chest, screen toward herself. Both tap their phones with a thumb once, decisively, while their eyes stay fixed suspiciously on someone off-frame to the right. Then Lina jabs her free index finger toward frame right. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Medium two-shot, eye level, handheld, both faces clearly visible.
LIGHT: Cool-white glow from the TV in front of them, warm amber lamp light, magenta wall glow behind.
AUDIO: Lina says firmly: "It's Sami." Maya says: "Obviously." Ambient room tone, soft tense silence. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Maya and Lina slowly turn their heads together toward frame right, narrowing their eyes, then both tap their phones at the same moment without looking down. Lina nods slowly.`
- **Variation 2** (CAMERA): `CAMERA: Close two-shot from slightly low angle, a slow handheld push-in toward Lina's pointing hand and face.`

#### BODY_shot06 — The room explodes after the reveal
- **Slot:** BODY 8.5–9.5 · **Use:** 1.0 s · **Mode:** Ingredients, Fast · **Ingredients:** `LINA.png`, `MAYA.png`, `OMAR.png` (no room ref; the room is described in text) · **Composite:** none
- Can be reused later in MA_A_H5 (betrayal supercut).

```
Using the provided reference images for Lina, Maya and Omar.
CAST: MAYA, a 26-year-old Black woman with deep brown skin, a short rounded natural afro, round tortoiseshell glasses, wearing a plain lavender hoodie with no logo. LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans. OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Maya, Lina and Omar sit on the sofa staring toward the camera in suspense. At 0:01 a bright orange light washes over their faces and all three explode: Lina leaps up with both arms in the air, Maya covers her mouth and falls back laughing, Omar grabs his head in disbelief. Big real laughter and screaming.
CAMERA: Medium-wide three-shot, eye level, handheld, the camera jolts slightly as they erupt.
LIGHT: Cool-white TV glow on their faces that turns strong orange at 0:01, warm amber lamp, magenta wall glow behind.
AUDIO: Three friends scream and laugh at once, overlapping, no clear words except Lina shouting: "Yes!" Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: The three lean forward in suspense; when the orange light hits, Omar and Lina high-five, and Maya points toward frame right, shouting and laughing.`
- **Variation 2** (CAMERA): `CAMERA: Slightly high angle, handheld, a quick whip of the camera from Maya across to Omar as they erupt.`

---

### 3.1 MA_A_H1 — "IT WAS YOU?!" cold open (20 s)

| t | Content | Source | Composite |
|---|---|---|---|
| 0.0–1.5 | Lina mid-leap, pointing: "IT WAS YOU?!" | **AI A_H1_shot01** (Quality, Frames) + caption | none |
| 1.5–3.0 | Sami, hands up: "Mish ana!" | **AI A_H1_shot02** (Quality, Frames) + caption "“Mish ana!” (= not me)" | none |
| 3.0–3.8 | "2 minutes earlier" rewind | **MOTION** (scrubs shot02 backwards) | — |
| 3.8–5.3 | BODY 0.0–1.5 | **AI BODY_shot01** + real join UI | overlay |
| 5.3–6.8 | BODY 1.5–3.0 | **MOTION** phone grid | — |
| 6.8–9.3 | BODY 3.0–5.5 | **AI BODY_shot02–04** + bubbles | none |
| 9.3–10.8 | BODY 5.5–7.0 | **AI BODY_shot05** | none |
| 10.8–12.3 | BODY 7.0–8.5 | **REAL UI** (OUT stamp → Mole card) | — |
| 12.3–13.3 | BODY 8.5–9.5 | **AI BODY_shot06** | none |
| 13.3–16.0 | "Everyone had PIZZA. He had **PASTA**." | **AI A_H1_shot03** plate + Remotion phone card | **YES**, see below |
| 16.0–20.0 | End card | **MOTION** (EC) | — |

AI on screen ≈ 12.2 s. Note: the script says the TV *behind* Lina shows the Mole card. Here the TV is in front of her (behind the camera), so the orange card colour shows as light on her face. If you want the card visible too, Remotion can float a small real-UI TV inset in the top third; that's an overlay, not a composite.

#### A_H1_shot01 — Lina: "IT WAS YOU?!" (hero)
- **Slot:** 0.0–1.5 · **Use:** 1.5 s, cut in at the peak of the leap so frame 1 is mid-air · **Composite:** none
- **Mode:** Frames (start frame = `A01_start.png`), **Veo 3.1 Quality**, 1 output. Run one **Ingredients test on Fast** first (`LINA.png`, `ROOM.png`) using the same text with the first line changed to `Using the provided reference images for Lina and the living room.`; if that Fast take already works, skip Quality.

```
Animate this frame.
CAST: LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: The clip starts with Lina already in mid-leap off the sofa. She lands on her feet, arm still thrust out, pointing just past the right side of the lens, and screams in shocked, delighted betrayal. Then she bends forward laughing, still pointing, and stamps one foot.
CAMERA: Medium close-up, handheld, a quick slight push-in toward her face, the camera shaking a little from the energy.
LIGHT: Strong orange glow on her face from a TV behind the camera, warm amber lamp, magenta wall glow behind her.
AUDIO: At 0:00 Lina shouts: "It was YOU?!" Then she laughs; friends off-screen gasp and laugh. Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Lina springs up from the sofa with both hands on her head, then swings one arm out to point just past the right side of the lens and screams, eyes wide, mouth open.` (Use this one with Ingredients, without a start frame.)
- **Variation 2** (CAMERA + AUDIO): `CAMERA: Close-up, slightly low angle, handheld whip-in to her face as she points.` / `AUDIO: Lina screams: "It was YOU?!" then, laughing: "No way!" Friends off-screen shriek. No music.`

#### A_H1_shot02 — Sami: "Mish ana!" (hero)
- **Slot:** 1.5–3.0 (also used backwards for the 3.0–3.8 rewind) · **Use:** 1.5 s · **Composite:** none
- **Mode:** Frames (start frame = `A02_start.png`), **Veo 3.1 Quality**, 1 output. Fast Ingredients test first (`SAMI.png`, `ROOM.png`).
- "Mish ana" is Lebanese Arabic for "not me" (said *meesh AH-na*). If Veo mispronounces it, keep the visual and record the line yourself on a phone; a 1.5 s line dubs fine.

```
Animate this frame.
CAST: SAMI, a 31-year-old Arab man with warm light-brown skin, short black hair with a low fade, a neatly trimmed short black beard, a wide dimpled grin, wearing a plain forest-green crewneck sweatshirt with no logo over a white T-shirt collar.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Sami, in the grey armchair, keeps both palms up at shoulder height and shakes his head, grinning guiltily, looking just past the left side of the lens. He protests in fake innocence, then cracks up laughing and covers his face with one hand.
CAMERA: Medium close-up, handheld, eye level, a gentle push-in.
LIGHT: Orange glow from a TV behind the camera on his face, warm amber lamp, magenta wall glow behind.
AUDIO: Sami says, laughing, in Lebanese Arabic: "Mish ana!" (pronounced "meesh AH-na"). Friends off-screen groan and laugh. Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Sami leans back in the armchair, slowly raises both hands in surrender, bites his lip to hold back a grin, then protests while pointing at himself with both thumbs.`
- **Variation 2** (AUDIO, a no-Arabic fallback): `AUDIO: Sami says, laughing: "Not me!" Friends off-screen groan. No music.` (Use this if "Mish ana" keeps coming out garbled, then dub your own "Mish ana!".)

#### A_H1_shot03 — Sami busted, group groans (PASTA plate) ⚑ COMPOSITE
- **Slot:** 13.3–16.0 · **Use:** 2.7 s · **Mode:** Ingredients, Fast · **Ingredients:** `SAMI.png`, `LINA.png`, `OMAR.png`
- **Composite plan, option A (recommended, no tracking):** Veo makes a background plate with **no phone in it**. Sami stays soft in the upper half and the **lower-centre third is left clear** (his chest and the coffee table, out of focus). Remotion floats the real `PhoneFrame` with the card flipping to **PASTA** into that empty lower third, plus the amber ring and the caption. The phone reads as an edit graphic, which matches the scripts' "highlight PASTA with an edit graphic *outside* the phone" rule.
- **Option B (only if A looks too flat; costs a Quality run):** see Variation 2. Sami holds a phone close to the lens on a **locked camera**, with the **screen black and off**, filling roughly the lower-centre 40 % of the frame. Remotion corner-pins the real card onto the black screen by keyframing 4 corners every ~6 frames. Thumbs must stay on the bezel, not on the screen.

```
Using the provided reference images for Sami, Lina and Omar.
CAST: SAMI, a 31-year-old Arab man with warm light-brown skin, short black hair with a low fade, a neatly trimmed short black beard, a wide dimpled grin, wearing a plain forest-green crewneck sweatshirt with no logo over a white T-shirt collar. LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans. OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Sami stands in the upper middle of the frame, hands empty, shrugging with a smug guilty grin straight at the camera. At the left and right edges of the frame, Lina and Omar throw their heads back and groan in mock despair; Lina throws a teal cushion lightly at Sami. Sami's upper body and face are in the top half of the frame; the lower third of the frame shows only the soft, out-of-focus coffee table and rug, with nothing moving there.
CAMERA: Medium-wide, slightly low angle from the coffee table, very shallow depth of field so the lower foreground is soft and blurry, handheld but steady.
LIGHT: Warm orange-tinted TV glow from behind the camera, warm amber lamp, magenta wall glow behind.
AUDIO: Lina and Omar groan together: "Nooo!" Sami laughs. Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phones, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Sami sits in the armchair in the upper half of the frame, taking a slow bow from his seat with one hand on his chest, grinning; Lina and Omar, at the frame edges, bury their faces in their hands and groan. The lower third shows only the blurry coffee table.`
- **Variation 2** (composite option B; run on **Quality via Frames** with a start frame made in Nano Banana of Sami holding a phone screen-to-lens with a black screen, or try it on Fast Ingredients first): replace ACTION and CAMERA with `ACTION: Sami holds a plain black smartphone close to the camera with both hands at the bottom edge, the screen facing the camera, completely black and switched off, no reflections, held very still. Behind the phone his face is soft, grinning guiltily; Lina and Omar groan at the frame edges. His thumbs rest on the bottom bezel, never on the screen.` / `CAMERA: Locked-off tripod shot, no camera movement, eye level, the phone fills the lower center of the frame.`

---

### 3.2 MA_B_H1 — "Stop passing the phone around" (20 s)

| t | Content | Source | Composite |
|---|---|---|---|
| 0.0–2.0 | Six 0.33 s whip cuts: one phone passed hand to hand, palms over the screen, last one drops it | **AI B_H1_shot01, 02, 03** (2 passes from 01, 2 from 02, a pass and the drop from 03) + `whoosh_fast` on each cut | none (screens face palms or the rug) |
| 2.0–3.5 | Maya peeks, Karim slaps the phone down: "You peeked!" | **AI B_H1_shot04** + caption "(and stop peeking, Maya)" | none |
| 3.5–4.5 | Flood wipe "Now everyone plays on their **own** phone." | **MOTION** | — |
| 4.5–14.0 | BODY-1 (same internal layout as above) | **AI BODY_shot01–06** + motion + REAL UI | as in BODY |
| 14.0–16.0 | Phones raised, cheering | **AI B_H1_shot05** (1.0 s) + **B_H1_shot06** (1.0 s) | none |
| 16.0–20.0 | End card | **MOTION** | — |

AI on screen ≈ 13 s. **Caption change:** with 5 cast members the closing caption should read **"5 players. 5 phones. 0 passing."** instead of "6 … 6 …" (the 5 phones are split across two cuts). Script line change: Karim says "You peeked!" instead of "MAYA.", per the brief.

#### B_H1_shot01 — Pass #1: Lina → Omar
- **Slot:** 0.0–0.66 (two 0.33 s cuts) · **Use:** 2 × 0.33 s · **Mode:** Ingredients, Fast · **Ingredients:** `LINA.png`, `OMAR.png`, `ROOM.png` · **Composite:** none
- The hands are identified by their sleeves (mustard knit, navy corduroy). Faces may be partly in frame.

```
Using the provided reference images for Lina, Omar and the living room.
CAST: LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans. OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Close on hands between two people on the sofa. Lina, in her mustard knit sleeve, hurriedly hands one phone across to Omar, pressing the screen flat against her palm so nobody can see it. Omar, in his navy corduroy sleeve, grabs it, immediately cups his other hand over the screen and pulls it to his chest. One single phone, passed once, simple clear motion, five fingers on every hand. The phone is a plain black smartphone in a plain black case with no logo; its screen is always covered or facing away from the camera.
CAMERA: Close-up on the hands at chest height, handheld, fast and slightly chaotic, faces partly visible at the top of the frame.
LIGHT: Warm amber lamp light, magenta wall glow, cool-white TV glow.
AUDIO: Omar says impatiently: "Pass it here—" Lina snaps: "Don't look!" Ambient room, friends giggling. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Lina holds the phone against her chest, glances around suspiciously, then thrusts it toward Omar screen-down; Omar snatches it and hunches over it, shielding it with his whole hand.`
- **Variation 2** (CAMERA): `CAMERA: Top-down close-up from above the sofa, looking down on the two pairs of hands and knees as the phone changes hands.`

#### B_H1_shot02 — Pass #2: Maya → Karim
- **Slot:** 0.66–1.33 · **Use:** 2 × 0.33 s · **Mode:** Ingredients, Fast · **Ingredients:** `MAYA.png`, `KARIM.png`, `ROOM.png` · **Composite:** none

Same prompt as B_H1_shot01 with these lines swapped:
```
Using the provided reference images for Maya, Karim and the living room.
CAST: MAYA, a 26-year-old Black woman with deep brown skin, a short rounded natural afro, round tortoiseshell glasses, wearing a plain lavender hoodie with no logo. KARIM, a 29-year-old East Asian man with straight black shoulder-length hair tied in a small low ponytail, clean-shaven, wearing a plain light-grey crewneck sweater with no logo.
ACTION: Close on hands. Maya, in her lavender hoodie sleeve, sitting on the sofa, leans down and passes one phone to Karim, in his light-grey sweater sleeve, sitting on a floor cushion in front of the sofa. She keeps her palm flat over the screen; he takes it and immediately turns the screen toward his own face, hiding it behind his other hand. One single phone, passed once, simple clear motion, five fingers on every hand. The phone is a plain black smartphone in a plain black case with no logo; its screen is always covered or facing away from the camera.
AUDIO: Maya whispers loudly: "Don't look!" Karim mutters: "I'm not!" Ambient room, laughter. No music.
```
- **Variation 1** (ACTION): `ACTION: Maya dangles the phone screen-down by its corner toward Karim, teasing; he snatches it with one quick grab and clutches it to his chest.`
- **Variation 2** (CAMERA): `CAMERA: Low angle from the rug, close on the hands as the phone travels down from the sofa to the floor cushion.`

#### B_H1_shot03 — Pass #3 and the drop: Karim → Sami fumbles it onto the rug
- **Slot:** 1.33–2.0 (one 0.33 s pass + the drop with a thud) · **Use:** ≈ 0.7 s · **Mode:** Ingredients, Fast · **Ingredients:** `KARIM.png`, `SAMI.png`, `ROOM.png` · **Composite:** none (the phone lands face-down)

```
Using the provided reference images for Karim, Sami and the living room.
CAST: KARIM, a 29-year-old East Asian man with straight black shoulder-length hair tied in a small low ponytail, clean-shaven, wearing a plain light-grey crewneck sweater with no logo. SAMI, a 31-year-old Arab man with warm light-brown skin, short black hair with a low fade, a neatly trimmed short black beard, a wide dimpled grin, wearing a plain forest-green crewneck sweatshirt with no logo over a white T-shirt collar.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Close on hands. Karim, in his light-grey sweater sleeve, tosses one phone screen-down toward Sami, in his forest-green sweatshirt sleeve. Sami fumbles it, juggles it once between his hands, and it drops onto the terracotta-and-cream rug, landing flat, screen-down, with a soft thud. Both freeze, then laugh. One single phone, simple clear motion, five fingers on every hand. The phone is a plain black smartphone in a plain black case with no logo; it lands with its screen facing the rug.
CAMERA: Close-up on hands, handheld, then the camera tilts down quickly to follow the phone onto the rug.
LIGHT: Warm amber lamp light, magenta wall glow, cool-white TV glow.
AUDIO: SFX: a soft thud of a phone landing on a rug. Sami groans: "Nooo—" Friends burst out laughing. Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Sami reaches for the phone without looking, his fingers bump it, and it slides off the sofa cushion onto the rug, screen-down. He stares at it, then at the camera, deadpan.`
- **Variation 2** (CAMERA): `CAMERA: Static low angle at rug level; the phone drops into the foreground and lands screen-down, with Sami's surprised face out of focus above.`

#### B_H1_shot04 — Maya peeks, Karim catches her: "You peeked!"
- **Slot:** 2.0–3.5 · **Use:** 1.5 s · **Mode:** Ingredients, Fast · **Ingredients:** `MAYA.png`, `KARIM.png`, `ROOM.png` · **Composite:** none (Karim's screen faces him and then the sofa cushion)

```
Using the provided reference images for Maya, Karim and the living room.
CAST: KARIM, a 29-year-old East Asian man with straight black shoulder-length hair tied in a small low ponytail, clean-shaven, wearing a plain light-grey crewneck sweater with no logo. MAYA, a 26-year-old Black woman with deep brown skin, a short rounded natural afro, round tortoiseshell glasses, wearing a plain lavender hoodie with no logo.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Karim sits on the sofa holding one phone close to his chest, screen tilted toward his own face, reading secretly. Behind him, Maya leans in over the back of the sofa, craning her neck to peek over his shoulder. Karim senses her, turns his head, and slaps the phone face-down onto the sofa cushion, glaring at her. Maya jerks back with a guilty, cheeky grin and raises her hands. The phone is a plain black smartphone in a plain black case with no logo; its screen faces Karim and then the cushion, never the camera.
CAMERA: Medium two-shot from the front, eye level, handheld, both faces visible, Karim in front and Maya behind his shoulder.
LIGHT: Cool-white TV glow on their faces, warm amber lamp, magenta wall glow behind.
AUDIO: Karim snaps: "You peeked!" Maya, laughing: "I did not!" Friends off-screen laugh. Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: Maya slowly slides along the sofa toward Karim, pretending to look at the ceiling while her eyes drift to his phone; Karim notices, presses the phone flat against his chest with both hands, and points at her accusingly.`
- **Variation 2** (CAMERA): `CAMERA: Close two-shot, slightly low angle, with a quick handheld push-in on Maya's guilty face as she gets caught.`

#### B_H1_shot05 — Phones up, cheering (Lina, Sami, Omar)
- **Slot:** 14.0–15.0 · **Use:** 1.0 s · **Mode:** Ingredients, Fast · **Ingredients:** `LINA.png`, `SAMI.png`, `OMAR.png` · **Composite:** none

```
Using the provided reference images for Lina, Sami and Omar.
CAST: LINA, a 28-year-old Lebanese woman with olive skin, long dark-brown curly hair piled in a loose high bun with curls falling around her face, thick dark eyebrows, small gold hoop earrings, wearing an oversized mustard-yellow chunky-knit sweater with no logo and light-blue jeans. OMAR, a 33-year-old Latino man with tan skin, short wavy dark-brown hair, light stubble, wearing an unbuttoned navy-blue corduroy overshirt over a plain white T-shirt. SAMI, a 31-year-old Arab man with warm light-brown skin, short black hair with a low fade, a neatly trimmed short black beard, a wide dimpled grin, wearing a plain forest-green crewneck sweatshirt with no logo over a white T-shirt collar.
SCENE: A cozy small apartment living room at night: a mid-grey fabric three-seat sofa with one mustard and one teal cushion, a matching grey armchair to the right of the sofa, a low light-wood coffee table with a plain white bowl of popcorn and plain white mugs, a terracotta-and-cream patterned rug, a warm amber floor lamp beside the sofa, warm fairy lights along a shelf of potted plants and plain ceramic vases, a soft magenta glow on the back wall from an LED strip. No posters, no books, no packaging.
ACTION: Lina, Omar and Sami sit together on the sofa. On a count, all three throw their own phones up above their heads at the same moment and cheer, grinning. Each holds their own phone high with the screen facing down toward themselves and the back of the phone toward the camera. Simple, clear motion, five fingers on every hand. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Medium-wide three-shot, eye level from the TV position, handheld, slight bounce from the energy.
LIGHT: Cool-white TV glow, warm amber lamp, magenta wall glow behind.
AUDIO: The three cheer together: "Ayyy!" Laughter. Ambient room. No music.
STYLE: Vertical 9:16 handheld smartphone video, natural slight hand shake, realistic and unpolished, like a friend filming at a house party, true-to-life skin texture, light digital noise, warm practical lighting from the lamp and fairy lights, phone wide lens.
Avoid: subtitles, captions, any on-screen text or graphics, logos, brand names, a visible TV, phone screens facing the camera, extra people in the background, children, alcohol or bottles, background music, distorted hands, extra fingers, morphing faces.
```
- **Variation 1** (ACTION): `ACTION: The three lean in shoulder to shoulder and raise their phones together like a toast, screens toward themselves, then burst out laughing.`
- **Variation 2** (CAMERA): `CAMERA: Low angle from the coffee table looking up at the raised phones and grinning faces, handheld.`

#### B_H1_shot06 — Phones up, cheering (Maya, Karim)
- **Slot:** 15.0–16.0 · **Use:** 1.0 s · **Mode:** Ingredients, Fast · **Ingredients:** `MAYA.png`, `KARIM.png`, `ROOM.png` · **Composite:** none

Same prompt as B_H1_shot05 with these lines swapped:
```
Using the provided reference images for Maya, Karim and the living room.
CAST: MAYA, a 26-year-old Black woman with deep brown skin, a short rounded natural afro, round tortoiseshell glasses, wearing a plain lavender hoodie with no logo. KARIM, a 29-year-old East Asian man with straight black shoulder-length hair tied in a small low ponytail, clean-shaven, wearing a plain light-grey crewneck sweater with no logo.
ACTION: Maya on the sofa and Karim on the floor cushion in front of her throw their own phones up above their heads at the same moment and cheer; Maya bounces on the sofa. Each holds their own phone high with the screen facing down toward themselves and the back of the phone toward the camera. Simple, clear motion, five fingers on every hand. Their phones are plain black smartphones in plain black cases with no logos; the screens always face the person holding them, away from the camera.
CAMERA: Medium two-shot, eye level from the TV position, handheld, slight bounce.
AUDIO: Maya and Karim cheer: "Yesss!" Laughter. Ambient room. No music.
```
- **Variation 1** (ACTION): `ACTION: Maya and Karim high-five with their free hands while holding their phones up, screens toward themselves.`
- **Variation 2** (CAMERA): `CAMERA: Slightly high angle, handheld, a quick push-in on their raised phones and grins.`

---

## 4. Take-selection checklist

Check each candidate take in this order and reject it at the first failure. Judge only the **seconds you'll use** (see "Use" on each shot); a glitch at 0:06 doesn't matter if you're cutting 0:01–0:02.

**People**
- [ ] **Faces match the cast stills** (Lina's curls and gold hoops, Sami's beard and dimples, Maya's tortoiseshell glasses, Omar's stubble, Karim's ponytail) and match the person in the other shots of the same ad.
- [ ] **Outfits are exact**: right colour, no logos or text on clothing, same garment in every shot (mustard knit, green sweatshirt, lavender hoodie, navy corduroy, grey sweater).
- [ ] **No extra people**: count the heads, including the background, mirrors and doorways. No children.
- [ ] **Everyone looks 25–35**, and no one looks like a stock-photo model.

**Hands and phones**
- [ ] **Five fingers per hand**, no melting or merging fingers, no hand passing *through* a phone.
- [ ] **One phone per person**, with no phone appearing or vanishing mid-shot. In B_H1_shot01–03, there is only one phone in total.
- [ ] **No phone screen faces the camera**, apart from the deliberately black screen in A_H1_shot03 option B. A glowing screen with fake UI is an automatic reject.
- [ ] Phones have **no logos** and no recognizable brand camera layout.

**Text, brand and content**
- [ ] **No garbled text anywhere**: no subtitles, signs, book spines, packaging or prints. Freeze-frame and look.
- [ ] **No TV in frame.** Light from it is fine.
- [ ] No alcohol, bottles, cans or anything that looks like money, chips or betting.

**Continuity**
- [ ] **Eyelines match the room geography**: people on the sofa look toward frame right at Sami, Sami looks toward frame left. Lina in A01 points past the *right* of the lens; Sami in A02 looks past the *left*.
- [ ] **Light matches**: warm lamp, magenta back wall, cool TV glow, turning **orange** only in A01, A02, A03 and BODY_shot06.
- [ ] The room is consistent: grey sofa, mustard and teal cushions, terracotta rug.

**Audio**
- [ ] The **right person says the right line**, lips in sync, with nothing extra said over the usable seconds.
- [ ] **No music**, no musical stings, no singing. Ambient room sound and laughter only. Music is added in the edit.
- [ ] Audio doesn't clip on screams. You can still drop Veo's audio and use only the room tone if needed.

**Technical**
- [ ] It's **9:16 portrait** (Flow defaults to landscape if you forget).
- [ ] Downloaded at **1080p**, and the file is renamed per §1.5 and placed in `/home/alex/mishana-video/public/ai/`.
- [ ] The usable window has no morphing at the cut points. Check the first and last frame of the window.
- [ ] For A_H1_shot03 option A: the **lower third stays empty and soft** for the whole 2.7 s.

---

## 5. AI-content labels and honest-use notes

**Platform labels**
- **TikTok:** when you post or build the ad, turn on the **"AI-generated content" (AIGC) label**. Realistic AI people require it. Industry reports say TikTok made disclosure mandatory for realistic AI content in ads in July 2026, with penalties up to an account ban; check the current TikTok Ads policy page before you post. Round 1 has no paid TikTok spend, but the organic mirror posts need the label too.
- **Instagram / Meta (Round 1 runs here):** Meta adds an **"AI info"** label to ads made with third-party AI tools when it detects them (Veo clips carry a **SynthID** watermark, and Meta reads C2PA credentials). For an AI-generated photorealistic person, the label appears next to "Sponsored". Accept the label; don't try to strip it or hide it. Keep Advantage+ creative enhancements off, as the scripts already say.
- Every Veo clip carries an invisible SynthID watermark. That's expected, and you shouldn't try to remove it.

**Honest use**
- These are **staged, AI-generated dramatizations** of how the game plays. Never present the people as real players, customers or reviewers. Don't write "real reactions", "our players", "real game night", "testimonial" or any first-person customer quote in captions, ad text or comments. In the US, the FTC's rule on fake reviews and testimonials (in force since October 2024) explicitly covers AI-generated testimonials. The UK ASA treats misleading AI people the same way as any other misleading claim.
- Consider a small, legible line in the post caption or on the end card: **"Dramatized · AI-generated scenes. Game screens are real."** It's honest, and it heads off "fake" comments.
- **Everything that shows the product is real:** the lobby, the QR, the phone cards, the votes, the OUT stamp and the role card all come from the real UI in Remotion. AI never draws the game, so the ad can't show a feature that doesn't exist (`SCRIPTS.md` §5).
- Don't make the AI characters look like real, identifiable people (no "make him look like [celebrity]"), and don't reuse a real friend's face as an ingredient without their written consent.
- No minors, alcohol, gambling cues, religious items or brand logos: these are already enforced in the prompts and the checklist.
- **Treat the AI cuts as a test.** `SCRIPTS.md` assumes real filmed reactions are stronger. If MA_A_H1 or MA_B_H1 wins Round 1 with AI footage, re-shoot the winner with real friends (filming guide, `SCRIPTS.md` §3, shots ★ S2-01, S2-02, S5-01, S5-02, S1-06) for scaling. That also removes the AI label from the scaled ad.
- Keep the reference stills, prompts and a note of the Flow generation dates with the ad files, as provenance in case a platform asks.

---

## Sources

- Google Flow Help, "Manage your Google Flow credits" (Pro = 1,000 credits a month; Lite 10, Fast 20, Quality 100 credits per generation; no rollover): https://support.google.com/flow/answer/16526234?hl=en
- Google Flow Help, "Learn about Flow models & supported features" (Ingredients only on Lite and Fast, 8 s only; Quality supports Text and Frames; durations 4/6/8 s): https://support.google.com/flow/answer/16352836?hl=en
- Google Flow Help, "Create videos in Google Flow" (model menu → Video → Ingredients or Frames; aspect ratio, outputs and length settings; plain-background references): https://support.google.com/flow/answer/16353334?hl=en
- Google Flow Help, "Manage projects, assets & collections" (More → Download; 270p = GIF): https://support.google.com/flow/answer/16935308?hl=en
- Google blog, "Veo 3.1 Ingredients to Video" (13 Jan 2026: character consistency, native 9:16, 1080p and 4K upscaling only in Flow, the API and Vertex; SynthID): https://blog.google/innovation-and-ai/technology/ai/veo-3-1-ingredients-to-video/
- Gemini API docs, Veo (9:16 supported; 8 s required for reference images and 1080p; up to 3 reference images; extension +7 s, up to 20 times, 720p; adult-only person generation for image inputs in EU/UK/MENA): https://ai.google.dev/gemini-api/docs/veo
- Google Cloud blog, "The ultimate prompting guide for Veo 3.1" (five-part formula, dialogue in quotes, SFX and ambient labels, describing what to exclude, Ingredients workflow, timestamp prompting): https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
- Gemini Apps Help, video generation (up to 5 reference images; aspect ratio follows the upload; download): https://support.google.com/gemini/answer/16126339
- 1080p upscale reportedly free for subscribers, 4K reportedly Ultra-only (third party; verify in the Flow UI): https://www.atlascloud.ai/blog/guides/google-flow-veo-3.1-guide
- Gemini app daily Veo limits (Pro about 3 a day; extensions count): https://ai.zenken.co.jp/en/post/gemini-video-guide/ · Gemini Omni replacing Veo as the Gemini app default (reports): https://www.mindstudio.ai/blog/what-is-gemini-omni · https://9to5google.com/?p=714396
- TikTok AI ad disclosure (July 2026 update, secondary reports): https://www.cinerads.com/blog/tiktok-ai-content-policy · https://www.stellarsearch.co.uk/insight/tiktoks-ai-ad-disclosure-rules-are-live-what-brands-running-ai-creative-need-to-do-now
- Meta, "Expanding GenAI transparency for Meta's ads products" (AI label next to "Sponsored" for photorealistic AI humans): https://about.fb.com/news/2025/02/gen-ai-transparency-metas-ads-products/ · Meta Help, how AI-generated ads are labelled: https://www.meta.com/en-gb/help/artificial-intelligence/355108217670024/
