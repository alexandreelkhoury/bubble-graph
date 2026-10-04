# Mish Ana! launch plan (browser version first)

Prepared 2026-10-04. Companion files: `X-THREAD.md`, `REDDIT-POSTS.md`, `LISTINGS.md`.

**The one thing we're launching:** the free browser version, `https://play.mishana.workers.dev/tv` (laptop or TV browser as the shared screen, phones scan the QR). The Android TV / Google TV app is "in Google Play testing, not public yet" in every post. No fake urgency, no numbers we don't have.

**Goal of these 10 days:** real groups playing real rounds, bug reports, and a handful of durable public pages (Reddit threads, a YouTube video, an AlternativeTo entry) that describe the game the same way. Not "go viral".

---

## 0. Fix before Day 1 (blockers found while preparing this)

| # | Problem | Where | Fix |
|---|---|---|---|
| 1 | The film's last ~1.4 s shows a button **"Available on Google TV"**. Not true yet | `growth/video/src/Film.tsx:571` → `MishAna-16x9/9x16/1x1.mp4` | Change the text to "Play free in your browser" and re-render, or trim at 22.3 s (command in X-THREAD.md) |
| 2 | The six ads `MA-*.mp4` end on an "Install on TV" card with a Google Play badge and "Or search 'Mish Ana' on your TV" | `growth/video/src/ads/EndCard.tsx` | Don't post them until the Play listing is public |
| 3 | Every landing screenshot shows "Get it on Google TV"; `mobile-en-deal-mole.png` shows "You're the Mole!" (beginner-mode card), which contradicts "the Mole isn't told" | `/home/alex/mishana-site-screens/` | Use the `demo-*` phone cards and your own `/tv` screenshots instead |
| 4 | The landing site isn't deployed (`/home/alex/mishana-site/wrangler.jsonc`: "NOT deployed yet") and its main button is "Get it on Google TV" | `mishana-site` | Before deploying: make "Try it now in your browser" the primary button and label the Google TV one "Coming soon". A real homepage is what Google and AI assistants can describe; the `/tv` app page has no readable text for them |
| 5 | `/tv` sends `frame-ancestors 'none'`, so it can't be embedded on itch.io | server CSP | Only matters for itch (LISTINGS.md §4). Optional |
| 6 | The phone page is **~53 KB gzipped** (52.55 KB on today's build), not 49 KB | `web-client/scripts/check-size.mjs` | All copy here says "about 53 KB". Keep it that way unless you shrink it |
| 7 | Decide your one-line honest answer to "did you use AI?" | REDDIT-POSTS.md FAQ | Several subs restrict AI content (see §2). Answer before you post, not in the comments |

Also have ready: a 20–30 s screen recording of a real round (laptop as TV + 2–3 phones in frame). Real footage beats the motion film in every community below.

---

## 1. Ranked channels

Ranked by fit × reach × chance of not being removed, for **a free browser game by a solo dev, before the Play release**. Sizes are approximate. "Engage first" means real comments that help people, not "nice post".

| Rank | Channel | Self-promo allowed? | Key rules | Why this rank |
|---|---|---|---|---|
| **1** | **r/SideProject** (~850k) | Yes, it's what the sub is for | No written promo rule found; posting may be limited to approved/established accounts; feedback framing works | Biggest audience that welcomes "I built this". Dev story angle |
| **2** | **r/lebanon** (~167k) | With mod approval (Rule 7: advertising needs approval) | Post must relate to Lebanon + flair (Rule 1); `[OC]` for own work (Rule 6); EN/AR/FR accepted | Unique fit no other game has: Lebanese packs, Arabic RTL, Lebanese dev. Likely your first real groups |
| **3** | **Show HN** | Yes, made for this | Must be easy to try without sign-up; "Show HN:" title, no "!"; don't ask for votes; new accounts restricted since March 2026 | Technical audience that will appreciate Durable Objects + projection model; no sign-up needed fits perfectly. Risk: account must have history |
| **4** | **r/AndroidTV** (~199k) | Yes, under the 10:1 ratio (Rule 8); mods can grant exceptions | Flair required (Rule 1); Google TV *device* posts go to r/GoogleTV (Rule 3); no low-effort (Rule 5) | The exact audience for the TV app; good for collecting testers |
| **5** | **r/IndieDev** (~450k) | Yes (no rule against it found) | Capsule comparison posts only on Wednesdays; posting may be limited | Dev-to-dev design story; different angle from r/SideProject |
| 6 | YouTube (film + Short) | Your own channel | No chapters on a 24 s film; description first lines matter | Not a community, but the most-cited site in AI answers after Reddit; needed for PH and Reddit embeds |
| 7 | X #buildinpublic | Your own account | Link posts get much lower median engagement in Buffer's data even though X says links aren't deboosted: put video in the post, link in the last post / a reply | Home base everything links back to; low reach without followers |
| 8 | r/indiegames (~338k) | Yes, with gameplay media | Max 2 posts/week; no dev-focused posts, no "promo disguised as feedback", **no generative-AI content** | Player audience. Skip if the AI rule applies to you |
| 9 | r/playmygame (~143k) | Yes, free games only | Link first, your role, truthful AI/art claims; 1 post/month; no clones/reskins | Feedback-oriented players |
| 10 | r/partygames (~1.6k, low activity) | Devs do post their games | No custom rules seen | Small but exactly on topic; good first test of the post |
| 11 | AlternativeTo | Yes, for released apps | Closed-beta apps rejected; free queue takes months, $5 priority 1–2 business days | Long-tail Google traffic ("Jackbox alternatives"); slow |
| 12 | Indie Hackers | Story posts yes, bare promo no | Posts may be reviewed; groups have own rules | Good for the "week one, honest numbers" write-up |
| 13 | r/GoogleTV (~17k, growing) | Unverified rules | Has an app-recommendation flair | Save for the **tester call** when closed testing opens |
| 14 | Product Hunt | Yes | Beta/waitlist launches aren't featured; launch 12:01 a.m. PT; no upvote asking | One-shot: wait for the public Play release |
| 15 | itch.io | Yes | HTML5 upload; link-only pages de-indexed | Blocked today by the `/tv` CSP (§0 #5) |
| 16 | r/AndroidGaming (~428k) | `[DEV]` posts | 1 promo/30 days, <10% of activity, account 1+ month and 50+ sub karma, Play link preferred | After the Play release only |
| 17 | r/WebGames (~144k) | Yes for browser games | Account ≥7 days + 10 comment karma; title starts with game name; **P7 bans games that require a smartphone** | Ask mods first; likely a no |

**Not suitable (don't post):**
- **r/gamedev** (~2M): "isn't the place to showcase your project". Only a post-mortem/technical write-up, or the weekly Screenshot Saturday thread. A post-mortem after the Play release is a good later idea.
- **r/boardgames** (~5.4M): original digital games are off-topic (they point to r/digitaltabletop); 10:1 ratio, one post per 10 weeks per game, AI/"vibe-coded" apps can be removed.
- **r/jackboxgames**: no self-promotion, posts must be about Jackbox, no AI content.
- **r/androiddev**: "Sharing applications or recruiting testers is not allowed."
- **r/boardgamedesign**: no advertising.
- **Genre subs**: no active r/Spyfall, r/socialdeduction or Undercover/"who is the spy" subreddit was found; r/AmongUs and r/BloodOnTheClocktower are about one specific game each.
- **r/IndieGaming** (~527k): allowed (account ≥1 week, 1 post per 2 weeks, AI must be declared) but overlaps r/indiegames; use it later for the Play release.

**Trademarks:** UNDERCOVER is a registered US trademark of Yanstar Studio OÜ (Reg. 8112944, 27 Jan 2026, classes 9 and 28) and SPYFALL of HW Group (Hobby World) (Reg. 7940351). Never in titles, tags or keywords. Describing the genre in a comment is fine (REDDIT-POSTS.md FAQ).

---

## 2. Sources for the rules above

Reddit blocked direct reading of rules pages during research (403 for all automated fetches). The rules come from Wayback Machine snapshots (dated) and threadfox.vip (a rules mirror read 2026-09-24 to 26). **Open each sub's live rules on the day you post.**

- r/SideProject: https://threadfox.vip/rules/sideproject · general guide https://redship.io/blog/reddit-self-promotion-rules-2026 · posting time 14:00–17:00 UTC, Friday afternoon strongest (search snippet from notifier.so, unverified)
- r/IndieDev: https://threadfox.vip/rules/indiedev
- r/indiegames: https://threadfox.vip/rules/indiegames
- r/gamedev: https://threadfox.vip/rules/gamedev
- r/IndieGaming: https://threadfox.vip/rules/indiegaming
- r/WebGames: http://web.archive.org/web/20260801185231/https://old.reddit.com/r/WebGames/about/rules · https://threadfox.vip/rules/webgames
- r/AndroidGaming: https://threadfox.vip/rules/androidgaming
- r/playmygame: https://threadfox.vip/rules/playmygame
- r/androiddev: https://threadfox.vip/rules/androiddev
- r/AndroidTV: http://web.archive.org/web/20260713051116/https://old.reddit.com/r/AndroidTV/about/rules · size https://gummysearch.com/r/AndroidTV
- r/GoogleTV: http://web.archive.org/web/20260201063741/https://www.reddit.com/r/GoogleTV/ · https://gummysearch.com/r/GoogleTV/
- r/boardgames: http://web.archive.org/web/20260823234152/https://old.reddit.com/r/boardgames/about/rules/ · off-topic wiki http://web.archive.org/web/20250726032813/https://old.reddit.com/r/boardgames/wiki/off-topic · community wiki http://web.archive.org/web/20250721175648/https://old.reddit.com/r/boardgames/wiki/community
- r/partygames: http://web.archive.org/web/20250709215455/https://www.reddit.com/r/partygames/
- r/jackboxgames: http://web.archive.org/web/20260929055401/https://www.reddit.com/r/jackboxgames/
- r/lebanon: http://web.archive.org/web/20250113160315/https://www.reddit.com/r/lebanon/ (Jan 2025, may have changed) · size https://gummysearch.com/r/lebanon/
- Reddit-wide: Reddit Rules https://redditinc.com/policies/reddit-rules · Reddiquette https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette. The 9:1 / 10% ratio is a rule of thumb, written into r/AndroidTV, r/boardgames and r/AndroidGaming.
- Show HN: https://news.ycombinator.com/showhn.html · guidelines https://news.ycombinator.com/newsguidelines.html · FAQ https://news.ycombinator.com/newsfaq.html · new-account restriction https://news.ycombinator.com/item?id=47300329 · timing study (157k posts) https://www.myriade.ai/blogs/when-is-it-the-best-time-to-post-on-show-hn
- Product Hunt: https://www.producthunt.com/launch/guide · https://www.producthunt.com/launch/preparing-for-launch · beta not featured https://www.producthunt.com/p/introduce-yourself/hey-new-here-but-confused
- Indie Hackers: guidelines https://www.indiehackers.com/guidelines (couldn't be fetched; unverified) · group rules https://www.indiehackers.com/product/indie-hackers/added-support-for-group-posting-guidelines--MHDC04726tqs6fDr-W5
- AlternativeTo: https://alternativeto.net/faq/
- itch.io: https://itch.io/docs/creators/html5 · https://itch.io/docs/creators/quality-guidelines · https://itch.io/docs/creators/getting-indexed
- X: links and engagement https://buffer.com/resources/links-on-x/ · X says links aren't deboosted https://beincrypto.com/nikita-bier-pope-x-links-deboost/ · alt text https://help.x.com/en/using-x/add-image-descriptions
- YouTube: descriptions https://support.google.com/youtube/answer/12948449 · chapters https://support.google.com/youtube/answer/9884579 · Shorts https://support.google.com/youtube/answer/15424877
- Trademarks: https://tsdr.uspto.gov/statusview/sn79421860 (UNDERCOVER) · https://tsdr.uspto.gov/statusview/sn88910138 (SPYFALL) · Yanstar terms https://www.yanstarstudio.com/terms-conditions

---

## 3. The 10-day calendar

Times: October 2026, Beirut is UTC+3 and US Eastern is UTC−4 (both change later in the month/year, after this window). Unless a source says otherwise, post at **13:00–15:00 UTC** (9–11 a.m. New York, 4–6 p.m. Beirut): Europe is awake, the US is starting its day. That's judgement, not data, except where marked.

### Prep week: Mon 5 – Sun 11 October ("engage first")

Do these every day, 20–30 minutes, from the accounts you'll post with:
- **Reddit:** 2–3 genuinely useful comments per day across r/SideProject, r/IndieDev, r/AndroidTV, r/lebanon. Examples: answer a "which streaming box?" question in r/AndroidTV with your real experience of developing for TVs; give concrete feedback on someone's project in r/SideProject (one thing that works, one thing to fix, one question); join a non-political thread in r/lebanon. Aim for the 10:1 ratio before your first post. Never mention your game in these comments.
- **Hacker News:** comment on a few threads where you know something (Cloudflare Workers, Durable Objects, Android TV, Compose, i18n/RTL). This is what the March 2026 Show HN restriction asks for.
- **X:** reply to 5 #buildinpublic / #indiedev posts a day with something specific. Follow devs who make party/TV/couch games.

One-off tasks:
- [ ] Fix blockers §0 #1, #3, #7 (and #4 if you want the landing page live).
- [ ] Record the real 20–30 s round. Take 3 clean `/tv` screenshots: lobby with QR, clues row, OUT stamp.
- [ ] Upload the fixed film to YouTube as **unlisted** (LISTINGS.md §5) and the 9:16 as a Short (unlisted/scheduled).
- [ ] Modmail **r/lebanon**, **r/AndroidTV** (and r/WebGames if you want to try) with the messages in REDDIT-POSTS.md.
- [ ] Submit the **AlternativeTo** listing (browser version only; pay the $5 priority review if you want it live during the launch). Then suggest it as an alternative on the Jackbox Party Pack and Imposter Game pages.
- [ ] Create the Product Hunt account (personal) and use it normally; don't launch yet.
- [ ] Play 2–3 full rounds on the live URL with real people on different phones (iPhone + Android). Fix anything embarrassing before Day 1.

### Launch days

| Day | Date | Channel | What | When (UTC) | Engage-first / follow-up that day |
|---|---|---|---|---|---|
| 1 | Mon 12 Oct | **X + YouTube** | Make the YouTube film public; post the thread (X-THREAD.md), pin it | Thread 13:00 | Reply to every reply for 2 h. Quote-post once at ~21:00 UTC for the US evening |
| 2 | Tue 13 Oct | **r/SideProject** | Post #1 in REDDIT-POSTS.md, native video | 14:00 (sub-specific window 14–17 UTC, unverified) | Stay 3 h. Also leave 2 helpful comments on others' projects that day |
| 3 | Wed 14 Oct | **r/IndieDev** | Post #2 (design/process angle) | 14:00 | Fix the top bug from Day 2 and say so in the Day 2 thread |
| 4 | Thu 15 Oct | **r/lebanon** (only with mod OK) | Post #4, Arabic phone card or Arabic round | 17:00 (8 p.m. Beirut, judgement) | Reply in the language people write in. Note every word-pack suggestion |
| 5 | Fri 16 Oct | **r/partygames** | Post #7 | 14:00 | X standalone post "Day +1" (PIZZA/PASTA) |
| 6 | Sat 17 Oct | **r/indiegames** (if the AI rule doesn't apply) | Post #3 with gameplay video | 14:00 | X standalone "Day +4" (sound post) with **#ScreenshotSaturday** |
| 7 | Sun 18 Oct | **Show HN** | Submit + first comment (REDDIT-POSTS.md) | **12:00** (best hour in the 157k-post study; Sunday best day) | Be at the keyboard 4 h. Answer technical questions with detail. Don't share the link asking for votes |
| 8 | Mon 19 Oct | **r/AndroidTV** (with mod OK or after 10:1) | Post #5; collect tester names | 14:00 | X standalone "Day +2" (Durable Objects) |
| 9 | Tue 20 Oct | **r/playmygame** | Post #8 | 14:00 | X standalone "Day +3" (Arabic/RTL) |
| 10 | Wed 21 Oct | **Indie Hackers** | Post from LISTINGS.md §3, now with week-one learnings (only numbers you actually have) | 14:00 | X standalone "Day +5" (honest status). Write down what worked for the Play release launch |

Rules for the 10 days:
- One new community per day. Never the same text in two places.
- Don't post to a sub where you haven't commented before. If the Day 4/8 mod reply hasn't come, swap in r/IndieDev comments for that day and post when approved.
- If a post is removed, read the removal reason, reply politely to the mods once, and don't repost.
- Answer comments in every earlier thread daily; old threads keep getting found through Google.

### After Day 10 (in this order)
1. **Closed testing opens** → r/GoogleTV tester call (REDDIT-POSTS.md #6) + an X post.
2. **Play listing public** → swap the film end card back to "Available on Google TV", release the `MA-*` ads, add Android TV on AlternativeTo, **Product Hunt launch** (LISTINGS.md §2, 12:01 a.m. PT, a Tuesday–Thursday), r/AndroidGaming `[DEV]` post, r/IndieGaming, an r/gamedev post-mortem ("what launching an Android TV party game taught me", with real numbers).
3. itch.io once the `/tv` CSP allows itch's frame host.

---

## 4. How each channel feeds Google and AI-assistant visibility

What the data says (cite these, don't overclaim):
- Profound's analysis of 680M AI citations (Aug 2024–Jun 2025): Reddit is the top cited source for Perplexity (6.6%) and Google AI Overviews (2.2%), YouTube close behind (2.0% / 1.9%); ChatGPT leans on Wikipedia (7.8%) then Reddit (1.8%). https://www.tryprofound.com/blog/ai-platform-citation-patterns
- Semrush (230k prompts, Jul–Oct 2025): Reddit, Wikipedia, YouTube, LinkedIn, Forbes are the most cited domains overall; ChatGPT's Reddit citations dropped sharply in mid-September 2025; Google's AI Mode favours YouTube and Google properties. https://www.semrush.com/blog/most-cited-domains-ai/
- No study found shows Product Hunt or AlternativeTo among frequently cited AI sources (they're absent from a 2026 top-50 index: https://everything-pr.com/the-50-most-cited-websites-in-ai-reddit-wikipedia-youtube-lead-2026-index). They still rank in normal Google results for "X alternatives" searches.

| Channel | What it leaves behind | How it helps |
|---|---|---|
| Reddit threads | Public threads where real people describe the game in their words, with your honest answers | Strongest documented source for Perplexity and Google AI Overviews. A thread like "party game for Android TV where phones are controllers" answers exactly the questions people ask assistants. Your FAQ replies become the quoted text, so keep them factual |
| YouTube | A video page with a text description and (later) captions | Second most-cited source; Google's AI Mode favours YouTube. Upload captions (auto + corrected) so the content is readable. Use the same one-line description everywhere |
| Show HN | A permanent HN item page + comments | HN pages rank well and get scraped; the technical comments describe the architecture for developer queries |
| AlternativeTo | An "alternative to Jackbox / Imposter Game" listing | Ranks for "alternatives to …" searches; gives a third-party description and platform list |
| Product Hunt | A product page with maker comment and reviews | Ranks for the product name; useful once the Play app is public |
| Indie Hackers | Story post | Ranks for "solo dev / Cloudflare / Android TV game" story searches; minor |
| X | Thread | Little search value; mostly reach and relationships |
| Landing site (once deployed) | The page you control | The page assistants and Google need to describe what the game *is*. Add plain text (what, players, languages, price, status), FAQ, and VideoGame/SoftwareApplication structured data |

**Consistency rule** (so search engines and assistants connect the pages to one thing): always the same name `Mish Ana!` + the same one-liner, "a secret-word party game for your TV; phones are the controllers, no app needed", + the same facts (3–12 players, EN/FR/AR, free). Link every profile and listing back to the same URL (the landing page once deployed, the `/tv` link until then).

---

## 5. What to measure (no vanity numbers)

- Rooms created per day (Cloudflare dashboard → Workers → requests to `POST /api/rooms`), compared with each post's day.
- Comments that report a real play session ("we played with 6 people…") per channel. That is the number that matters.
- Bug reports and word-pack suggestions collected (keep a simple list).
- Tester sign-ups for the Play closed test.
Write these down on Day 10; they are the only numbers the Indie Hackers post and the later Product Hunt launch should use.
