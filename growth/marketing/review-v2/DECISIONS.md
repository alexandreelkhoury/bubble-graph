# v2 decisions (approved by the owner, 2026-10-04)

Source reviews (read them for exact values): `impeccable.md`, `uiux.md`, `frontend.md`, `polish.md` in this folder.

## Accepted
1. **Palette B "Evolved Current"** for all marketing (videos + landing): background `#2B1650` → `#1D1036`, top purple glow, warm amber rim, magenta bounce, light grain; surface `#3A2266`; primary `#FF4F9A`; accent `#FFC94D`; ink `#1A0B2E`; text cream `#FFF7EC`; lifted player colours (coral `#FF3355`, azure `#5A9BFF`, jade `#2BC49F`, grape `#9A6BFF`, tangerine `#FF8A33`, lemon `#FFF04D`). Target average luma 45–60 (was 21–37). Implemented in `growth/video/src/brand.ts` + `AdBg`.
2. **Pre-launch end card** (default) for every ad: "Play free in your browser" + typeable URL, held still ≥ 2 s; a `live` variant (Google Play) for after launch. End card length 5.9 s, CTA visible ≥ 3 s, CTA block centred around y 700–1200 (clear of TikTok/Reels UI). No fake QR, no tilted phone, no "Done. Game on." flash.
3. **Reading rule**: every caption ≥ 1.2 s on screen (key lines ≥ 1.8 s), words appear within 150 ms, ≤ 2 caption lines; ads become 18–20 s without VO, 22–25 s with VO. Use `holdFrames(words, key)` from `ads/common.tsx`.
4. **Captions v2**: the *hot* word sits in a tilted colour box (amber or magenta, ink text); two sizes only (96 / 84 px); dark soft shadow instead of an invisible stroke. Component `AdCaption` (unchanged API).
5. **Bigger hero elements** (+30 %), use the bottom third (content down to y ≈ 1600), clue bubbles ≥ 52 px, role line ≥ 76 px, never inside a scaled-down TV.
6. **Brand + TV in the first 1.5 s**: a persistent chip "Mish Ana! · party game for your TV" (added automatically by `Ads.tsx`), and a TV on screen within the first 3 s.
7. **Bright first frame** (thumbnail): the hook on a full-bleed colour or clearly lit frame; **one** full-screen colour flash per ad, at the twist, held ≤ 10 frames.
8. **The Mole's colour must not give the twist away**: Sami is no longer tangerine/orange (amber is the "Mole" highlight colour); in the ads Sami is lilac `#C9BFFF` (hexagon; aqua was too close to Joe's jade).
9. **Springs**: `TEXT` `{26,220,1}` for all text (≈0 % overshoot), `POP` `{17,240,0.8}`, `SNAPPY` `{20,200,1}`. Mask exits travel softer. No fade-ins.
10. **Sound**: music 0.5 (−6 dB), ≤ 1 SFX per beat, pops at 0.45 with alternating pitch, music fades out over 54 frames at the end, limiter so true peak ≤ −1 dBTP. **VO-ready**: `AdSound` takes `vo` lines; music ducks −9 dB under VO (6-frame attack, 18-frame release, 4 frames early); pops under VO −6 dB; captions match VO word for word.
11. **Voiceover** (when the owner's TTS engine is set up): M1, M4, M5, the explainer, the film. Scripts in `uiux.md`. M6: Lebanese voice or no VO.
12. **Replace M2 by "How it works in 15 s"** (explainer, VO-first).
13. **M3 made fair**: tell the viewer the majority word (PIZZA) before the clues, a clearer Mole clue, 3-2-1 lasts 2.4 s with "Pause it. Comment your guess."
14. **New M7 "Team party / office"** angle (every meeting room has a screen → perfect for the browser version).
15. **M6 Arabic**: Arabic wordmark on the end card, fix "و Google TV" bidi, pace rebuilt, no VO.
16. **Film pre-launch**: no "Google TV" in the opening caption (contradicts the browser CTA); bright opening.
17. **Tech**: BT.709 colour tags, motion blur 12 samples / 120° shutter, Cairo ExtraBold (800) really loaded.
18. **Landing**: palette B, scroll-reveal never leaves blank sections in in-app browsers, hero video starts on the PIZZA/PASTA moment, mobile CTA split (share / email me the link).
19. **Play feature graphic** shows the TV + 2 phones (PIZZA / PASTA), magenta line.

## Deferred
- Palette B in the TV app itself (after the marketing test; needs the colour-blind check and a device test).
- Real-people cold opens (Veo), testimonial and double-date angles, the 8 pm email reminder.

## Rejected
- Direction A "Brighter Party" (cream background): looks like a different product than the app.
