package app.jamaa.tv.games.bluff

import app.jamaa.tv.Constants
import app.jamaa.tv.game.Cue
import app.jamaa.tv.platform.RemoteKey
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Phase moments, the remote rule, the corkboard layout (1/2 columns, RTL), the hide picker, ranking and cues. */
class BluffStageTest {

    // ---------------------------------------------------------------- moments (GAME-BLUFF §12, DESIGN-JAMAA §5.2)

    /**
     * Lane A has no final-round ("No truth") fixture yet: its `*.final` files are round-2 states (SPEC-GAP in the lane
     * report). The final's ROUND_INTRO / WRITING are derived from the round-1 fixtures with the final's public fields.
     */
    private fun asFinal(v: BluffView) = v.copy(round = 3, roundKind = RoundKind.NO_TRUTH, multiplier = 1, promptIndex = v.promptCount - 1)

    private fun view(s: String): BluffView = when (s) {
        "round_intro.noTruth" -> asFinal(BluffFixtures.view("round_intro"))
        "writing.noTruth" -> asFinal(BluffFixtures.view("writing"))
        else -> BluffFixtures.view(s)
    }

    @Test fun everyPhaseHasAMomentThatFitsItsServerPhase() {
        for (s in listOf("round_intro", "round_intro.fact", "round_intro.noTruth", "writing", "writing.noTruth", "voting", "voting.final", "scores", "awards", "results", "hold")) {
            val v = view(s)
            for (reduced in listOf(false, true)) {
                val m = BluffMoments.of(v, reduced)
                assertTrue("$s has steps", m.steps.isNotEmpty())
                BluffMoments.phaseLengthMs(v)?.let { len -> assertTrue("$s ${m.totalMs} ≤ $len", m.totalMs <= len) }
                if (reduced) assertTrue(s, m.steps.all { it.step.durationMs <= 150 })
                for (st in m.steps) assertTrue(st.step.easing, st.step.easing in app.jamaa.tv.motion.Choreo.easings)
            }
        }
    }

    @Test fun theFinalRoundCardStampsNoTruthAndRunsLonger() {
        val fin = view("round_intro.noTruth")
        assertTrue(fin.isFinal)
        assertTrue(BluffMoments.of(fin, false).step("stamp") != null)
        assertNull(BluffMoments.of(BluffFixtures.view("round_intro"), false).step("stamp"))
        assertEquals(6_000L, BluffMoments.phaseLengthMs(fin))
        assertEquals(4_000L, BluffMoments.phaseLengthMs(BluffFixtures.view("round_intro.fact")))
    }

    /** Award cards arrive on the server's own schedule (`2 500 + 3 500 × n`), also in calm motion. */
    @Test fun awardCardsArriveOnTheServerSchedule() {
        val v = BluffFixtures.view("awards")
        assertEquals(2, v.awards.size)
        for (reduced in listOf(false, true)) {
            val m = BluffMoments.of(v, reduced)
            val card = m.step("card")!!
            for (i in v.awards.indices) {
                assertEquals(0f, card.progress(BluffMoments.awardAtMs(i) - 1, i), 0f)
                assertEquals(1f, card.progress(BluffMoments.awardAtMs(i) + 600, i), 0f)
            }
        }
        assertEquals(2_500L + 3_500L * 2, BluffMoments.phaseLengthMs(v))
    }

    /** A TV that (re)joins mid-phase lands on the right frame; the first round card waits under the café entrance. */
    @Test fun elapsedComesFromTheServerDeadline() {
        val st = BluffFixtures.tv("reveal")
        val v = BluffFixtures.view("reveal")
        val start = v.deadline!! - v.reveal!!.durationMs
        assertEquals(0L, BluffMoments.elapsedAtFirstSight(v, start))
        assertEquals(5_000L, BluffMoments.elapsedAtFirstSight(v, start + 5_000))
        assertEquals(v.reveal!!.durationMs, BluffMoments.elapsedAtFirstSight(v, v.deadline!! + 9_999))
        assertTrue(BluffMoments.elapsedAtFirstSight(v, st.serverNow) >= 0)
        // First ROUND_INTRO: deadline = start + 4 000 + ENTRANCE_GRACE_MS → negative elapsed (waits for the entrance).
        val intro = BluffFixtures.view("round_intro")
        val introStart = intro.deadline!! - 4_000 - Constants.ENTRANCE_GRACE_MS
        assertEquals(-Constants.ENTRANCE_GRACE_MS, BluffMoments.elapsedAtFirstSight(intro, introStart))
        assertEquals(0L, BluffMoments.elapsedAtFirstSight(BluffFixtures.view("writing"), 0))
    }

    @Test fun momentKeysRestartOnAPromptSwap() {
        val w = BluffFixtures.view("writing")
        val swapped = w.copy(prompt = w.prompt!!.copy(id = "00000000"), notice = BluffNotice.TOO_FAMOUS)
        assertTrue(BluffMoments.key(w) != BluffMoments.key(swapped))
        assertEquals(BluffMoments.key(w), BluffMoments.key(w.copy(players = w.players.map { it.copy(submitted = true) })))
    }

    /** "Knew it!" opens round-1 VOTING only when someone was Spot on; the pins wait for it. */
    @Test fun knewItBannerLeadsTheVotingPins() {
        val v = BluffFixtures.view("voting")
        val spot = v.copy(players = v.players.mapIndexed { i, p -> p.copy(spotOn = i == 0) }, round = 1)
        val plain = v.copy(players = v.players.map { it.copy(spotOn = false) })
        assertEquals(BluffMoments.KNEW_IT_MS.toInt(), BluffMoments.of(spot, false).step("pins")!!.step.startMs)
        assertEquals(0, BluffMoments.of(plain, false).step("pins")!!.step.startMs)
        assertNull(BluffMoments.of(plain, false).step("knewIt"))
    }

    // ---------------------------------------------------------------- the remote rule (JAMAA-PLATFORM §3.10 E)

    @Test fun resultsButtonsWaitForTheGuardAndIgnoreRepeats() {
        assertFalse(BluffInput.resultsAccepts(10_000, null, 0)) // podium still running
        assertFalse(BluffInput.resultsAccepts(10_000, 9_800, 0)) // inside INPUT_GUARD_MS
        assertTrue(BluffInput.resultsAccepts(10_000, 9_600, 0))
        assertFalse(BluffInput.resultsAccepts(10_000, 9_600, 1)) // key repeat never activates
        // OK mashed every 100 ms through the end of the final reveal and the podium never presses Play again early.
        val podium = BluffMoments.of(BluffFixtures.view("results"), false).totalMs
        var accepted = false
        var t = 0L
        var completedAt: Long? = null
        while (t < podium + Constants.INPUT_GUARD_MS) {
            if (completedAt == null && BluffInput.okCompletes(t, podium, false)) completedAt = t // first OK completes
            else if (BluffInput.resultsAccepts(t, completedAt, 0)) accepted = true
            t += 100
            if (completedAt != null && t < completedAt + Constants.INPUT_GUARD_MS) assertFalse(accepted)
        }
    }

    // ---------------------------------------------------------------- corkboard layout (GAME-BLUFF §8.2, §13.4)

    @Test fun oneColumnUpToSixOptionsTwoColumnsUpToThirteen() {
        for (n in 2..6) assertEquals(1, BluffBoard.columns(n))
        for (n in 7..13) assertEquals(2, BluffBoard.columns(n))
        assertEquals(7, BluffBoard.rows(13))
        assertEquals(4, BluffBoard.rows(4))
        assertTrue(BluffBoard.easyOne(2))
        assertFalse(BluffBoard.easyOne(3))
    }

    @Test fun rtlMirrorsTheTwoColumnLayoutAndNotTheSingleColumn() {
        for (n in 7..13) for (i in 0 until n) {
            val ltr = BluffBoard.cell(i, n, rtl = false)
            val rtl = BluffBoard.cell(i, n, rtl = true)
            assertEquals(ltr.row, rtl.row)
            assertEquals(1 - ltr.col, rtl.col)
        }
        assertEquals(Cell(0, 0), BluffBoard.cell(0, 9, rtl = false))
        assertEquals(Cell(1, 0), BluffBoard.cell(0, 9, rtl = true)) // reading starts at the right edge in Arabic
        for (i in 0 until 5) assertEquals(BluffBoard.cell(i, 5, false), BluffBoard.cell(i, 5, true))
        // Every cell is used once.
        for (n in 2..13) assertEquals(n, (0 until n).map { BluffBoard.cell(it, n, true) }.toSet().size)
        // Seats spread over the row, mirrored in RTL.
        assertEquals(50f, BluffBoard.seatX(0, 4, 400f, false), 0.01f)
        assertEquals(350f, BluffBoard.seatX(0, 4, 400f, true), 0.01f)
        assertEquals(72, BluffBoard.rowCharacterDp(8))
        assertTrue(BluffBoard.rowCharacterDp(12) >= 40)
    }

    // ---------------------------------------------------------------- the host's hide picker (GAME-BLUFF §5.4)

    @Test fun hidePickerMovesOverTheGridAndSendsTheFocusedCard() {
        val ids = (0 until 9).map { "%08x".format(it) }
        val p = HidePicker(ids, rtl = false)
        assertFalse(p.move(RemoteKey.UP))
        assertTrue(p.move(RemoteKey.RIGHT))
        assertEquals(1, p.focus)
        assertFalse(p.move(RemoteKey.RIGHT)) // edge of the row
        assertTrue(p.move(RemoteKey.DOWN))
        assertEquals(3, p.focus)
        assertEquals(JsonPrimitive("00000003"), p.confirm()!!.i["optionId"])
        assertEquals(JsonPrimitive("HIDE_OPTION"), p.confirm()!!.i["type"])
        // RTL: card 0 is at the right edge, so LEFT moves to card 1.
        val r = HidePicker(ids, rtl = true)
        assertFalse(r.move(RemoteKey.RIGHT))
        assertTrue(r.move(RemoteKey.LEFT))
        assertEquals(1, r.focus)
        // One column: LEFT/RIGHT do nothing, DOWN walks the list.
        val one = HidePicker(ids.take(4), rtl = false)
        assertFalse(one.move(RemoteKey.LEFT))
        repeat(3) { assertTrue(one.move(RemoteKey.DOWN)) }
        assertFalse(one.move(RemoteKey.DOWN))
        assertNull(HidePicker(emptyList(), false).confirm())
    }

    /** The hide UI never depends on option kind (GAME-BLUFF §13.4): it only sees ids, in board order. */
    @Test fun hidePickerIsKindBlind() {
        val v = BluffFixtures.view("voting.final")
        val a = HidePicker(v.options.map { it.id }, false)
        val b = HidePicker(v.options.reversed().map { it.id }, false)
        a.move(RemoteKey.DOWN); b.move(RemoteKey.DOWN)
        assertEquals(a.focus, b.focus)
    }

    // ---------------------------------------------------------------- ranking (GAME-BLUFF §6.6, §12.3)

    @Test fun equalScoresSharePlacesAndThePodium() {
        assertEquals(mapOf("a" to 1, "b" to 1, "c" to 3, "d" to 4), BluffRanking.ranks(listOf("a" to 50, "b" to 50, "c" to 10, "d" to 0)))
        val v = BluffFixtures.view("results")
        val podium = BluffRanking.podium(v)
        assertEquals(listOf(1, 2, 3), podium.map { it.first })
        assertEquals("Léa", podium.first().second.single().name)
        assertEquals(2, podium[2].second.size) // نور and Sam share third with 10 each
        assertTrue(podium.none { (_, ps) -> ps.any { it.score == 0 } })
    }

    @Test fun scoresRaceNewLeaderComebackAndTease() {
        val v = BluffFixtures.view("scores")
        val race = BluffRanking.race(v)
        assertEquals("Léa", race.first().player.name)
        assertEquals(220, race.first().delta)
        assertEquals(race.map { it.player.score }.sortedDescending(), race.map { it.player.score })
        assertEquals("Léa", BluffRanking.newLeader(v)?.name)
        assertNull(BluffRanking.comeback(v)) // nobody is 400 behind yet
        val far = v.copy(players = v.players.map { if (it.name == "Léa") it.copy(score = 900) else it })
        assertTrue(BluffRanking.comeback(far) == null || BluffRanking.comeback(far)!!.score < 500)
        assertFalse(BluffRanking.finalTease(v.copy(promptIndex = 0, promptCount = 5)))
        assertTrue(BluffRanking.finalTease(v.copy(promptIndex = 3, promptCount = 5)))
        assertNull(BluffRanking.newLeader(v.copy(players = v.players.map { it.copy(score = 0, scoreBefore = 0) })))
    }

    // ---------------------------------------------------------------- cues (GAME-BLUFF §12.6)

    @Test fun progressCuesCountSubmissionsNeverContent() {
        val w = BluffFixtures.view("writing")
        val after = w.copy(players = w.players.mapIndexed { i, p -> p.copy(submitted = i < 2) })
        val cues = BluffCues.progress(w, after)
        assertEquals(2, cues.size)
        assertTrue(cues.all { it.cue == Cue.ANSWER_LOCK })
        assertTrue(BluffCues.progress(w, after.copy(promptIndex = 9)).isEmpty())
        for (s in listOf("round_intro", "round_intro.noTruth", "writing", "voting", "scores", "awards", "results")) {
            val v = view(s)
            for (c in BluffCues.entry(v)) assertTrue(s, c.delayMs <= (BluffMoments.phaseLengthMs(v) ?: 10_000L))
        }
    }
}
