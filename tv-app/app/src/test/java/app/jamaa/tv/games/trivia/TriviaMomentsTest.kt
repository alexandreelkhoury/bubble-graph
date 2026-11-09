package app.jamaa.tv.games.trivia

import app.jamaa.tv.Constants
import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.ChoreoSampler
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Quiz Night's step lists (GAME-TRIVIA §12, DESIGN-JAMAA §5.4), sampled by the platform's shared sampler. */
class TriviaMomentsTest {
    private fun all(reduced: Boolean) = listOf(
        TriviaMoments.quizIntro(5, reduced),
        TriviaMoments.read(reduced),
        TriviaMoments.answer(4, reduced),
        TriviaMoments.reveal(12, 12, explain = true, stumped = false, reduced = reduced),
        TriviaMoments.reveal(5, 0, explain = true, stumped = true, reduced = reduced),
        TriviaMoments.leaderboard(8, reduced),
        TriviaMoments.finalIntro(reduced),
        TriviaMoments.results(3, reduced),
    )

    @Test
    fun everyStepUsesAPlatformEasingAndTheSharedSampler() {
        for (m in all(false) + all(true)) for (s in m.steps) {
            assertNotNull("${m.id}/${s.id} ${s.step.easing}", Choreo.easings[s.step.easing])
            assertEquals(0f, s.progress(s.startMs - 1L), 0f)
            assertEquals(1f, s.progress(s.endMs), 0f)
            // Same numbers as sampling the step directly (no private curve on the TV side).
            val mid = (s.startMs + s.endMs) / 2
            assertEquals(ChoreoSampler.sample(s.step, mid.toDouble()).toFloat(), s.progress(mid), 1e-6f)
        }
    }

    /** GAME-TRIVIA §12.3: the script fits its 6 s (+3 s fact) even with 12 jumpers and 12 coins. */
    @Test
    fun theRevealScriptKeepsItsTimings() {
        val m = TriviaMoments.reveal(12, 12, explain = false, stumped = false, reduced = false)
        fun end(id: String, n: Int = 1): Long {
            val st = m.step(id)!!.step
            return (st.startMs + st.staggerMs * (n - 1) + st.durationMs).toLong()
        }
        assertEquals(0L, m.step("lock")!!.startMs)
        assertEquals(300L, m.step("wrongOut")!!.startMs)
        assertEquals(900L, m.step("jump")!!.startMs)
        assertTrue(end("jump", 12) <= 2_400)
        assertEquals(2_400L, m.step("fastest")!!.startMs)
        assertEquals(3_000L, m.step("coin")!!.startMs)
        assertTrue(end("coin", 12) <= 4_500)
        assertEquals(4_500L, m.step("reorder")!!.startMs)
        assertTrue(m.totalMs <= 6_000)
        assertNull(m.step("explain"))
        val fact = TriviaMoments.reveal(4, 3, explain = true, stumped = false, reduced = false)
        assertEquals(6_000L, fact.step("explain")!!.startMs)
        assertTrue(fact.totalMs <= 9_000)
        // Stumped: lock, all tiles out, the "dun-dun" stamp; no jump, bolt or coins.
        val stumped = TriviaMoments.reveal(5, 0, explain = false, stumped = true, reduced = false)
        assertNull(stumped.step("jump"))
        assertNull(stumped.step("coin"))
        assertNull(stumped.step("fastest"))
        assertNotNull(stumped.step("stamp"))
    }

    /** Calm motion: no travel, everything else a ≤ 200 ms fade (DESIGN-JAMAA §5.4 "Reduced motion"). */
    @Test
    fun calmMotionDropsTravelAndFadesTheRest() {
        for (m in all(true)) {
            assertTrue(m.id, m.reduced)
            for (s in m.steps) {
                assertTrue("${m.id}/${s.id}", s.step.durationMs <= TriviaMoments.REDUCED_FADE_MS)
                assertEquals(0, s.step.staggerMs)
                assertFalse("${m.id}/${s.id} is travel", s.id in setOf("coin", "badgePop", "counter", "spin", "tiles", "bars", "hop", "confetti"))
            }
        }
        val r = TriviaMoments.reveal(4, 3, explain = false, stumped = false, reduced = true)
        assertTrue(r.totalMs <= TriviaMoments.REORDER_AT + TriviaMoments.REDUCED_FADE_MS)
    }

    @Test
    fun aMomentForEveryFixturePhase() {
        for (name in TriviaFixtures.tvPhases) {
            val v = TriviaFixtures.view(name)
            val m = TriviaMoments.of(v, reduced = false)
            if (v.phase == TriviaPhase.HOLD) assertEquals(0L, m.totalMs) else assertTrue(name, m.totalMs > 0)
            assertTrue(TriviaMoments.key(v).contains(v.phase.name))
        }
        assertNull(TriviaMoments.of(TriviaFixtures.view("reveal.stumped"), false).step("coin"))
        assertNotNull(TriviaMoments.of(TriviaFixtures.view("reveal.genius"), false).step("explain"))
    }

    /** The quiz card waits for the platform entrance: QUIZ_INTRO = ENTRANCE_GRACE_MS + 4 000 (GAME-TRIVIA §4.1). */
    @Test
    fun theQuizIntroStartsAfterTheEntrance() {
        val v = TriviaFixtures.view("quiz_intro")
        assertEquals(6_500L, v.durationMs)
        val phaseStart = v.deadline!! - v.durationMs!!
        assertEquals(0L, TriviaMoments.elapsed(v, phaseStart + 2_000, 0))
        assertEquals(0L, TriviaMoments.elapsed(v, phaseStart + 2_500, 0))
        assertEquals(400L, TriviaMoments.elapsed(v, phaseStart + 2_900, 0))
        // Other phases: from the server start; no deadline: from when the screen first showed it.
        val r = TriviaFixtures.view("reveal")
        assertEquals(1_000L, TriviaMoments.elapsed(r, r.deadline!! - r.durationMs!! + 1_000, 0))
        val res = TriviaFixtures.view("results")
        assertEquals(700L, TriviaMoments.elapsed(res, 10_700, 10_000))
        assertEquals(5, TriviaMoments.chips(3, 6)) // domain + 3 topics + "+n"
        assertEquals(3, TriviaMoments.chips(2, 2))
    }

    /** Platform §3.10 E in game: OK only completes; on results the buttons wait for the podium and the 400 ms guard. */
    @Test
    fun okCompletesAndMashingThroughThePodiumNeverReplays() {
        val m = TriviaMoments.results(3, reduced = false)
        assertTrue(TriviaInput.okCompletes(100, m, completed = false))
        assertFalse(TriviaInput.okCompletes(100, m, completed = true))
        assertFalse(TriviaInput.okCompletes(m.totalMs, m, completed = false))
        assertFalse(TriviaInput.okCompletes(0, TriviaMoments.NONE, completed = false))
        // OK ×3 within 300 ms: the first completes the podium, the next two land inside the guard.
        val started = 1_000L
        val okAt = listOf(1_100L, 1_200L, 1_390L)
        val interactive = TriviaInput.interactiveAt(started, m, completedAtMs = okAt[0])
        assertEquals(1_100L, interactive)
        assertFalse(TriviaInput.buttonsReady(okAt[1], interactive))
        assertFalse(TriviaInput.buttonsReady(okAt[2], interactive))
        assertTrue(TriviaInput.buttonsReady(interactive + Constants.INPUT_GUARD_MS, interactive))
        // Without OK the guard starts at the natural end.
        assertEquals(started + m.totalMs, TriviaInput.interactiveAt(started, m, null))
    }
}
