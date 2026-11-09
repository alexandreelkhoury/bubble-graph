package app.jamaa.tv.platform

import app.jamaa.tv.TvFixtures
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.games.UnsupportedReason
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** HUB-06 "◁ Back: menu & rules" hint timing and the pack picker's selection read (JAMAA-PLATFORM §3.2, §3.5). */
class GameChromeTest {
    private fun game(phase: String) = TvFixtures.room("playing.mishana.$phase").let { GameDecoders.decode(it.game!!, it.room) }

    @Test
    fun backHintShowsInRoundOneAndThreeSecondsAfterEachPhaseChange() {
        val clues = game("clues")
        val round = TvFixtures.mishana("clues").round
        assertEquals(round <= 1, GameChrome.firstRound(clues))
        // Past round 1 only the phase-change window shows it.
        val later = (clues as app.jamaa.tv.games.mishana.MishanaGameView).let { it.copy(view = it.view.copy(round = 3)) }
        assertTrue(GameChrome.backHintVisible(later, 0))
        assertTrue(GameChrome.backHintVisible(later, GameChrome.HINT_AFTER_PHASE_MS - 1))
        assertFalse(GameChrome.backHintVisible(later, GameChrome.HINT_AFTER_PHASE_MS))
        val r1 = later.copy(view = later.view.copy(round = 1))
        assertTrue(GameChrome.backHintVisible(r1, 60_000))
        // Never on results (the instance has its outcome), and a game without a round relies on the window only.
        val over = later.copy(envelope = later.envelope.copy(over = true))
        assertFalse(GameChrome.backHintVisible(over, 0))
        val other = UnsupportedGameView("bluff", later.envelope.copy(gameId = "bluff"), UnsupportedReason.NOT_IMPLEMENTED)
        assertFalse(GameChrome.firstRound(other))
        assertTrue(GameChrome.backHintVisible(other, 100))
        assertFalse(GameChrome.backHintVisible(other, 5_000))
    }

    @Test
    fun packPickerSelection() {
        val setup = TvFixtures.room("setup.mishana").room.setup!!
        fun with(v: kotlinx.serialization.json.JsonElement) = setup.copy(settings = JsonObject(setup.settings + ("k" to v)))
        assertEquals(listOf("a", "b"), SetupRows.selectedIds(with(JsonArray(listOf(JsonPrimitive("a"), JsonPrimitive("b")))), "k"))
        assertEquals(emptyList<String>(), SetupRows.selectedIds(with(JsonArray(emptyList())), "k")) // [] = every playable pack
        assertEquals(listOf("lb-quiz-01"), SetupRows.selectedIds(with(JsonPrimitive("lb-quiz-01")), "k"))
        assertEquals(emptyList<String>(), SetupRows.selectedIds(with(JsonNull), "k")) // the server's default pick
        assertEquals(emptyList<String>(), SetupRows.selectedIds(setup, "missing"))
    }
}
