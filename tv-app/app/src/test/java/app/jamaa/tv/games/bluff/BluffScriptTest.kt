package app.jamaa.tv.games.bluff

import app.jamaa.tv.platform.Expression
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The reveal script (GAME-BLUFF §12.2 / §12.2.1, DESIGN-JAMAA §5.2) against lane A's fixtures and engine-built reveals:
 * order, timing (equal to the server's REVEAL deadline), coins carrying exactly the server's points, the sprite cap,
 * OK-completion, calm motion and the character expressions.
 */
class BluffScriptTest {
    private val all = BluffFixtures.allReveals()

    private fun script(name: String, reduced: Boolean = false): BluffScript {
        val (_, r, s) = all.first { it.first == name }
        return BluffScript.build(r, s, reduced)
    }

    @Test fun samplesCoverEveryShapeTheFixturesMiss() {
        val r = BluffFixtures.samples.mapValues { it.value.reveal }
        assertTrue(r.getValue("finalTop").final && r.getValue("finalTop").steps.any { it.top })
        assertTrue(r.getValue("finalTop").steps.any { it.kind == OptionKind.HOUSE })
        assertTrue(r.getValue("quickHits").steps.any { it.quick })
        assertTrue(r.getValue("houseLie").steps.any { it.kind == OptionKind.HOUSE && it.voteCount >= 2 })
        assertTrue(r.getValue("helped").steps.any { it.helped })
        assertTrue(r.getValue("finalCoAuthors").steps.any { it.authorIds.size > 1 })
        assertTrue(r.getValue("foundEarly").steps.any { it.foundEarlyIds.isNotEmpty() })
        assertTrue(r.getValue("bigVote").steps.any { it.voteCount >= 7 })
        assertTrue(r.getValue("spotOnNoVoters").spotOnDeltas.isNotEmpty())
    }

    /** Full motion plays exactly the server's REVEAL length (`revealDurationMs`), so it never ends after the deadline. */
    @Test fun totalEqualsTheServerRevealDuration() {
        for ((name, r, s) in all) {
            assertEquals(name, r.durationMs, BluffScript.build(r, s, reduced = false).totalMs)
            assertEquals(name, r.durationMs, BluffScript.naturalDurationMs(r))
        }
        for ((r, s) in BluffFixtures.corpus()) assertEquals(r.durationMs, BluffScript.build(r, s, false).totalMs)
    }

    /** Calm motion: same order, half the time (DESIGN-JAMAA §5.2 "Reveal time halves"), every beat a short fade. */
    @Test fun calmMotionHalvesTheRevealAndKeepsTheOrder() {
        for ((name, r, s) in all) {
            val full = BluffScript.build(r, s, false)
            val calm = BluffScript.build(r, s, true)
            assertEquals(name, full.segments.map { it.kind to it.step?.optionId }, calm.segments.map { it.kind to it.step?.optionId })
            assertTrue(name, calm.totalMs <= (r.durationMs + 1) / 2 + calm.segments.size)
            for (seg in calm.segments) for (sub in seg.subs) {
                assertEquals("$name ${seg.kind} ${sub.id}", "ease.standard", sub.step.easing)
                assertTrue(sub.step.durationMs <= 200)
            }
            assertEquals(name, full.pillValue("x", Long.MAX_VALUE), calm.pillValue("x", Long.MAX_VALUE))
        }
    }

    /** GAME-BLUFF §12.2: quick hits first, then lies fewest votes first, the truth last; then montage, then likes. */
    @Test fun segmentOrderFollowsTheSpec() {
        for ((name, r, s) in all) {
            val segs = BluffScript.build(r, s, false).segments
            assertEquals(name, SegmentKind.INTRO, segs.first().kind)
            if (r.final) {
                assertTrue(name, segs.none { it.kind == SegmentKind.TRUTH || it.kind == SegmentKind.LIE })
                val answers = segs.filter { it.kind == SegmentKind.FINAL_ANSWER }.map { it.step!!.voteCount }
                assertEquals(name, answers.sorted(), answers)
                val tail = segs.map { it.kind }.dropWhile { it != SegmentKind.CROWN }
                assertEquals(name, listOf(SegmentKind.CROWN, SegmentKind.TWIST), tail.take(2))
            } else {
                val kinds = segs.map { it.kind }
                val truthAt = kinds.indexOf(SegmentKind.TRUTH)
                assertTrue(name, truthAt > 0)
                assertTrue(name, kinds.subList(1, truthAt).all { it == SegmentKind.QUICK || it == SegmentKind.LIE || it == SegmentKind.HOUSE })
                val quick = kinds.subList(1, truthAt).takeWhile { it == SegmentKind.QUICK }.size
                assertTrue(name, kinds.subList(1 + quick, truthAt).none { it == SegmentKind.QUICK })
                val full = segs.subList(1 + quick, truthAt).map { it.step!!.voteCount }
                assertEquals(name, full.sorted(), full)
                if (r.steps.count { it.kind != OptionKind.TRUTH && it.voteCount > 0 } > 5) assertTrue(name, quick > 0)
            }
            val after = segs.map { it.kind }.takeLastWhile { it == SegmentKind.NOBODY || it == SegmentKind.LIKES }
            if (r.unpicked.isNotEmpty()) assertTrue(name, SegmentKind.NOBODY in after)
            assertEquals(name, after.sortedBy { it.ordinal }, after)
            // Segments tile the timeline with no gap.
            for (i in 1 until segs.size) assertEquals(name, segs[i - 1].endMs, segs[i].startMs)
        }
    }

    /** Every sub-step ends inside its segment, before its hold beat, with all its staggered elements. */
    @Test fun subStepsFitTheirSegment() {
        for ((name, r, s) in all) for (reduced in listOf(false, true)) {
            val sc = BluffScript.build(r, s, reduced)
            for (seg in sc.segments) for (sub in seg.subs) {
                val n = when (sub.id) {
                    "jump" -> seg.step?.voteCount ?: 1
                    "pins" -> seg.step?.spotOnIds?.size ?: 1
                    "envelopes" -> minOf(seg.step?.voteCount ?: 1, 12)
                    else -> 1
                }
                assertTrue("$name ${seg.kind} ${sub.id} (reduced=$reduced)", seg.startMs + sub.endFor(n) <= seg.endMs)
            }
            for (c in sc.coins) {
                val seg = sc.segments[c.segment]
                assertTrue("$name coin lands inside its segment", c.launchAtMs >= seg.startMs && c.landAtMs <= seg.endMs)
            }
        }
    }

    /** Coins carry exactly the server's points: at the end every pill equals the server score (scores never go down). */
    @Test fun pillsLandOnTheServerScores() {
        for ((name, r, s) in all) for (reduced in listOf(false, true)) {
            val sc = BluffScript.build(r, s, reduced)
            for (line in s) {
                assertEquals("$name ${line.playerId}", line.score, sc.pillValue(line.playerId, sc.totalMs))
                var prev = Int.MIN_VALUE
                var t = 0L
                while (t <= sc.totalMs) {
                    val v = sc.pillValue(line.playerId, t)
                    assertTrue("$name pill never goes down", v >= prev)
                    prev = v
                    t += 97
                }
            }
            // Before the first coin a pill shows the start of the prompt plus the Spot-on points already paid.
            for (line in s) {
                val spot = r.spotOnDeltas.filter { it.playerId == line.playerId }.sumOf { it.points }
                assertEquals(name, line.scoreBefore + spot, sc.pillValue(line.playerId, 0))
            }
        }
        for ((r, s) in BluffFixtures.corpus()) {
            val sc = BluffScript.build(r, s, false)
            for (line in s) assertEquals(line.score, sc.pillValue(line.playerId, sc.totalMs))
        }
    }

    @Test fun coinsComeFromTheRightPlaceAndStayUnderTheSpriteCap() {
        for ((name, r, s) in all) {
            val sc = BluffScript.build(r, s, false)
            var t = 0L
            while (t < sc.totalMs) {
                assertTrue("$name ≤ 24 sprites", sc.coinsInFlight(t).size <= BluffScript.MAX_SPRITES)
                t += 20
            }
            for (c in sc.coins) {
                val seg = sc.segments[c.segment]
                when (seg.kind) {
                    // Final: ballots stay anonymous, coins leave a neutral ballot box (GAME-BLUFF §6.5).
                    SegmentKind.FINAL_ANSWER -> assertEquals(name, CoinSource.BallotBox, c.from)
                    SegmentKind.LIE, SegmentKind.QUICK -> assertTrue(name, c.from is CoinSource.Voter && (c.from as CoinSource.Voter).playerId in seg.step!!.voterIds)
                    SegmentKind.TRUTH, SegmentKind.CROWN -> assertTrue(name, c.from is CoinSource.Card)
                    SegmentKind.LIKES -> assertTrue(name, c.heart)
                    else -> error("$name: coin in ${seg.kind}")
                }
                // The house never scores; a coin never targets a house option.
                if (seg.kind == SegmentKind.HOUSE) error("$name: house coin")
            }
            // First coin of each award carries the label of the whole award.
            for ((_, g) in sc.coins.groupBy { Triple(it.segment, it.toPlayerId, it.heart) }) {
                assertEquals(name, g.sumOf { it.amount }, g.first().label)
                assertTrue(name, g.drop(1).all { it.label == null })
            }
        }
    }

    /** The fixture reveal: Léa's lie fooled نور and Sam (2 coins of 60), she found the truth (+100), Rami was Spot on. */
    @Test fun fixtureRevealStoryboard() {
        val sc = script("fixture:reveal")
        val lea = "p_1b2c3d4e5f60718293a4b5c6"
        val rami = "p_0a1b2c3d4e5f60718293a4b5"
        assertEquals(listOf(SegmentKind.INTRO, SegmentKind.LIE, SegmentKind.TRUTH, SegmentKind.NOBODY, SegmentKind.LIKES), sc.segments.map { it.kind })
        val lie = sc.coins.filter { it.segment == 1 }
        assertEquals(listOf(60, 60), lie.map { it.amount })
        assertEquals(setOf("p_2c3d4e5f60718293a4b5c6d7", "p_3d4e5f60718293a4b5c6d7e8"), lie.map { (it.from as CoinSource.Voter).playerId }.toSet())
        assertEquals(listOf(100), sc.coins.filter { it.segment == 2 }.map { it.amount })
        assertEquals(150, sc.pillValue(rami, 0)) // Spot on: paid at VOTING, shown from the start
        assertEquals(0, sc.pillValue(lea, 0))
        assertEquals(220, sc.pillValue(lea, sc.totalMs))
        // Expressions: voters facepalm after the stamp, Léa smug after popping out, finders cheer, Spot-on happy.
        val lieSeg = sc.segments[1]
        val afterStamp = lieSeg.startMs + lieSeg.sub("stamp")!!.endMs
        assertEquals(Expression.FACEPALM, sc.expressionOf("p_2c3d4e5f60718293a4b5c6d7", afterStamp))
        assertEquals(Expression.SMUG, sc.expressionOf(lea, lieSeg.startMs + lieSeg.sub("liar")!!.endMs))
        val truth = sc.segments[2]
        val t = truth.startMs + truth.sub("stamp")!!.endMs
        assertEquals(Expression.CHEER, sc.expressionOf(lea, t))
        assertEquals(Expression.HAPPY, sc.expressionOf(rami, t))
        assertEquals(Expression.SAD, sc.expressionOf("p_3d4e5f60718293a4b5c6d7e8", t))
        assertNull(sc.expressionOf("p_4e5f60718293a4b5c6d7e8f9", t))
        assertEquals(Expression.SAD, sc.expressionOf("p_2c3d4e5f60718293a4b5c6d7", sc.segments[3].startMs + 10))
    }

    /** Nobody voted for the truth: "Nobody saw that coming!" and every character is shocked. */
    @Test fun nobodyFoundTheTruth() {
        val sc = script("fixture:reveal.final") // a round-2 fixture where the truth got no vote
        assertTrue(sc.nobodyFound)
        val truth = sc.segments.first { it.kind == SegmentKind.TRUTH }
        val t = truth.startMs + truth.sub("stamp")!!.endMs
        for (p in sc.base.keys) assertEquals(Expression.SHOCK, sc.expressionOf(p, t))
        assertFalse(script("fixture:reveal").nobodyFound)
    }

    @Test fun finalCrownTwistAndAnonymousBallots() {
        val name = "engine:finalTop"
        val sc = script(name)
        val r = sc.reveal
        assertTrue(r.steps.all { it.voterIds.isEmpty() })
        val crown = sc.segments.first { it.kind == SegmentKind.CROWN }
        val convincing = r.steps.flatMap { st -> st.deltas.filter { it.reason == DeltaReason.CONVINCING } }
        assertEquals(convincing.sumOf { it.points }, sc.coins.filter { it.segment == crown.index }.sumOf { it.amount })
        val tops = r.steps.filter { it.top }.flatMap { it.authorIds }
        for (a in tops) assertEquals(Expression.CHEER, sc.expressionOf(a, crown.startMs + crown.sub("crown")!!.endMs))
        val twist = sc.segments.first { it.kind == SegmentKind.TWIST }
        for (p in sc.base.keys) assertEquals(Expression.LAUGH, sc.expressionOf(p, twist.startMs + 1))
        // A house answer with votes pops the house character, never pays anyone.
        val house = sc.segments.first { it.kind == SegmentKind.FINAL_ANSWER && it.step!!.kind == OptionKind.HOUSE }
        assertTrue(sc.coins.none { it.segment == house.index })
    }

    @Test fun okCompletesToTheEndState() {
        val sc = script("engine:quickHits")
        assertTrue(BluffInput.okCompletes(0, sc.totalMs, completed = false))
        assertTrue(BluffInput.okCompletes(sc.totalMs - 1, sc.totalMs, completed = false))
        assertFalse(BluffInput.okCompletes(sc.totalMs, sc.totalMs, completed = false))
        assertFalse(BluffInput.okCompletes(10, sc.totalMs, completed = true))
        // The end state: every option stamped, every pill on its final score, nothing in the air.
        assertEquals(sc.segments.count { it.step != null }, sc.stamped(sc.totalMs).size)
        assertTrue(sc.coinsInFlight(sc.totalMs).isEmpty())
        for (seg in sc.segments) for (sub in seg.subs) assertEquals(1f, seg.p(sub.id, sc.totalMs, 0), 0f)
    }

    /** DESIGN-JAMAA §4.3: before REVEAL nothing in the script exists; in REVEAL a stamp never precedes its own segment. */
    @Test fun stampsAppearOnlyInTheirOwnSegment() {
        for ((name, r, s) in all) {
            val sc = BluffScript.build(r, s, false)
            for (seg in sc.segments) {
                val st = seg.step ?: continue
                assertFalse(name, st in sc.stamped(seg.startMs))
                assertTrue(name, st in sc.stamped(seg.endMs))
            }
        }
    }

    @Test fun cueTrackIsTimedInsideTheScriptAndCapsLandingTicks() {
        for ((name, r, s) in all) {
            val sc = BluffScript.build(r, s, false)
            val track = BluffCues.reveal(sc)
            assertTrue(name, track.isNotEmpty())
            assertEquals(name, track.sortedBy { it.atMs }, track)
            assertTrue(name, track.all { it.atMs in 0..sc.totalMs })
            for (seg in sc.segments) {
                val lands = track.count { it.atMs in seg.startMs until seg.endMs && it.play.cue == app.jamaa.tv.game.Cue.COIN_LAND }
                assertTrue(name, lands <= BluffCues.MAX_LAND_TICKS)
            }
        }
    }
}
