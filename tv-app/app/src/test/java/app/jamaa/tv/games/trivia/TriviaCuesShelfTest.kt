package app.jamaa.tv.games.trivia

import app.jamaa.tv.game.Cue
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.SettingFieldSpec
import app.jamaa.tv.i18n.I18nKeys
import app.jamaa.tv.platform.PauseMenuModel
import app.jamaa.tv.platform.PauseRow
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.RulesContent
import app.jamaa.tv.protocol.LocalizedTitle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Sounds (GAME-TRIVIA §12.6), the quiz shelf (§9.1) and the catalog mirror (pause items, ⓘ, settings rows). */
class TriviaCuesShelfTest {
    // ---------------------------------------------------------------- sounds

    @Test
    fun answerLocksSoundTheSameForEveryoneAndAreSpacedOut() {
        val open = TriviaFixtures.view("answer.open")
        val two = TriviaFixtures.view("answer")
        val cues = TriviaCues.transition(open, two)
        assertEquals(listOf(Cue.ANSWER_LOCK, Cue.ANSWER_LOCK), cues.map { it.cue })
        assertEquals(listOf(0L, TriviaCues.LOCK_GAP_MS), cues.map { it.delayMs })
        assertTrue(cues.all { it.rate == 1f })
        assertEquals(emptyList<Any>(), TriviaCues.transition(two, two))
    }

    @Test
    fun revealCuesNeverPlayAWrongSoundForOnePlayer() {
        val normal = TriviaCues.entry(TriviaFixtures.view("reveal")).map { it.cue }
        assertTrue(Cue.QUIZ_CORRECT in normal)
        assertFalse(Cue.QUIZ_WRONG in normal)
        assertEquals(3, normal.count { it == Cue.COIN_LAND } - 4) // 4 landings of the jump-on + 3 coins
        val stumped = TriviaCues.entry(TriviaFixtures.view("reveal.stumped")).map { it.cue }
        assertEquals(listOf(Cue.TIME_UP, Cue.QUIZ_WRONG), stumped)
        assertEquals(listOf(Cue.TIME_UP), TriviaCues.entry(TriviaFixtures.view("reveal.voided")).map { it.cue })
        assertTrue(Cue.ALL_READY in TriviaCues.entry(TriviaFixtures.view("reveal.genius")).map { it.cue })
        // Landing ticks are capped at 10 and rise in pitch.
        val v = TriviaFixtures.view("reveal")
        val lands = TriviaCues.reveal(v).filter { it.cue == Cue.COIN_LAND && it.rate != 0.8f }
        assertTrue(lands.size <= TriviaCues.MAX_LAND_TICKS)
        assertEquals(lands.map { it.rate }.sorted(), lands.map { it.rate })
    }

    @Test
    fun phaseEntriesAreTimedToTheirMoments() {
        assertEquals(TriviaMoments.SLAM_LAND_MS, TriviaCues.entry(TriviaFixtures.view("read")).single().delayMs)
        val intro = TriviaCues.entry(TriviaFixtures.view("quiz_intro"))
        assertEquals(2, intro.size) // ★★
        assertEquals(2_500L + 400L, intro[0].delayMs) // after the entrance grace
        assertTrue(intro[1].rate > intro[0].rate)
        assertEquals(listOf(Cue.DRUMROLL, Cue.STAMP), TriviaCues.entry(TriviaFixtures.view("final_intro")).map { it.cue })
        assertTrue(TriviaCues.entry(TriviaFixtures.view("hold")).isEmpty())
        // A TV that reconnects mid-phase stays quiet.
        assertTrue(TriviaCues.transition(null, TriviaFixtures.view("reveal"), freshPhase = false).isEmpty())
    }

    @Test
    fun theCountdownTicksOnceASecondInTheLastFive() {
        assertNull(TriviaCues.tick(null, 4_900))
        assertNull(TriviaCues.tick(6_100, 5_900)) // 7 → 6 s
        assertEquals(Cue.TICK, TriviaCues.tick(5_010, 4_990)) // 6 → 5 s
        assertNull(TriviaCues.tick(4_990, 4_970))
        assertEquals(Cue.TICK, TriviaCues.tick(1_010, 990))
        assertNull(TriviaCues.tick(10, 0)) // the reveal's Time! takes over
    }

    // ---------------------------------------------------------------- shelf

    private fun card(id: String, domain: String, tier: String = "free") =
        QuizCardInfo(id, LocalizedTitle(id, id, id, id), 2, domain, listOf("music", "dance", "football", "food"), 1, 30, tier)

    private fun shelf(premium: Boolean = false, quizId: String? = "lb-quiz-01"): TriviaSetupView {
        val quizzes = listOf(card("world-easy-01", "world"), card("lb-quiz-01", "lebanon"), card("arab-music-01", "arab-world", "premium"), card("lb-quiz-02", "lebanon"))
        return TriviaSetupView(TriviaSetupSettings(quizId, "normal", "normal"), TriviaExtras("trivia", 30, 30, false, quizzes[1], quizzes), premium, "en")
    }

    @Test
    fun oneQuizShowsTheSummaryCardAndNoShelf() {
        val s = TriviaFixtures.setup("one_quiz")
        assertTrue(TriviaShelf.showsSummary(s))
        val c = TriviaShelf.summary(s)!!
        assertEquals("demo-quiz-01", c.info.id)
        assertTrue(c.selected)
        assertFalse(c.locked)
        assertEquals(3, c.featured.size)
        assertEquals(3, c.more)
        assertFalse(TriviaShelf.showsSummary(shelf()))
        assertNull(TriviaShelf.summary(shelf()))
    }

    @Test
    fun shelfRowsFollowTheVocabularyAndCardsShowLocksAndTheSelection() {
        val rows = TriviaShelf.rows(shelf())
        assertEquals(listOf("lebanon", "arab-world", "world"), rows.map { it.domain })
        assertEquals(listOf("lb-quiz-01", "lb-quiz-02"), rows[0].cards.map { it.info.id })
        assertTrue(rows[0].cards[0].selected)
        assertTrue(rows[1].cards[0].locked)
        assertFalse(TriviaShelf.rows(shelf(premium = true))[1].cards[0].locked)
        // Four featured topics: three chips + "+2" (1 more declared + 1 over the cap).
        assertEquals(3, rows[0].cards[0].featured.size)
        assertEquals(2, rows[0].cards[0].more)
        assertEquals(ShelfFocus(0, 0), TriviaShelf.initialFocus(rows))
        // The server's default (null quizId) counts as the selection.
        assertTrue(TriviaShelf.rows(shelf(quizId = null))[0].cards[0].selected)
    }

    @Test
    fun shelfDpad() {
        val rows = TriviaShelf.rows(shelf())
        val f0 = ShelfFocus(0, 1)
        assertEquals(ShelfAction.Move(ShelfFocus(0, 0)), TriviaShelf.onKey(rows, f0, RemoteKey.LEFT, rtl = false))
        assertEquals(ShelfAction.None, TriviaShelf.onKey(rows, f0, RemoteKey.RIGHT, rtl = false)) // no wrap
        // RTL: the row runs right to left, so Left moves forward.
        assertEquals(ShelfAction.Move(ShelfFocus(0, 1)), TriviaShelf.onKey(rows, ShelfFocus(0, 0), RemoteKey.LEFT, rtl = true))
        // Down keeps the column, clamped to the shorter row.
        assertEquals(ShelfAction.Move(ShelfFocus(1, 0)), TriviaShelf.onKey(rows, f0, RemoteKey.DOWN, rtl = false))
        assertEquals(ShelfAction.None, TriviaShelf.onKey(rows, ShelfFocus(0, 0), RemoteKey.UP, rtl = false))
        assertEquals(ShelfAction.Pick("lb-quiz-02"), TriviaShelf.onKey(rows, f0, RemoteKey.OK, rtl = false))
        assertEquals(ShelfAction.None, TriviaShelf.onKey(rows, f0, RemoteKey.OK, rtl = false, repeat = true))
        assertEquals(ShelfAction.Locked("arab-music-01"), TriviaShelf.onKey(rows, ShelfFocus(1, 0), RemoteKey.OK, rtl = false))
        assertEquals(ShelfAction.Close, TriviaShelf.onKey(rows, f0, RemoteKey.BACK, rtl = false))
        assertEquals(ShelfAction.Close, TriviaShelf.onKey(emptyList(), f0, RemoteKey.BACK, rtl = false))
    }

    // ---------------------------------------------------------------- catalog mirror

    @Test
    fun catalogKeysResolveAndRulesHighlightThePhase() {
        val m = GameCatalog.TRIVIA
        val keys = listOf(m.titleKey, m.taglineKey) + m.howToKeys + m.pauseItems.map { it.labelKey } +
            m.ruleSections.flatMap { listOf(it.titleKey, it.bodyKey) } +
            m.basic.flatMap { f -> listOf(f.labelKey) + ((f as? SettingFieldSpec.Choice)?.options?.map { it.labelKey } ?: emptyList()) }
        assertEquals(emptyList<String>(), keys.filter { it !in I18nKeys.strings })
        assertEquals(listOf("answer", "points", "streaks", "final", "ties"), m.ruleSections.map { it.id })
        assertEquals("points", RulesContent.sections(m, "REVEAL").first { it.youAreHere }.spec.id)
        assertEquals("answer", RulesContent.sections(m, "ANSWER").first().spec.id)
    }

    /** GAME-TRIVIA §13.4: D-pad reach of the pause items "Next", "Void this question", "End game", each in its phases. */
    @Test
    fun pauseItemsAreReachableInTheirPhases() {
        fun enabled(phase: String) = PauseMenuModel.rows(GameCatalog.TRIVIA, phase, over = false)
            .filterIsInstance<PauseRow.GameItem>().filter { it.enabled }.map { it.item.id }
        assertEquals(listOf("next", "voidQuestion"), enabled("REVEAL"))
        assertEquals(listOf("next"), enabled("QUIZ_INTRO"))
        assertEquals(listOf("endGame"), enabled("HOLD"))
        assertEquals(emptyList<String>(), enabled("ANSWER")) // READ/ANSWER: nothing (fairness)
        assertEquals(emptyList<String>(), enabled("READ"))
        val rows = PauseMenuModel.rows(GameCatalog.TRIVIA, "REVEAL", over = false)
        assertEquals(PauseRow.Resume, rows.first())
        assertEquals(3, rows.filterIsInstance<PauseRow.GameItem>().size)
        assertTrue(GameCatalog.TRIVIA.pauseItems.first { it.id == "voidQuestion" }.confirm)
        assertTrue(GameCatalog.TRIVIA.pauseItems.first { it.id == "endGame" }.confirm)
    }
}
