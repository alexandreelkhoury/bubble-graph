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

    @Test fun everyRevealTimelineFitsTheServerDuration() {
        for (v in 0..12) for (tops in 1..maxOf(1, v)) for (u in listOf(false, true)) for (anon in listOf(false, true)) {
            if (u && tops > 1) continue
            val r = reveal(v, u, tops, none = v == 0)
            val tl = LikelyChoreo.reveal(r, anon, runners = v, coins = v, boardLines = tops + 1)
            val budget = LikelyTiming.revealMs(v, u, tops)
            assertTrue("v=$v tops=$tops u=$u anon=$anon: ${tl.totalMs} > $budget", tl.totalMs <= budget)
            for (m in tl.marks) assertTrue("${m.cue} at ${m.atMs}", m.atMs in 0..tl.totalMs)
            for (s in tl.steps) assertTrue(s.id, Choreo.easings.containsKey(s.easing))
        }
        assertTrue(LikelyChoreo.reveal(reveal(4, chaos = true), false, 0, 0, 0).totalMs <= LikelyTiming.REVEAL_MIN_MS)
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
        val tl = LikelyChoreo.reveal(reveal(4), false, 3, 2, 0)
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
        val tl = LikelyChoreo.reveal(reveal(4), false, 3, 2, 0)
        assertEquals(listOf("sfx.drumroll"), LikelyChoreo.marksBetween(tl, -1.0, 0.0).map { it.cue })
        assertTrue(LikelyChoreo.marksBetween(tl, 0.0, tl.totalMs.toDouble()).isEmpty())
        val toks = LikelyChoreo.marksBetween(tl, 0.0, 1_600.0).filter { it.cue == "likely.tok" }
        assertTrue(toks.isNotEmpty())
    }

    @Test fun everyCueHasAPlatformSound() {
        for (id in SoundCuesLikely.cues.keys) assertNotNull(id, LikelySounds.platformCue(id))
        val timelines = listOf(LikelyChoreo.cardDeal, LikelyChoreo.awardsTrio, LikelyChoreo.mindReader, LikelyChoreo.awardsIntro) +
            listOf(false, true).flatMap { a -> listOf(reveal(4), reveal(4, true), reveal(4, chaos = true), reveal(0, none = true)).map { LikelyChoreo.reveal(it, a, 3, 3, 2) } }
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
        // Léa and Noor line up behind Rami (places 1, 2), Sam behind Léa.
        val seats = plan.seats
        assertEquals(LikelyLayout.congaSlot(seats.getValue(rami), 1), plan.endOf(lea))
        assertEquals(LikelyLayout.congaSlot(seats.getValue(rami), 2), plan.endOf(noor))
        assertEquals(LikelyLayout.congaSlot(seats.getValue(lea), 1), plan.endOf(sam))
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
        assertTrue(plan.runners.isEmpty() && plan.coins.isEmpty())
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
        assertNull(plan.timeline.step("coins"))
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
}
