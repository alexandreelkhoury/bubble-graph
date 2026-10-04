# growth/: marketing for Mish Ana!

Everything outside the game itself: launch videos, ads, store listing, campaign plan. Not part of the pnpm workspace, the lint or the tests of the repo; each folder has its own tooling.

| Folder | What | Run |
|---|---|---|
| `video/` | Remotion project (React, 60 fps): the product film (16:9, 9:16, 1:1) and the 9:16 ads M1–M6 with the shared "install on your TV" end card (EN/AR) | `cd growth/video && npm i && npx remotion studio`; finals: `tools/finalize.sh <comp-id>…` (motion blur, frame-pop scan, −14 LUFS) → `out/final/` (git-ignored) |
| `marketing/ads/` | Ad strategy, scripts (filmed + motion), review, Veo 3.1 prompts for AI-filmed shots | read `SCRIPTS.md` → `REVIEW.md` → `VEO-PROMPTS.md` |
| `marketing/play-store/` | Google Play listing (EN/FR/AR), graphics specs + rendered icon/banner/feature graphic, Data safety, privacy policy, release checklist | follow `RELEASE-CHECKLIST.md` |
| `marketing/tools/` | `mishana-bots.mjs` (bot players over the real protocol, for screenshots), `capture-tv.sh` (adb screenshots), graphics renderers | see the headers of each script |
| `site/` | Landing page + privacy page (static, EN/FR/AR), Cloudflare Workers static assets | `npx wrangler deploy` from `growth/site` |

Rules that apply to every creative here (learned the hard way):
- Match the real game: dark phone screen with a card in the player's colour; the Mole isn't told; the TV stamps **OUT** (no "MOLE!" stamp); claims limited to free to play, 3–12 players, no app on phones, no controllers, EN/FR/AR.
- Music: Mixkit "Take this Higher" (free for commercial use); SFX: Mixkit, aligned by measured peaks.
- Secrets never live here: the upload signing key is in `~/.mishana-keys/` (see `docs/TV.md` "Release signing").
