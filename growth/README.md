# growth/: marketing for JAMAA

**JAMAA** (جماعة) is the party-games platform for the TV; **Mish Ana!** (مش أنا!) is its game #1 and the flagship of the current creatives (see [docs/JAMAA-PLATFORM.md](../docs/JAMAA-PLATFORM.md) §1). Brand, store listing, site chrome and end cards say JAMAA; copy about the game itself keeps "Mish Ana!" (framed as "Mish Ana!, on JAMAA").

Everything outside the apps themselves: launch videos, ads, store listing, campaign plan. Not part of the pnpm workspace, the lint or the tests of the repo; each folder has its own tooling.

| Folder | What | Run |
|---|---|---|
| `video/` | Remotion project (React, 60 fps): the Mish Ana! film (compositions `MishAna-16x9`/`MishAna-9x16`/`MishAna-1x1`, ids kept; a future platform film uses `Jamaa-*`) and the 9:16 ads M1–M7 with the shared "install on your TV" end card (EN/AR) | `cd growth/video && npm i && npx remotion studio`; finals: `tools/finalize.sh <comp-id>…` (motion blur, frame-pop scan, −14 LUFS) → `out/final/` (git-ignored) |
| `marketing/ads/` | Ad strategy, scripts (filmed + motion), review, Veo 3.1 prompts for AI-filmed shots | read `SCRIPTS.md` → `REVIEW.md` → `VEO-PROMPTS.md` |
| `marketing/play-store/` | Google Play listing for the JAMAA app (EN/FR/AR/ES), graphics specs + rendered icon/banner/feature graphic, Data safety, privacy policy, release checklist | follow `RELEASE-CHECKLIST.md` |
| `marketing/tools/` | `jamaa-bots.mjs` (bot players over the real protocol, for screenshots), `capture-tv.sh` (adb screenshots), graphics renderers | see the headers of each script |
| `site/` | The JAMAA site (Worker `www`): the platform, its game line-up (Mish Ana! live; Bluff!, Most Likely, Quiz Night "coming soon"), guides and privacy page. Home in EN/FR/AR/ES (`/`, `/fr/`, `/ar/`, `/es/`); guides EN/FR/AR; privacy EN/FR/AR. Static, built by `node build.mjs` (no dependencies; it fails on broken links, invalid JSON-LD or a home key missing in any language) | `cd growth/site && node build.mjs` to check; `npx wrangler deploy` to publish |

Rules that apply to every creative here (learned the hard way):
- Search line on end cards and listings: "Search JAMAA on your TV" (the app is JAMAA).
- **Never name Jackbox or its games** in public copy, ads, listings, store keywords or "alternative to" pages (docs/BLUEPRINT.md §3 rule 7). Say what JAMAA is, not who it competes with.
- Upcoming games appear only as "coming soon" on the site; store listings describe a game only once its id is in `GAMES_ENABLED` (play-store/LISTING.md §0). Pricing copy says "JAMAA Pass" (monthly or yearly, free trial, sold on the TV only) and appears in listings only when `BILLING_ENABLED` is on.
- Match the real game: dark phone screen with a card in the player's colour; the Mole isn't told; the TV stamps **OUT** (no "MOLE!" stamp); claims limited to free to play, 3–12 players, no app on phones, no controllers, EN/FR/AR/ES.
- Music: Mixkit "Take this Higher" (free for commercial use); SFX: Mixkit, aligned by measured peaks.
- Secrets never live here: the upload signing key is in `~/.jamaa-keys/` (see `docs/TV.md` "Release signing").
