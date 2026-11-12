# Pixi Bluff reveal: a PixiJS spike for the TV

A decision prototype, not product code. It plays the **Bluff! REVEAL** moment ([GAME-BLUFF §12.2](../../docs/GAME-BLUFF.md)) in PixiJS 8 with fake local data (no server), drawn with the hand-made art of the [art board](../../docs/art-board/README.md). The question it answers: **should JAMAA's TV display move to PixiJS** (a WebView or a PixiJS wrapper app) instead of the current Compose for TV screens?

The scene is 960 × 540 logical, rendered at up to 1920 × 1080, and driven by the remote only:

| Remote | Keyboard | Does |
|---|---|---|
| OK | Enter, Space, → | next step; while a step is playing, jump to its end |
| Back | Escape, Backspace | restart from the beginning (and log the run) |
| ↑ | ArrowUp | show / hide the FPS overlay (shown by default) |
| ↓ | ArrowDown | cycle the backing resolution 2 → 1.5 → 1 → 0.75 (restarts) |
| ← | ArrowLeft | boil on / off (the "lite motion" TV setting) |

What plays: the living room at 11 p.m. (dimmed under the UI), 6 players with their score pills, the prompt and 7 answer cards dealt in. Then, per picked lie: the card slides into a spotlight, each fooled voter hops onto it, a drumroll, the **LIE!** stamp thumps, the voters react (shock, sad, "!" and sweat bursts), the liar pops out from behind the card **busted** (the double-line "liar caught" drawing for 1 s, screen shake, "BUSTED!"), then turns smug or laughing, and coins fly into the liar's pill, which counts up. The truth: camera push-in, the card turns gold, a light sweep, the **TRUTH** stamp, confetti from the card corners, the finders jump on and cheer, the others sigh under rain clouds, the explanation slides in, +100 coins. Then "Nobody bought it…" (the unpicked lies fan out with their authors' sad faces and fall), and the finale (confetti rain, everyone hops, "Ziad leads!") with the run's performance summary on screen.

## Run it on the laptop

```sh
pnpm install
pnpm --filter @jamaa/pixi-bluff-proto dev --host
# Vite prints:  Local:   http://localhost:5174/
#               Network: http://192.168.1.20:5174/   ← the URL for the TV
```

Open the Local URL in Chrome. The port is fixed at **5174** (the debug TV app's default). URL parameters:

| Param | Default | Meaning |
|---|---|---|
| `renderer` | `webgl` | `webgl`, `webgpu` or `canvas` (Canvas 2D). The overlay shows what actually started (`webgl2`, `webgl1`, …) |
| `res` | screen / 960, max 2 | backing scale: 2 = 1920 × 1080, 1 = 960 × 540 upscaled by CSS |
| `overlay` | `1` | `0` hides the FPS overlay at start |
| `boil` | `1` | `0` = lite motion (no line boil) |
| `auto` | `0` | `1` = auto-advance, replay 4 s after the finale (a benchmark loop) |
| `hold` | `1600` | auto-advance pause between steps, ms |
| `capture` | `0` | `1` = no rAF, `window.__advance(ms)` drives frames (video capture) |

## Run it on the TV (the real test)

The debug build of the TV app contains **JAMAA Proto** (no launcher tile: Google TV shows one tile per package, and a second one hid the real app), started with adb: a fullscreen, hardware-accelerated Android WebView (JavaScript on, D-pad forwarded to the page). This is the same rendering path a PixiJS wrapper app would use, so its numbers are the ones that count. It exists only in `tv-app/app/src/debug/` (manifest, `proto/ProtoActivity.kt`, banner): release builds never contain it.

1. Laptop and TV on the same Wi-Fi. Start the prototype: `pnpm --filter @jamaa/pixi-bluff-proto dev --host`, note the **Network** URL. (macOS firewall: allow incoming connections for `node`, or open TCP 5174.)
2. Install the debug app (from `tv-app/`, with your laptop's IP, as in [docs/TV.md](../../docs/TV.md)):
   ```sh
   ./gradlew :app:installDebug -PserverUrl=http://<laptop-ip>:8787
   ```
3. From the laptop: `adb shell am start -n app.jamaa.tv/.proto.ProtoActivity --es url http://<laptop-ip>:5174/` (without `--es url` it opens its start screen). The start screen shows a URL field prefilled with `http://<server host>:5174/`: the host of the debug server URL (`-PserverUrl`, or the override in the main app's Debug settings), and after the first run the last URL you opened.
   - URL right: press OK on **Open (WebGL, default)**.
   - URL wrong: move ↑ to the field, OK opens the TV keyboard, type it, press the keyboard's Go/Enter.
   - The other buttons open the same URL with `res=1`, `boil=0`, `renderer=canvas`, `renderer=webgpu` or the `auto=1` benchmark loop.
   - Or skip the screen from the laptop: `adb shell am start -n app.jamaa.tv/.proto.ProtoActivity --es url http://<laptop-ip>:5174/`
4. In the prototype: OK = next, Back = restart, **hold Back** = back to the start screen, Back on the start screen = exit.
5. Read the numbers: on screen (overlay + the summary at the end), or on the laptop with `adb logcat -s JamaaProto` (each run logs one `[pixi-bluff] {…}` JSON line: renderer, GPU, resolution, load time, average/1%-low FPS, frame-time percentiles, stutters, JS ms per frame, JS heap). `chrome://inspect` on the laptop also attaches to the TV's WebView (debugging is enabled in this activity).

### Without the laptop: Cloudflare Pages

```sh
pnpm --filter @jamaa/pixi-bluff-proto build          # → prototypes/pixi-bluff/dist (relative paths, works from any folder)
cd prototypes/pixi-bluff
npx wrangler@4.147.0 pages deploy dist --project-name jamaa-pixi-proto   # first time: creates the project, asks to log in
```

Type the printed `https://….pages.dev/` URL into the JAMAA Proto start screen once; it is remembered. (`npx vite preview --host` serves the same `dist` on the LAN.)

## Go / no-go checklist (for the owner, on the TCL Google TV)

Play the reveal 3 times with OK (default WebGL, `res` default), then once with the **Benchmark loop**, and note:

| # | Check | Go if |
|---|---|---|
| 1 | **Average FPS** (summary line 1) | **≥ 50**, and the overlay graph mostly under the green 16.7 ms line |
| 2 | **No visible stutter** while watching: the card slides, hops, coin arcs, camera push-in and confetti look smooth (characters stepping at 8–12 fps is the intended drawn style; whole-screen hitches are not) | nothing you'd notice at a party |
| 3 | **1 % low** (summary line 1) and `stutters` (line 3) | 1 % low ≥ 30, stutters ≤ 5 per run |
| 4 | **Load time** (summary line 1: first frame since the page started, over Wi-Fi from the laptop) | ≤ 3 s (a packaged app would load from disk: faster) |
| 5 | **Remote responsiveness**: OK mid-animation jumps to the end at once; Back restarts at once; no lost or double presses | instant |
| 6 | **Memory**: JS heap (line 3) after 3 restarts | stable, not growing run over run |
| 7 | **Does it look better than today?** Compare with the current Bluff reveal in the JAMAA app | clearly yes |

If 1–3 fail, retry with `res=1` (half resolution) and `boil=0`: if those pass, the TV is fill-rate bound and a PixiJS TV would ship at a lower backing resolution on low-end sets. If `renderer=canvas` beats WebGL on this TV, note it (it would mean the WebView's GPU path is poor).

## How it's built (and the TV performance rules applied)

- **Art**: `bake/art/*.js` are trimmed copies of the art-board sources (the hand layer on the canonical geometry of `shared/src/characters`). `pnpm --filter @jamaa/pixi-bluff-proto bake` renders them in Chromium into **texture atlases** in `public/atlas/` (committed; `vite build` needs no browser): 6 characters × 7 expressions × 3 boil tracings + 2 "busted" double-line frames (2 pages, 6 px per body unit), one fx page (bursts × 3 tracings, coins × 3, white cut-paper confetti tinted at runtime, light shapes) and the room plate (1920 × 1080 WebP). The runtime never parses SVG.
- **Motion**: the shared easings and spring of `@jamaa/shared/motion` (the same sampler the web and the native TV use) in a small timeline (`src/timeline.ts`) whose `finish()` is the OK-completes-the-animation rule. Boil on the 8 fps drawing clock, squash/stretch, laugh shakes and confetti rotation on 12 fps steps; travel (card moves, hop arcs, coins, camera) on the smooth UI clock.
- **Rendering**: antialias off, resolution capped at 2 (1080p), `autoDensity` off with CSS letterboxing, all text as **bitmap fonts** (Cairo 900/700 baked at startup, one glyph page each), Graphics + sprites + bitmap text share one batcher (the overlay counts WebGL draw calls per frame), confetti in a **ParticleContainer** (one draw for up to 600 pieces), no filters, no masks, no blend-mode switches. Events are off (`eventMode: "none"`): input is keys only.

Files: `src/main.ts` (boot, params, keys, stats), `src/scene.ts` (the choreography), `src/actor.ts` (characters), `src/fx.ts` (bursts, confetti, shake), `src/perf.ts` (stats + overlay), `src/draw.ts` (hand-drawn panels, stamps, lettering), `src/assets.ts`, `src/data.ts` (the fake round).

## Scripts

| Command | Does |
|---|---|
| `pnpm --filter @jamaa/pixi-bluff-proto dev --host` | dev server on :5174 (LAN) |
| `pnpm --filter @jamaa/pixi-bluff-proto build` | static `dist/` + size report (raw + gzip) |
| `pnpm --filter @jamaa/pixi-bluff-proto typecheck` | `tsc` |
| `pnpm --filter @jamaa/pixi-bluff-proto bake` | re-render the atlases (needs a local Chromium: `PLAYWRIGHT_BROWSERS_PATH`) |
| `node scripts/capture.mjs <url> out.mp4` | deterministic 1280 × 720 / 30 fps video of the whole reveal (system ffmpeg) |
| `node scripts/bench.mjs <url> --renderers webgl,canvas` | one real-time run per renderer in headless Chromium, prints the report |

## Limits (what this does not prove)

- Desktop/CI numbers are not TV numbers. Measured in the build container (headless Chromium, 4 CPU cores, **no GPU**): WebGL runs on SwiftShader (software rasteriser) at well under 1 fps at 1080p, which says nothing about a real GPU; the JS side of a WebGL frame (scene update + render submission) is **~1.6–2.1 ms**. The Canvas 2D renderer (CPU raster) did 24.7 fps average at 1920 × 1080 (1 % low 4, 8.6 ms JS/frame) and 33 fps at 960 × 540. First frame ≈ 0.7–1.5 s from a local server (atlas 0.3–0.4 s, bitmap fonts 0.07–0.1 s); JS heap 9.5–18 MB. So the TV result will be decided by its GPU fill rate and its WebView, which only the TV run can show.
- Size: 189 KB gzip of JS (Pixi 8 + the scene; the WebGPU/Canvas chunks load only when chosen) + 750 KB of WebP atlases and fonts ≈ 0.94 MB per cold load.
- No sound, no network, no phones, no localisation/RTL, one fixed round (6 players, 3 picked options). The "quick hits" strip, likes tally, split credit and house lies are not in it.
- The character art is the art-board prototype (procedural "hand"), not the illustrator's final drawings; lettering is Cairo 900 standing in for drawn lettering.
- The JAMAA Proto WebView loads over plain HTTP from the LAN (debug network config). A shipping PixiJS TV app would bundle the page in the APK (faster load) and need its own D-pad focus/back handling, accessibility and lifecycle work.
