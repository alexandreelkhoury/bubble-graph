export const meta = {
  name: 'jamaa-games',
  description: 'Build JAMAA games G2 Bluff, G3 Most Likely, G4 Trivia (specs update, engines+content, web+TV, review, fix, verify, README blueprint)',
  phases: [
    { title: 'Build', detail: 'per game: A engine+fixtures and D content, then B web and C TV' },
    { title: 'Review', detail: 'per game: rules/fun, security/leaks, UX/design' },
    { title: 'Fix', detail: 'per game and lane' },
    { title: 'Verify', detail: 'full gate, e2e, TV harness, README blueprint section' },
  ],
}
const REPO = '/home/user/bubble-graph'
const SCRATCH = '/tmp/claude-0/-home-user-bubble-graph/77b6be62-ffd0-56aa-bc1b-92bd03a88678/scratchpad'
const BASE = `Repo ${REPO}: JAMAA, a TV + phone party-game platform (milestone P platform is done: hub, setup, rules ⓘ, characters, room v2, GameDefinition registry with stubs for bluff/likely/trivia, Pass). First run: git -C ${REPO} pull --no-rebase origin main (stop and report on conflict).
BINDING: docs/JAMAA-PLATFORM.md (§6 lanes/ownership, §6.5–§6.8 milestones G2/G3/G4 and definition of done), docs/GAME-BLUFF.md, docs/GAME-LIKELY.md, docs/GAME-TRIVIA.md, docs/DESIGN-JAMAA.md, docs/BLUEPRINT.md and docs/JACKBOX-STUDY.md (what we copy vs never copy).
Owner rules: content must be ORIGINAL and stylish (witty, natural, culturally sharp — never copied or paraphrased from Jackbox or any other game; no Jackbox names, prompts, art, music or look); languages EN/FR/AR(RTL, natural Lebanese where it fits)/ES; family-friendly by default; TV remote-only (D-pad/OK/Back, visible focus, ⓘ rules reachable); excellent UI/UX and animation per DESIGN-JAMAA (shared choreography sampler, characters with expressions, points flying, counters ticking); server authoritative and no secrets leak (real answers, other players' inputs before reveal, votes in secret mode) to TV or other phones before the reveal; tests for everything; Mish Ana! untouched (the Blank never speaks first).
Write ONLY files your lane owns for your game (JAMAA-PLATFORM §6.1 "each G milestone" column). Never git commit. Never invent APIs/versions. Google Maven is blocked: verify TV Kotlin in the JVM harness at ${SCRATCH}/tv-verify (extend it). Chromium at /opt/pw-browsers (never playwright install); kill any wrangler you start; use a free port. Final reply: what you built, commands run with results, SPEC-GAPs, known issues.`

const ALL_GAMES = [
  { id: 'bluff', spec: 'docs/GAME-BLUFF.md', milestone: '§6.5 G2', content: 'the 3 round types: Lebanese/Levantine proverbs to complete (AR with translit + FR/EN/ES translations where meaningful), French expressions to complete, Spanish refranes to complete, English sayings to complete; impossible-but-true facts packs (Lebanon & world, AR/FR/EN/ES); "no truth" absurd final questions (all 4 languages). 40+ items per pack, fakes ("house lies") for small rooms, every fact marked [VERIFY] with a source note.' },
  { id: 'likely', spec: 'docs/GAME-LIKELY.md', milestone: '§6.6 G3', content: 'family pack 80+ prompts per language (EN/FR/AR/ES), funny and specific, plus a Spicy pack 60+ per language (suggestive, never explicit, with {player} references), end-of-game award titles that are witty.' },
  { id: 'trivia', spec: 'docs/GAME-TRIVIA.md', milestone: '§6.7 G4', content: 'the Lebanon quiz (75 questions across the topics in the spec, difficulty stars, domain/topic labels, AR/FR/EN/ES, careful with politics/sects, every fact marked [VERIFY] with a source note) plus one general-world quiz as a second card.' },
]

const GAMES = ALL_GAMES.filter(g => !args || !args.game || g.id === args.game)
phase('Build')
const built = await pipeline(GAMES,
  async (g) => {
    const [a, d] = await parallel([
      () => agent(`${BASE}\nYou are lane A for game "${g.id}" (${g.milestone}, rules in ${g.spec}). A draft engine with tests already exists at ${SCRATCH}/games-early/engine/${g.id}/ (written against the spec types): port it into shared/src/games/${g.id}/ on top of the real platform types, fix any mismatch, and complete the pure deterministic engine (GameDefinition), projections per role (no leaks), protocol schemas, fixtures in shared/fixtures/v2/games/${g.id}/ (publish them FIRST), bots + sim support, server tests, property tests (termination, scoring invariants, leak tests). Flip the game to enabled in its own module only if the spec says lane A does it.`, { label: `A:${g.id}`, phase: 'Build' }),
      () => agent(`${BASE}\nYou are lane D for game "${g.id}" (${g.milestone}, rules in ${g.spec}). Draft content packs already exist at ${SCRATCH}/games-early/content/${g.id}/: polish them (quality, originality, natural language in all 4 languages, schema conformance) and install them into content/${g.id}/ per the content schema, filling gaps to reach: ${g.content} Content must be original, witty and culturally sharp (you are a native-level comedy writer in each language), never copied. Also: per-game i18n (shared/i18n/games/${g.id}/, en/fr/ar/es incl. How to play), content-lint rules for this game, game sound cues (tools/gen-sounds/cues/${g.id}.mjs, original synthesized), and regenerate that game's generated TV/web files.`, { label: `D:${g.id}`, phase: 'Build' }),
    ])
    return { a, d }
  },
  async (prev, g) => {
    const [b, c] = await parallel([
      () => agent(`${BASE}\nYou are lane B for game "${g.id}" (${g.milestone}, rules in ${g.spec}, design in docs/DESIGN-JAMAA.md). Lane A's fixtures and lane D's content/i18n exist now. Build the phone screens and the /tv browser TV screens for this game in web-client/src/games/${g.id}/ with the signature animated moments (reveals, points flying to characters, counters ticking, reactions), unit tests and e2e (web-client/e2e/games/${g.id}.spec.ts) playing a full game with 3–6 phones incl. remote-only TV keys. Take screenshots of every screen in EN/AR/ES at phone 390x844 and TV 1920x1080 into ${SCRATCH}/shots/games/${g.id} and iterate until it looks premium.`, { label: `B:${g.id}`, phase: 'Build' }),
      () => agent(`${BASE}\nYou are lane C for game "${g.id}" (${g.milestone}, rules in ${g.spec}, design in docs/DESIGN-JAMAA.md). Lane A's fixtures and lane D's content/i18n exist now. Build the native TV (Compose for TV) screens, decoder and moments for this game in tv-app/app/src/main/java/app/jamaa/tv/games/${g.id}/, registered via the platform stubs, remote-only focus, choreography-driven animations matching the browser TV, and Kotlin tests run in the tv-verify harness against the fixtures.`, { label: `C:${g.id}`, phase: 'Build' }),
    ])
    return { ...prev, b, c }
  })

const F = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: {
  lane: { type: 'string', enum: ['A', 'B', 'C', 'D'] }, file: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
  issue: { type: 'string' }, fix: { type: 'string' } }, required: ['lane', 'file', 'severity', 'issue', 'fix'] } } }, required: ['findings'] }

phase('Review')
const fixed = await pipeline(GAMES,
  (g) => parallel([
    ['rules-fun', `party-game designer: play the game end to end (sim + a live wrangler dev with scripted phones), check rules vs ${g.spec}, pacing, scoring balance, 3 and 12 players, edge cases, and CONTENT quality in all 4 languages (original? witty? natural? culturally sharp? any copied/paraphrased Jackbox material? factual errors?).`],
    ['security', 'security reviewer: record every WS frame of a live game and prove no secret leaks before reveal (real answers, other players inputs, voter identities in secret mode); input validation, rate limits, profanity filter, Arabic/Latin normalisation.'],
    ['design', `principal product/motion designer + TV remote reviewer: screenshots/videos of phone and /tv browser TV (EN, AR RTL, ES), judge vs DESIGN-JAMAA; keyboard-only TV pass; review the native TV Compose code for this game vs the design and focus paths.`],
  ].map(([k, who]) => () => agent(`${BASE}\nGame under review: "${g.id}" (${g.spec}). You are a ${who} Do not edit repo files. Concrete findings with file paths and fixes, tagged with the owning lane.`, { label: `review:${g.id}:${k}`, phase: 'Review', schema: F }))).then(rs => rs.filter(Boolean).flatMap(r => r.findings)),
  (findings, g) => {
    const by = { A: [], B: [], C: [], D: [] }
    for (const f of findings) (by[f.lane] || by.A).push(f)
    log(`${g.id}: ${findings.length} findings (${findings.filter(f => f.severity === 'blocker').length} blockers)`)
    return parallel(Object.keys(by).filter(k => by[k].length).map(k => () => agent(`${BASE}\nYou are lane ${k} for game "${g.id}" (${g.spec}). Verify, then fix these findings in files you own (reject false positives with a reason). All blockers/majors; minors if cheap. Re-run your checks.\n${JSON.stringify(by[k], null, 1)}`, { label: `fix:${g.id}:${k}`, phase: 'Fix' })))
  })

phase('Verify')
const verify = await agent(`${BASE}\nRelease engineer for game(s) ${GAMES.map(g => g.id).join(', ')} (other games may be built in parallel by other workflows: only fix failures in your game's files or shared breakages you caused; you may edit other files only to fix a real failure you can attribute). Run and make green: pnpm install, lint, typecheck, test, build (budgets), sim for every game, content lint, gen:strings --check, fixtures checks, rename gate, check-deploy, pnpm e2e (all, incl. each game + remote-only TV), the tv-verify harness. Then enable your game for local dev (pnpm dev GAMES_ENABLED) while keeping the production default per docs/JAMAA-PLATFORM.md §2.5 unless the spec says otherwise, and document how to turn each game on in production. Report each command with its result.`, { label: 'verify', phase: 'Verify' })
return { verify }
