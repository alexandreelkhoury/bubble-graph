# Design review v3 — decision table (pending owner approval)

Sources: 8 reviews in `reviews/` (product-{impeccable,uiux,frontend,polish}.md, marketing-{impeccable,uiux,frontend,polish}.md), 211 proposals. Screenshot pack: `shots/`. Mockups: `mockups/`.
Legend: IMP = Impeccable, UX = UI/UX Pro Max, FE = Frontend Design, POL = Make Interfaces Feel Better. "p-" = product review, "m-" = marketing review (row numbers refer to each report's table).

## A. Product — P1 bugs (phone + browser TV + native TV)
| # | Proposed by | Change | Decision | Reason |
|---|---|---|---|---|
| A1 | POL p#2 | Eliminated player's phone waits for the TV's OUT stamp (no buzz/"You're out" 2.4 s early) | ACCEPT | Spoils the round's hero moment |
| A2 | POL p#1 | iPhone safe areas applied once (body sides, top bar top, action bar/sheets bottom) | ACCEPT | Every screen scrolls ~93 px on notched iPhones |
| A3 | UX p#1-2 + FE p#1 | Tie overlay above "Skip turn", explanation readable, 4 s, then "Re-vote: A or B" stays | MERGE → ACCEPT (client) | Text cut off; server "start timer after overlay" DEFERRED (server is frozen until payments) |
| A4 | IMP p#1-3 + FE p#3 | Disabled primary buttons: neutral surface + muted text, no 40 % opacity (phone, web TV, native) | MERGE → ACCEPT | 1.35–1.82:1 contrast on the first focused button (Start) |
| A5 | IMP p#4 + FE p#2 | Ship Cairo 700 on the web (latin + arabic subsets) | MERGE → ACCEPT | Every "bold" renders Black; web TV ≠ native |
| A6 | IMP p#5 | Arabic toasts on TV-05 one line, 36 dp, never over the clue rule | ACCEPT | Overlap in AR |
| A7 | UX p#3 | Word card line, identical for every role: "Most of you have this word. Not everyone. Maybe not you." (+FR/AR) | ACCEPT | Teaches the twist without leaking roles |
| A8 | UX p#4 | Blank's card uses the player's colour (not near-white) | ACCEPT | White glow outs the Blank across the sofa |
| A9 | UX p#5 | Results say "Ben was the Mole · Eli was the Blank" (TV + phone) | ACCEPT | The payoff is currently hidden below the fold |
| A10 | UX p#6 | Browser TV: Backspace/Esc in the lobby asks first ("Keep room" default) | ACCEPT | One key kills the room for everyone |
| A11 | UX p#7 | Phone lobby: 4-step "How to play" card in the empty space (copy from DESIGN TV-15) | ACCEPT | No rules anywhere today |

## B. Product — P2 quality
| # | Proposed by | Change | Decision | Reason |
|---|---|---|---|---|
| B1 | UX p#14,11,12,13,19,21,18,17 | Copy: "Ben, your clue!"; phone vote asks "Who's not one of us?"; re-vote says what a 2nd tie does; tied player told "You're in the tie"; "The Mole & the Blank win!" (no "infiltrators"); "Back to game" + "Timers keep running"; "0/4 voted" when phones sleep; web TV says Enter/click not "OK" | ACCEPT | Clearer for first-timers. AR copy needs a native check |
| B2 | UX p#8,9,10 | Blank guess: "Get it right and you win"; TV "type it, then say it out loud!"; host button "Count it: Blank wins" | ACCEPT | The override only works if the room hears the guess |
| B3 | UX p#16,22 | Browser TV first-run tip "F = full screen · arrows + Enter or click" + F key; phone Home "No code? Host on a TV or laptop" | ACCEPT | Browser is the live product |
| B4 | UX p#20 + FE p#14 | TV lobby: score badge after Play again; newest player keeps a ring until next join | MERGE → ACCEPT | Replay hook + "Karim is with us!" points somewhere |
| B5 | FE p#12,13 + UX p#15 | TV lobby: settings summary → chips, hidden until 3 players; QR + code + URL in one "ticket" card; wordmark 196 dp | MERGE → ACCEPT | Grey jargon line is the longest text in the lobby (see mockups/tv-lobby-b.png) |
| B6 | FE p#7,8,9 | OUT moment: calm "Next in 2" (no red), avatar beside "Ben is out!", role-colour wash at full strength | ACCEPT | Peak moment is underpowered |
| B7 | FE p#10,11 + POL p#9 | Scoreboard: no stacked glows; history strip moves to the pause menu; 5 rows visible | MERGE → ACCEPT | Mole row hidden, brown smear |
| B8 | FE p#6 | Web TV timer number attached to its ring (−36 dp, like native) | ACCEPT | Parity + stray number |
| B9 | IMP p#6,7 | Winner title solid team colour on web + native (no gradient text) | ACCEPT | Parity + high-contrast mode |
| B10 | IMP p#8,9 + POL p#8 | Web TV toasts/settings category: dot / pill marker instead of 4 px side stripes | MERGE → ACCEPT (IMP's dot version) | Stripes bend into crescents |
| B11 | IMP p#10 + FE p#5 | 24 % cream ring on avatars that need it (grape, plum; all if palette B) | MERGE → ACCEPT | <3:1 on elevated rows |
| B12 | IMP p#11 | Pause button 4.87:1 | ACCEPT | Barely visible |
| B13 | IMP p#12,13 | Reduced motion covers dialogs, toasts, sheets, verdict tile, wordmark | ACCEPT | a11y |
| B14 | POL p#3,4,5,6,7,10 | Font smoothing; focused rows scale 1.02 (pills 1.04, tiles 1.06); nested radii 20/21 px; `text-wrap: pretty/balance`; settings list fades instead of clipping | ACCEPT | Polish |
| B15 | POL p#11,12 | Web lobby animates only new tiles; dialogs 200 ms fade+0.96 (native too) | ACCEPT | Noise / pop from 20 % scale |
| B16 | POL p#13,14,15 | Stamp sound +150 ms; tick and digit on one clock; haptics on vote select / Done / Ready | ACCEPT | Sync + feel |
| B17 | POL p#16 | Native: clue hero slides from the correct side in Arabic | ACCEPT | RTL bug |
| B18 | POL p3 items | Avatar glyph optical offsets, room-code spacing in AR, 1 px outline on the dark app mark, press scale 0.96 | ACCEPT | Polish (P3) |
| B19 | FE p#4 vs IMP/UX | **Palette B in the app** (lit stage `#2B1650→#1D1036`, re-derived surfaces `#3A2266/#4A2E7A/#5A3A8E`, text2 `#E2D6F5`, muted `#B8A8D6`, primary `#FF4F9A` + `#FF7AB3` for pink text, accent `#FFC94D`; **keep the app's player colours**) | **YOUR CALL** — recommend ACCEPT after A+B, browser TV + phone first, then native after a test on your TCL | FE re-derived the tokens and passed contrast; IMP/UX found no blocker once surfaces are re-derived; player colours stay (colour-blind safety) |
| B20 | UX p#2 (server part) | Start the clue timer after the tie overlay | DEFER | Server change; production server frozen until payments ship |

## C. Landing page
| # | Proposed by | Change | Decision | Reason |
|---|---|---|---|---|
| C1 | IMP m#1 | Fix literal `{{BROWSER_URL}}` links in 5 guides + JSON-LD + llms-full.txt | ACCEPT | Broken links |
| C2 | IMP m#2 | Contact email + owner name | BLOCKED | Needs your email + name |
| C3 | IMP m#3 + POL m#2 | 404 button readable (`.legal a:not(.btn)`), trilingual 404 with "Play free" | MERGE → ACCEPT | 2.89:1 |
| C4 | POL m#1 + UX m#8 | Arabic "و Google TV" spacing (~15 strings), AR footer bidi, translated aria labels | MERGE → ACCEPT | Reads "TVg" |
| C5 | POL m#3 | AR reel: phone no longer covers the lobby; TV mock mirrors | ACCEPT | RTL bug |
| C6 | IMP m#4 + FE m#1 + POL m#14 + UX m#10 | FR/AR hero: caption-free film loop + translated HTML caption (one video), AR player names | MERGE → ACCEPT | English captions on FR/AR pages |
| C7 | POL m#4 | Re-encode hero video with correct colour tags | ACCEPT | Colours jump at poster→video |
| C8 | UX m#1,2,3,7,8,9 | Mobile hero: CTA right after the video, 2-line sub, CTA "Play on the big screen", drop "in testing" line, chips + "No sign-up", AR headline 2 lines | MERGE → ACCEPT | FR/AR CTA below the TikTok fold |
| C9 | UX m#4,6,15,17 | Hand-off sheet: our sheet first, big typeable URL, WhatsApp-to-myself first, then copy/email; "Then scan the QR"; same action in the "Play in your browser" section and sticky bar ("Send to TV") | MERGE → ACCEPT | The key step for ad visitors |
| C10 | UX m#11,12,13,14,16 | Shorter page (~5,600 px): "What you need tonight" strip replaces the duplicate section; works list not button-looking; FAQ leads with "Do we need a smart TV?"; desktop hint adds Chrome Cast; About text fixed | MERGE → ACCEPT | Duplicate + contradiction |
| C11 | IMP m#6 | Pre-launch SEO title/description say browser, not "for Android TV" | ACCEPT | Promise you can't keep yet |
| C12 | IMP m#10,11 | Sami lilac on landing; dark glyphs on bright avatars | ACCEPT | Consistency with ads; 2.08:1 |
| C13 | FE m#3,4,5 + IMP m#21 | Desktop hero 0.95/1.05 grid, H1 82 px, H2 48 px; still frame shows PIZZA + PASTA phones; magenta hot-word box like the ads | MERGE → ACCEPT | Generic 50/50 template (see mockups/mkt-hero-*.png) |
| C14 | FE m#10-14 | Try-it label plate + composition, coloured feature cards, lit "how" band, final CTA lineup | ACCEPT (P2/P3) | Rhythm |
| C15 | POL m#5,6,7,8,9,10,11,12,13 | Focus ring keeps shapes; reveal plays (safety only if observer silent) + stagger; hero glow seam; SVG arrows/ticks; sticky bar radius 32; sheet safe area; fallback font metrics + Roboto; privacy font preload | ACCEPT | Polish |
| C16 | IMP m#15 | Privacy covers /tv; Arabic version | ACCEPT (AR draft, native check) | The live product isn't covered |
| C17 | IMP m#9 + POL m#15 | OG share images per language, palette B, caption not cut | MERGE → ACCEPT | |
| C18 | UX m#5 | Short domain (mishana.app) everywhere | DEFER | You decided workers.dev for now; ~$12/yr when you buy it |

## D. Play Store
| # | Proposed by | Change | Decision | Reason |
|---|---|---|---|---|
| D1 | FE m#2 + IMP m#7,8 + UX m#21,22 + POL m#16 + FE m#17,18 | Feature graphic rebuilt per DECISIONS #19 (TV + PIZZA/PASTA phones, magenta "lying.", palette B, clear of the play button), EN/FR/AR | MERGE → ACCEPT | See mockups/mkt-feature-graphic-compare.png |
| D2 | FE m#8 | New icon: lighter violet tile, bigger bubble, thicker "!" — Play icon AND the app's launcher icon | ACCEPT | Disappears on dark launchers |
| D3 | FE m#16 | TV banner without the dark tile, palette B, FR/AR | ACCEPT | Black square on the Google TV row |
| D4 | IMP m#5 | Unaltered TV screenshots from the real app | ACCEPT — BLOCKED | Needs your TV's wireless-debugging IP:port |
| D5 | UX m#20 + IMP m#16,17,18 | One 8-screenshot plan with captions (EN/FR/AR), frame at 1600×900, 68 px headline | MERGE → ACCEPT | Two contradictory plans today |
| D6 | UX m#18,19 | Listing: new first 3 lines (EN/FR/AR) + "On your phone? Tap the arrow next to Install and choose your TV." | ACCEPT | |
| D7 | IMP m#20 | 16:9 "live" promo video for the listing | DEFER | Render at launch with the other live versions |

## E. Videos (end cards)
| # | Proposed by | Change | Decision | Reason |
|---|---|---|---|---|
| E1 | IMP m#19 + UX m#24 + POL m#18 | Remove the 2nd URL inside the end-card TV | MERGE → ACCEPT | Opens the phone join page |
| E2 | POL m#17 | Arabic end card: play triangle not mirrored | ACCEPT | DESIGN §10 |
| E3 | UX m#23 | CTA "Play free on your TV" + "Open on a laptop or TV browser:" above the URL | ACCEPT | Phone viewers otherwise open it on the phone |
| E4 | FE m#keep | Shrink the fake room code on the end card | ACCEPT | Second-biggest element |
| E5 | — | Re-render 7 ads + 3 film cuts (~3 h, unattended) | ACCEPT | Bundle with VO when the voice engine arrives if it's this week |

## Rejected
| Proposed by | Change | Reason |
|---|---|---|
| POL p#14 (variant) | `TICK_MS = 100` on /tv | Doubles re-renders; use the shared-clock variant instead (kept in B16) |
| UX m#5 (now) | Change all URLs before buying a domain | Would ship a URL that doesn't exist |
| FE p#4 (player colours) | Use the marketing "lifted" player colours in the app | Colour-blind separation drops (10.2 vs 17.7) — app keeps its own |
| IMP m (optional) | Write PRODUCT.md via `impeccable init` | DESIGN.md already covers it |

## Delivery note
Product fixes land on `main`. Production runs the `hotfix/prod-hide-billing` branch, so players only see web fixes once they're cherry-picked there and deployed (web-client only, safe) — needs the owner's go. Native TV fixes ship with the next .aab (before the closed test).
