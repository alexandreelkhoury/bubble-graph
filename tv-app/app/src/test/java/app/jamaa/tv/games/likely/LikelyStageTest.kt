package app.jamaa.tv.games.likely

import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.platform.Expression
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The reveal plan, expressions (public data only), choreography budget, awards pages and helpers. */
class LikelyStageTest {
    private fun count(id: String, c: Int, pct: Int) = LikelyCount(id, c, pct)

    private fun reveal(votes: Int, unanimous: Boolean = false, tops: Int = 1, chaos: Boolean = false, none: Boolean = false) = LikelyReveal(
        votesCast = votes, counts = emptyList(), topIds = (0 until tops).map { "t$it" }, unanimous = unanimous, chaos = chaos,
        none = none, againId = null, ballots = emptyList(), deltas = emptyList(),
    )

    // ---------------------------------------------------------------- choreography budget (the server never waits)

    private fun shape(r: LikelyReveal, publicMode: Boolean, n: Int) =
        LikelyChoreo.RevealShape(if (publicMode) n else 0, if (publicMode) 0 else n, publicMode, r.chaos, r.none, r.unanimous, if (publicMode) n else 0)

    private fun tl(r: LikelyReveal, publicMode: Boolean, n: Int) = LikelyChoreo.reveal(r, shape(r, publicMode, n))

    /** The server never waits: every reveal ends inside the REVEAL window, leaving the 1 s tail for "defend yourself". */
    @Test fun everyRevealTimelineFitsTheServerDuration() {
        for (v in 0..12) for (tops in 1..maxOf(1, v)) for (u in listOf(false, true)) for (pub in listOf(false, true)) for (chaos in listOf(false, true)) {
            if (u && tops > 1) continue
            if (chaos && (u || v < 3)) continue
            val r = reveal(v, u, tops, chaos = chaos, none = v == 0)
            val t = tl(r, pub, v)
            val window = LikelyTiming.revealMs(v, u, tops)
            val budget = maxOf(2_000L, window - LikelyChoreo.REVEAL_TAIL_MS)
            // Springs keep their physical settle time when scaled (shared `scaled`): allow their length past the budget.
            assertTrue("v=$v tops=$tops u=$u pub=$pub chaos=$chaos: ${t.totalMs} > $budget", t.totalMs <= budget + 600)
            assertTrue(t.totalMs <= window)
            for (m in t.marks) assertTrue("${m.cue} at ${m.atMs}", m.atMs in 0..t.totalMs)
            for (s in t.steps) assertTrue(s.id, Choreo.easings.containsKey(s.easing))
        }
    }

    /** Line for line with web-client/src/games/likely/tv/choreo.ts `revealSteps` (spot checks of the TS numbers). */
    @Test fun revealStepsMatchTheBrowserTv() {
        val pub = LikelyChoreo.revealSteps(LikelyChoreo.RevealShape(3, 0, true, false, false, false, 2)).associateBy { it.id }
        assertEquals(listOf("dim", "run", "count", "spot", "stamp", "coin", "tick", "hold"), LikelyChoreo.revealSteps(LikelyChoreo.RevealShape(3, 0, true, false, false, false, 2)).map { it.id })
        assertEquals(800, pub.getValue("run").startMs)
        assertEquals(100, pub.getValue("run").staggerMs)
        assertEquals(800 + 520 + 200 + 100, pub.getValue("count").startMs)
        assertEquals(1620 + 600 + 800 + 600, pub.getValue("coin").startMs)
        assertEquals(3620 + 450 + 70 + 600, pub.getValue("hold").startMs)
        val secret = LikelyChoreo.revealSteps(LikelyChoreo.RevealShape(0, 4, false, false, false, true, 0))
        assertEquals(listOf("dim", "box", "env", "count", "spot", "stamp", "confetti", "board", "hold"), secret.map { it.id })
        val chaos = LikelyChoreo.revealSteps(LikelyChoreo.RevealShape(4, 0, true, true, false, false, 0))
        assertEquals(listOf("dim", "scramble", "run", "count", "hold"), chaos.map { it.id })
        assertEquals("spring.bouncy", chaos.first { it.id == "run" }.easing)
        assertEquals(listOf("dim", "hold"), LikelyChoreo.revealSteps(LikelyChoreo.RevealShape(0, 0, true, false, true, false, 0)).map { it.id })
        // 25 runners squeeze the run into 2.5 s.
        assertEquals(1980.0 / 24, LikelyChoreo.runStagger(25), 1e-9)
        // fitReveal scales only when needed, and keeps spring durations.
        val long = LikelyChoreo.revealSteps(LikelyChoreo.RevealShape(0, 0, true, true, false, false, 0) .copy(runners = 12, publicMode = true))
        val fit = LikelyChoreo.fitReveal(long, 3_000, 12)
        assertTrue(LikelyChoreo.endMs(fit, 12) < LikelyChoreo.endMs(long, 12))
        assertEquals(long.first { it.id == "run" }.durationMs, fit.first { it.id == "run" }.durationMs)
    }

    @Test fun serverFormulasMatchTheFixtureDeadlines() {
        for (s in listOf("reveal", "reveal.unanimous", "reveal.tie", "reveal.secret.ar", "reveal.chaos", "reveal.none", "reveal.again")) {
            val v = LikelyFixtures.view(s)
            val r = v.reveal!!
            assertEquals(s, LikelyTiming.revealMs(r.votesCast, r.unanimous, r.topIds.size), LikelyFixtures.remainingMs(s))
            val plan = LikelyStage.revealPlan(v, rtl = false)!!
            assertTrue(s, plan.timeline.totalMs <= LikelyFixtures.remainingMs(s))
        }
        assertEquals(LikelyTiming.votingMs(4), LikelyFixtures.remainingMs("voting"))
        for (s in listOf("awards", "awards.secret.ar")) {
            assertEquals(s, LikelyStage.awardsPlan(LikelyFixtures.view(s)).totalMs, LikelyFixtures.remainingMs(s))
        }
    }

    @Test fun startCompressesThenSnaps() {
        assertEquals(LikelyChoreo.Start(0, 1.0), LikelyChoreo.start(5_000, 6_000))
        assertEquals(LikelyChoreo.Start(0, 1.0), LikelyChoreo.start(5_000, null))
        assertEquals(LikelyChoreo.Start(0, 0.8), LikelyChoreo.start(5_000, 4_000))
        assertEquals(LikelyChoreo.Start(5_000, 1.0), LikelyChoreo.start(5_000, 1_000))
    }

    @Test fun reducedMotionJumpsAndFades() {
        val tl = tl(reveal(4), true, 3)
        val run = tl.step("run")!!
        assertEquals(Choreo.Reduced.SKIP, run.reduced)
        assertEquals(0f, LikelyChoreo.progress(run, run.startMs - 1.0, reduced = true), 0f)
        assertEquals(1f, LikelyChoreo.progress(run, run.startMs.toDouble(), reduced = true), 0f)
        val spot = tl.step("spot")!!
        assertEquals(0.5f, LikelyChoreo.progress(spot, spot.startMs + 100.0, reduced = true), 1e-4f)
        assertEquals(1f, LikelyChoreo.progress(spot, spot.startMs + spot.durationMs.toDouble()), 0f)
        assertEquals(0f, LikelyChoreo.progress(spot, 0.0), 0f)
        assertEquals(1f, LikelyChoreo.progress(null, 0.0), 0f)
        // Lite motion drops the glint sweeps.
        val glint = LikelyChoreo.awardsTrio.step("glint")!!
        assertEquals(1f, LikelyChoreo.progress(glint, glint.startMs.toDouble(), lite = true), 0f)
    }

    @Test fun marksAreSilentAfterAJump() {
        val tl = tl(reveal(4), true, 3)
        assertEquals(listOf("sfx.drumroll"), LikelyChoreo.marksBetween(tl, -1.0, 0.0).map { it.cue })
        assertTrue(LikelyChoreo.marksBetween(tl, 0.0, tl.totalMs.toDouble()).isEmpty())
        val toks = LikelyChoreo.marksBetween(tl, 0.0, 1_600.0).filter { it.cue == "likely.tok" }
        assertTrue(toks.isNotEmpty())
    }

    @Test fun everyCueHasAPlatformSound() {
        for (id in SoundCuesLikely.cues.keys) assertNotNull(id, LikelySounds.platformCue(id))
        val timelines = listOf(LikelyChoreo.cardDeal, LikelyChoreo.awardsTrio, LikelyChoreo.mindReader, LikelyChoreo.awardsIntro) +
            listOf(false, true).flatMap { a -> listOf(reveal(4), reveal(4, true), reveal(4, chaos = true), reveal(0, none = true)).map { tl(it, a, 3) } }
        for (t in timelines) for (m in t.marks) assertNotNull("${t.id} ${m.cue}", LikelySounds.platformCue(m.cue))
    }

    // ---------------------------------------------------------------- reveal plan

    @Test fun publicRevealBuildsCongaLinesCoinsAndExpressions() {
        val v = LikelyFixtures.view("reveal")
        val plan = LikelyStage.revealPlan(v, rtl = false)!!
        assertEquals(LikelyChoreo.RevealKind.PUBLIC, plan.kind)
        val rami = v.players[0].id
        val lea = v.players[1].id
        val noor = v.players[2].id
        val sam = v.players[3].id
        assertEquals(setOf(rami), plan.selfVoterIds)
        assertEquals(listOf(lea, noor, sam), plan.runners.map { it.voterId })
        // Léa and Noor line up behind Rami (places 1, 2), Sam behind Léa, on the sides the shared layout picks.
        val seats = plan.seats
        val sides = LikelyLayout.congaSides(mapOf(rami to 2, lea to 1), seats)
        assertEquals(LikelyLayout.congaSlot(seats.getValue(rami), 1, sides.getValue(rami)), plan.endOf(lea))
        assertEquals(LikelyLayout.congaSlot(seats.getValue(rami), 2, sides.getValue(rami)), plan.endOf(noor))
        assertEquals(LikelyLayout.congaSlot(seats.getValue(lea), 1, sides.getValue(lea)), plan.endOf(sam))
        assertEquals(seats.getValue(rami), plan.endOf(rami))
        // Coins: one per scoring voter with its card total (Rami: agree 100 + self-aware 100).
        assertEquals(listOf(rami to 200, lea to 100, noor to 100), plan.coins.map { it.voterId to it.points })
        assertEquals(LikelyStage.head(seats.getValue(rami)), plan.coins[1].from)
        assertEquals(listOf(rami), plan.topIds)
        assertEquals(rami, plan.defendId)
        assertTrue(plan.envelopes.isEmpty() && plan.board.isEmpty())

        val tl = plan.timeline
        assertEquals(Expression.IDLE, LikelyStage.revealExpression(plan, lea, 0.0))
        assertEquals(Expression.POINT, LikelyStage.revealExpression(plan, lea, tl.step("run")!!.startMs + 10.0))
        assertEquals(Expression.SMUG, LikelyStage.revealExpression(plan, rami, tl.totalMs.toDouble()))
        assertEquals(Expression.HAPPY, LikelyStage.revealExpression(plan, noor, tl.totalMs.toDouble()))
        assertEquals(Expression.POINT, LikelyStage.revealExpression(plan, sam, tl.totalMs.toDouble()))
    }

    @Test fun rtlMirrorsTheRevealPlan() {
        val v = LikelyFixtures.view("reveal.tie")
        val ltr = LikelyStage.revealPlan(v, rtl = false)!!
        val rtl = LikelyStage.revealPlan(v, rtl = true)!!
        for (r in ltr.runners) {
            val m = rtl.runners.first { it.voterId == r.voterId }
            assertEquals(LikelyLayout.WIDTH - r.to.x, m.to.x, 0.11)
            assertEquals(r.to.y, m.to.y, 0.0)
        }
        assertEquals(2, ltr.topIds.size)
        assertNull("a tie has no single defendant", ltr.defendId)
    }

    @Test fun unanimousCheersAndThrowsConfetti() {
        val plan = LikelyStage.revealPlan(LikelyFixtures.view("reveal.unanimous"), false)!!
        assertTrue(plan.unanimous)
        assertNotNull(plan.timeline.step("confetti"))
        val end = plan.timeline.totalMs.toDouble()
        val voters = plan.coins.map { it.voterId }
        assertTrue(voters.isNotEmpty())
        for (id in voters.filter { it !in plan.topIds }) assertEquals(Expression.CHEER, LikelyStage.revealExpression(plan, id, end))
    }

    @Test fun chaosScramblesWithoutSpotlight() {
        val plan = LikelyStage.revealPlan(LikelyFixtures.view("reveal.chaos"), false)!!
        assertEquals(LikelyChoreo.RevealKind.CHAOS, plan.kind)
        assertNull(plan.timeline.step("spot"))
        // Public mode: after the scramble the picks still show (everyone ran to a different person), no coins.
        assertEquals(4, plan.runners.size)
        assertTrue(plan.coins.isEmpty())
        assertEquals(4, plan.counters.size)
        val s = plan.timeline.step("scramble")!!
        assertEquals(Expression.SHOCK, LikelyStage.revealExpression(plan, plan.seats.keys.first(), s.startMs + 10.0))
        assertEquals(Expression.LAUGH, LikelyStage.revealExpression(plan, plan.seats.keys.first(), plan.timeline.totalMs.toDouble()))
        assertNull(plan.defendId)
    }

    @Test fun noVotesIsShy() {
        val plan = LikelyStage.revealPlan(LikelyFixtures.view("reveal.none"), false)!!
        assertEquals(LikelyChoreo.RevealKind.NONE, plan.kind)
        assertTrue(plan.counters.isEmpty())
        assertEquals(Expression.SHY, LikelyStage.revealExpression(plan, plan.seats.keys.first(), 0.0))
    }

    @Test fun againNamesTheRepeatTopper() {
        val v = LikelyFixtures.view("reveal.again")
        val plan = LikelyStage.revealPlan(v, false)!!
        assertEquals(v.players[2].id, plan.againId)
    }

    @Test fun secretRevealUsesTalliesOnly() {
        val v = LikelyFixtures.view("reveal.secret.ar")
        val plan = LikelyStage.revealPlan(v, rtl = true)!!
        assertEquals(LikelyChoreo.RevealKind.SECRET, plan.kind)
        assertTrue(plan.runners.isEmpty() && plan.coins.isEmpty() && plan.selfVoterIds.isEmpty())
        assertEquals(v.reveal!!.votesCast, plan.envelopes.size)
        assertEquals(listOf(60, 20, 20), plan.board.map { it.percent })
        assertNull(plan.timeline.step("coin"))
        assertNotNull(plan.timeline.step("board"))
        assertEquals(Expression.SHY, LikelyStage.revealExpression(plan, plan.topIds.single(), plan.timeline.totalMs.toDouble()))
    }

    /**
     * The anonymity guarantee on the TV side (JAMAA-PLATFORM §2.11): in secret-vote mode, two reveals with identical
     * tallies but different voter→target mappings (even if a buggy server leaked ballots or deltas) draw the same
     * plan: same positions, envelopes, counters, board, expressions at every sampled time.
     */
    @Test fun secretPlanIsIndependentOfTheMapping() {
        val st = LikelyFixtures.tv("reveal")
        val env = st.view.game!!
        val pub = app.jamaa.tv.protocol.ProtocolJson.decoder.decodeFromJsonElement(LikelyPub.serializer(), env.public).copy(showVoters = false)
        val ids = pub.scores.map { it.playerId }
        val a = pub.reveal!!.copy(ballots = listOf(LikelyBallot(ids[0], ids[0]), LikelyBallot(ids[1], ids[0]), LikelyBallot(ids[2], ids[0]), LikelyBallot(ids[3], ids[1])))
        val b = pub.reveal!!.copy(
            ballots = listOf(LikelyBallot(ids[0], ids[1]), LikelyBallot(ids[1], ids[0]), LikelyBallot(ids[2], ids[0]), LikelyBallot(ids[3], ids[0])),
            deltas = listOf(LikelyDelta(ids[3], 100, LikelyDeltaReason.AGREE)),
        )
        val pa = LikelyStage.revealPlan(LikelyTv.compose(st.view.room, pub.copy(reveal = a), env), false)!!
        val pb = LikelyStage.revealPlan(LikelyTv.compose(st.view.room, pub.copy(reveal = b), env), false)!!
        assertEquals(pa, pb)
        var t = 0.0
        while (t <= pa.timeline.totalMs) {
            for (id in ids) assertEquals(LikelyStage.revealExpression(pa, id, t), LikelyStage.revealExpression(pb, id, t))
            t += 50.0
        }
    }

    // ---------------------------------------------------------------- awards and results

    @Test fun awardsPagesFollowTheServerClock() {
        val v = LikelyFixtures.view("awards")
        val plan = LikelyStage.awardsPlan(v)
        assertEquals(4, plan.pages.size)
        assertEquals(LikelyAwardsPage.Intro, plan.pages[0])
        val trios = plan.pages.filterIsInstance<LikelyAwardsPage.Trio>()
        assertEquals(listOf(3, 2), trios.map { it.entries.size })
        assertTrue(plan.pages.last() is LikelyAwardsPage.MindReader)
        assertEquals(listOf(0L, 3_000L, 7_000L, 11_000L), plan.startsMs)
        assertEquals(0 to 0L, plan.at(0))
        assertEquals(1 to 500L, plan.at(3_500))
        assertEquals(3 to 3_999L, plan.at(14_999))
        assertEquals(3 to 9_000L, plan.at(20_000))
        // Tonight's Star rides on its holder's card; everyone holds exactly one signature or mystery award.
        val entries = LikelyStage.awardEntries(v)
        assertEquals(v.players.map { it.id }.toSet(), entries.map { it.playerId }.toSet())
        val star = entries.first { it.extras.any { e -> e.kind == LikelyAwardKind.STAR } }
        assertEquals(v.players[2].id, star.playerId)
        val mystery = entries.first { it.kind == LikelyAwardKind.MYSTERY }
        assertNull(mystery.card)
        val mind = plan.pages.last() as LikelyAwardsPage.MindReader
        assertEquals(v.players[0].id, mind.podium.first().playerId)
    }

    @Test fun secretAwardsHaveNoMindReaderAndNoRanking() {
        val v = LikelyFixtures.view("awards.secret.ar")
        val plan = LikelyStage.awardsPlan(v)
        assertTrue(plan.pages.none { it is LikelyAwardsPage.MindReader })
        assertTrue(LikelyStage.ranking(v).isEmpty())
        assertTrue(LikelyStage.ranking(LikelyFixtures.view("results.secret.ar")).isEmpty())
    }

    @Test fun rankingSharesTies() {
        val v = LikelyFixtures.view("results")
        val rows = LikelyStage.ranking(v)
        assertEquals(v.players.size, rows.size)
        for (i in 1 until rows.size) {
            assertTrue(rows[i - 1].score >= rows[i].score)
            if (rows[i - 1].score == rows[i].score) assertEquals(rows[i - 1].rank, rows[i].rank) else assertEquals(i + 1, rows[i].rank)
        }
        assertEquals(1, rows.first().rank)
    }

    // ---------------------------------------------------------------- helpers

    @Test fun percentUsesWesternDigitsAndLocaleSpacing() {
        assertEquals("50%", LikelyStage.percentText(50, "en"))
        assertEquals("50%", LikelyStage.percentText(50, "ar"))
        assertEquals("50 %", LikelyStage.percentText(50, "fr"))
        assertEquals("50 %", LikelyStage.percentText(50, "es"))
    }

    @Test fun namedSpanFindsThePlayer() {
        assertEquals(5 until 9, LikelyStage.namedSpan("kiss Maya at noon", "Maya"))
        assertEquals(11 until 15, LikelyStage.namedSpan("dance with Maya", "Maya"))
        assertNull(LikelyStage.namedSpan("dance", "Maya"))
        assertNull(LikelyStage.namedSpan("dance", null))
    }

    @Test fun cardCounterAndHold() {
        val c = LikelyFixtures.view("card.new")
        assertEquals(4, LikelyStage.cardNumber(c))
        val h = LikelyFixtures.view("hold")
        assertEquals(2, LikelyStage.holdCount(h))
        assertFalse(h.jury.isEmpty())
    }

    @Test fun cardExpressionOnlyMarksTheNamedPlayer() {
        val v = LikelyFixtures.view("card")
        assertTrue(v.players.all { LikelyStage.cardExpression(v, it.id) == Expression.IDLE })
        val named = v.copy(card = v.card!!.copy(namedPlayerId = v.players[1].id))
        assertEquals(Expression.SHY, LikelyStage.cardExpression(named, v.players[1].id))
    }

    // ---------------------------------------------------------------- Spicy gate (§9.1)

    @Test fun spicyGateDefaultsToCancelAndBackSendsNothing() {
        assertEquals(LikelySpicy.Button.CANCEL, LikelySpicy.DEFAULT_FOCUS)
        assertEquals(LikelySpicy.Button.CANCEL, LikelySpicy.BUTTONS.first())
        assertNull("Back", LikelySpicy.onDialogResult(null))
        assertNull("Cancel", LikelySpicy.onDialogResult(LikelySpicy.Button.CANCEL))
        val p = LikelySpicy.onDialogResult(LikelySpicy.Button.CONFIRM)!!
        assertEquals("spicy", (p["mode"] as kotlinx.serialization.json.JsonPrimitive).content)
        assertEquals("true", (p["ageConfirmed"] as kotlinx.serialization.json.JsonPrimitive).content)
        assertEquals("false", (p["showVoters"] as kotlinx.serialization.json.JsonPrimitive).content)
        assertFalse("compiled out while the platform has no actor", LikelySpicy.needsGate(LikelyMode.FAMILY, LikelyMode.SPICY))
        assertFalse(LikelySpicy.needsGate(LikelyMode.SPICY, LikelyMode.FAMILY))
    }

    // ---------------------------------------------------------------- G3 review: entrance, question, card fit, rail

    /** GAME-LIKELY §4: the first card's deadline carries the entrance grace; the deal waits it out, later cards do not. */
    @Test fun firstCardWaitsForTheWorldEntrance() {
        val v = LikelyFixtures.view("card")
        assertEquals(0, v.cardIndex)
        val rem = LikelyFixtures.remainingMs("card")
        assertEquals(LikelyTiming.CARD_MS + LikelyTiming.ENTRANCE_GRACE_MS, rem)
        val s = LikelyChoreo.cardStart(v.cardIndex, rem)
        assertEquals(LikelyChoreo.Start(-LikelyTiming.ENTRANCE_GRACE_MS.toInt(), 1.0), s)
        // Nothing is dealt (or heard) during the wait, in full and calm motion; the deal lands after it.
        val deal = LikelyChoreo.cardDeal.step("deal")
        for (reduced in listOf(false, true)) {
            assertEquals(0f, LikelyChoreo.progress(deal, s.atMs.toDouble(), reduced = reduced), 0f)
            assertEquals(0f, LikelyChoreo.progress(deal, -1.0, reduced = reduced), 0f)
            assertEquals(1f, LikelyChoreo.progress(deal, LikelyChoreo.cardDeal.totalMs.toDouble(), reduced = reduced), 0.02f)
        }
        assertTrue(LikelyChoreo.marksBetween(LikelyChoreo.cardDeal, s.atMs - 0.5, -1.0).isEmpty())
        assertEquals(listOf("likely.deal"), LikelyChoreo.marksBetween(LikelyChoreo.cardDeal, -0.5, 0.0).map { it.cue })
        // Mounted later in the grace: only the rest is waited; after it (or on later cards) the deal starts at once.
        assertEquals(LikelyChoreo.Start(-1_000, 1.0), LikelyChoreo.cardStart(0, LikelyTiming.CARD_MS + 1_000))
        assertEquals(LikelyChoreo.Start(0, 1.0), LikelyChoreo.cardStart(0, LikelyTiming.CARD_MS))
        assertEquals(LikelyChoreo.Start(0, 1.0), LikelyChoreo.cardStart(3, LikelyFixtures.remainingMs("card.new")))
        assertEquals(LikelyChoreo.Start(0, 1.0), LikelyChoreo.cardStart(0, null))
        // A grace longer than the platform's is never waited past ENTRANCE_GRACE_MS.
        assertEquals(LikelyChoreo.Start(-LikelyTiming.ENTRANCE_GRACE_MS.toInt(), 1.0), LikelyChoreo.cardStart(0, 60_000))
    }

    private val res: java.io.File get() = java.io.File(app.jamaa.tv.Fixtures.dir, "../../tv-app/app/src/main/res")

    /** The generated Android string (what the TV formats), unescaped, with %1$s as the {prompt} placeholder. */
    private fun androidString(locale: String, name: String): String {
        val dir = if (locale == "en") "values" else "values-$locale"
        val xml = java.io.File(res, "$dir/strings_game_likely.xml").readText(Charsets.UTF_8)
        val m = Regex("""<string name="$name">(.*?)</string>""").find(xml) ?: error("$name missing in $dir")
        return m.groupValues[1].replace("\\'", "'").replace("\\\"", "\"").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    }

    /** The card keeps each locale's own punctuation (¿…?, the narrow no-break space before ? in fr, ؟): never a hard-coded mark. */
    @Test fun cardQuestionKeepsEachLocalesPunctuation() {
        val expected = mapOf(
            "en" to ("Who's most likely to" to "?"),
            "fr" to ("Qui risque le plus" to " ?"),
            "ar" to ("مين فينا ممكن" to "؟"),
            "es" to ("¿Quién es más capaz de" to "?"),
        )
        val prompts = mapOf("en" to "cry at a wedding", "fr" to "de pleurer à un mariage", "ar" to "يبكي بعرس", "es" to "llorar en una boda")
        for ((loc, want) in expected) {
            val template = androidString(loc, "game__likely__card__question")
            val formatted = String.format(template, LikelyStage.QUESTION_MARK)
            val parts = LikelyStage.questionParts(formatted)
            assertEquals(loc, want, parts)
            // Lead-in + prompt + closing reads exactly as the whole question (the awards line uses the whole string).
            val prompt = prompts.getValue(loc)
            assertEquals(loc, String.format(template, prompt), parts.first + " " + prompt + parts.second)
            // Exactly one question mark of the locale's kind, and the Spanish pair stays a pair.
            val whole = String.format(template, prompt)
            assertEquals(loc, 1, whole.count { it == '?' || it == '؟' })
            if (loc == "es") assertTrue(whole.startsWith("¿") && whole.endsWith("?"))
        }
        assertEquals("en" to "", LikelyStage.questionParts("en"))
        assertEquals("cry at a wedding?", "cry at a wedding" + LikelyStage.questionParts("Who's most likely to ?").second)
    }

    private fun contentPrompts(): Map<String, List<String>> {
        val dir = java.io.File(app.jamaa.tv.Fixtures.dir, "../../content/likely")
        val out = LinkedHashMap<String, MutableList<String>>()
        for (f in dir.listFiles()!!.filter { it.name.endsWith(".json") }.sorted()) {
            val cards = kotlinx.serialization.json.Json.parseToJsonElement(f.readText(Charsets.UTF_8)).let { (it as kotlinx.serialization.json.JsonObject)["cards"] as kotlinx.serialization.json.JsonArray }
            for (c in cards) {
                val prompt = (c as kotlinx.serialization.json.JsonObject)["prompt"] as kotlinx.serialization.json.JsonObject
                // {player} resolves to a name: a long one (Names.ellipsize keeps names short on the TV, 12 is generous).
                for ((loc, p) in prompt) out.getOrPut(loc) { mutableListOf() } += (p as kotlinx.serialization.json.JsonPrimitive).content.replace("{player}", "Alexandrine")
            }
        }
        return out
    }

    /** Web `cardSize` tiers (graphemes), and every card of the decks fits the card without the run-time fallback. */
    @Test fun cardTypeStepsDownAndTheLongestPromptsFit() {
        assertEquals(0, LikelyStage.cardTier("cry at a wedding"))
        assertEquals(1, LikelyStage.cardTier("laugh at their own joke before the punchline"))
        assertEquals(2, LikelyStage.cardTier("de voir les voitures volantes et finir quand même dans les bouchons"))
        // Graphemes, not UTF-16 units: an emoji family or a combining mark counts once.
        assertEquals(3, LikelyStage.graphemes("áb👨‍👩‍👧"))
        val closing = mapOf("en" to "?", "fr" to " ?", "ar" to "؟", "es" to "?")
        val prompts = contentPrompts()
        assertEquals(setOf("en", "fr", "ar", "es"), prompts.keys)
        for ((loc, list) in prompts) {
            val arabic = loc == "ar"
            val longest = list.maxByOrNull { LikelyStage.graphemes(it) }!!
            val t = LikelyCardFit.tier(longest, closing.getValue(loc), arabic)
            assertTrue("$loc longest '$longest' needs the last-resort tier", t < LikelyCardFit.LATIN.lastIndex)
            assertTrue("$loc longest '$longest' does not fit at tier $t", LikelyCardFit.fits(longest + closing.getValue(loc), t, arabic))
            assertTrue("$loc longest prompt is set small", t >= 2)
            for (p in list) {
                val tp = LikelyCardFit.tier(p, closing.getValue(loc), arabic)
                assertTrue("$loc '$p'", LikelyCardFit.fits(p + closing.getValue(loc), tp, arabic))
                assertTrue("$loc '$p' never above its web tier", tp >= LikelyStage.cardTier(p))
            }
        }
        // The French example of the review: 67 graphemes, three lines of title on the card.
        val fr = "de voir les voitures volantes et finir quand même dans les bouchons"
        assertEquals(2, LikelyCardFit.tier(fr, " ?", arabicScale = false))
    }

    /** DESIGN-JAMAA §5.1/§5.3: the public-mode rail ticks from scoreBefore on the reveal's tick step; never with secret votes. */
    @Test fun scoreRailTicksInPublicModeOnly() {
        val v = LikelyFixtures.view("reveal")
        assertTrue(LikelyStage.showRail(v))
        val plan = LikelyStage.revealPlan(v, false)!!
        val tick = plan.timeline.step("tick")!!
        assertTrue("the counters roll after the coins land", tick.startMs >= plan.timeline.step("coin")!!.startMs)
        assertTrue(plan.timeline.marks.any { it.cue == "counterTick" && it.atMs == tick.startMs })
        assertEquals(app.jamaa.tv.game.Cue.COUNTER_TICK, LikelySounds.platformCue("counterTick"))
        val rami = v.players[0]
        assertEquals(0 to 200, rami.scoreBefore to rami.score)
        assertEquals(0, LikelyStage.railScore(v, rami, 0f))
        assertEquals(100, LikelyStage.railScore(v, rami, 0.5f))
        assertEquals(200, LikelyStage.railScore(v, rami, 1f))
        assertEquals(setOf(rami.id), LikelyStage.railLeaders(v))
        // Outside REVEAL the rail shows the score as is; secret votes never show it.
        assertEquals(rami.score, LikelyStage.railScore(v.copy(phase = LikelyPhase.VOTING), rami, 0f))
        assertFalse(LikelyStage.showRail(LikelyFixtures.view("reveal.secret.ar")))
        assertFalse(LikelyStage.showRail(LikelyFixtures.view("card.secret.ar")))
        assertTrue(LikelyStage.showRail(LikelyFixtures.view("voting")))
        assertFalse(LikelyStage.showRail(v.copy(phase = LikelyPhase.AWARDS)))
        assertEquals(0.0, LikelyStage.railHeight(LikelyFixtures.view("reveal.secret.ar")), 0.0)
        // Nobody leads before anyone scored.
        assertTrue(LikelyStage.railLeaders(LikelyFixtures.view("voting")).isEmpty())
    }

    /** 1–8 players in one row, 9–12 in two; every row fits the 864-unit stage. Left players are not on the rail. */
    @Test fun scoreRailFitsTwelvePlayers() {
        val base = LikelyFixtures.view("reveal")
        val proto = base.players[0]
        for (n in 1..12) {
            val players = (0 until n).map { proto.copy(id = "p$it", seat = it) }
            val v = base.copy(players = players)
            val rows = LikelyStage.railRows(v)
            assertEquals(n, rows.sumOf { it.size })
            assertEquals(if (n <= 8) 1 else 2, rows.size)
            for (r in rows) assertTrue("n=$n row ${r.size}", LikelyStage.railWidth(r.size) <= LikelyLayout.WIDTH)
            assertTrue(LikelyStage.railHeight(v) <= 72.0)
        }
        val left = base.copy(players = base.players.mapIndexed { i, p -> if (i == 1) p.copy(left = true) else p })
        assertFalse(LikelyStage.railRows(left).flatten().any { it.left })
    }

    @Test fun voteProgressCountsConnectedVoters() {
        val v = LikelyFixtures.view("voting.some_voted")
        assertEquals(2 to 4, LikelyStage.voteProgress(v))
        val off = v.copy(players = v.players.mapIndexed { i, p -> if (i == 3) p.copy(connected = false) else p })
        assertEquals(2 to 3, LikelyStage.voteProgress(off))
        assertEquals(4 to 4, LikelyStage.voteProgress(LikelyFixtures.view("voting.all_voted")))
    }

    /** Shared fitReveal: the hold starts where the beats end and fills the budget, ≥ 2 s when the window allows it. */
    @Test fun revealHoldFillsTheServerWindow() {
        for (v in 1..12) for (pub in listOf(false, true)) {
            val r = reveal(v)
            val t = tl(r, pub, v)
            val budget = maxOf(2_000L, LikelyTiming.revealMs(v, false, 1) - LikelyChoreo.REVEAL_TAIL_MS).toInt()
            val hold = t.step("hold")!!
            assertEquals("v=$v pub=$pub", budget.toDouble(), (hold.startMs + hold.durationMs).toDouble(), 1.0)
            assertTrue("v=$v pub=$pub hold ${hold.durationMs}", hold.durationMs >= LikelyChoreo.HOLD_FLOOR_MS)
            for (s in t.steps.filter { it.id != "hold" }) assertTrue("${s.id} overlaps the hold", s.startMs <= hold.startMs + 1)
        }
        // A 4-player public card keeps ≥ 2 s of "defend yourself".
        assertTrue(tl(reveal(4), true, 3).step("hold")!!.durationMs >= LikelyChoreo.HOLD_MIN_MS)
        assertEquals(8_000L, LikelyTiming.revealMs(4, false, 1))
        assertEquals(12_000L, LikelyTiming.revealMs(40, true, 1))
        assertEquals(LikelyChoreo.boardMs(3), 1_800 + 360)
    }
}
