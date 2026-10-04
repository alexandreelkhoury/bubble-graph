package app.mishana.tv

import app.mishana.tv.game.ViewEvent
import app.mishana.tv.game.diffViews
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.HistoryEntry
import app.mishana.tv.protocol.Role
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ViewEventsTest {
    private val lobby = TvFixtures.view("lobby")
    private val clues = TvFixtures.view("clues")

    @Test
    fun firstViewAnnouncesNothing() {
        assertTrue(diffViews(null, lobby).isEmpty())
        assertTrue(diffViews(lobby, lobby).isEmpty())
    }

    @Test
    fun lobbyJoinAndLeave() {
        val three = lobby.copy(players = lobby.players.dropLast(1))
        assertEquals(listOf(ViewEvent.PlayerJoined("Sam")), diffViews(three, lobby))
        assertEquals(listOf(ViewEvent.PlayerLeft("Sam")), diffViews(lobby, three))
        // A player flagged `left` counts as gone too.
        val leftFlag = lobby.copy(players = lobby.players.map { if (it.name == "Sam") it.copy(left = true) else it })
        assertEquals(listOf(ViewEvent.PlayerLeft("Sam")), diffViews(lobby, leftFlag))
    }

    @Test
    fun noJoinToastsAcrossPhases() {
        assertTrue(diffViews(lobby.copy(players = emptyList()), clues).isEmpty())
    }

    @Test
    fun awayMidGame() {
        val away = clues.copy(players = clues.players.map { if (it.name == "Léa") it.copy(connected = false) else it })
        assertEquals(listOf(ViewEvent.PlayerAway("Léa")), diffViews(clues, away))
        // Coming back is silent.
        assertTrue(diffViews(away, clues).isEmpty())
    }

    @Test
    fun forfeitOnLeaveOrKick() {
        val sam = clues.players.first { it.name == "Sam" }
        val after = clues.copy(
            players = clues.players.map { if (it.id == sam.id) it.copy(left = true, alive = false, revealedRole = Role.UNDERCOVER) else it },
            history = clues.history + HistoryEntry(1, sam.id, Role.UNDERCOVER, HistoryCause.KICK),
        )
        assertEquals(listOf(ViewEvent.Forfeit("Sam", Role.UNDERCOVER)), diffViews(clues, after))
        // A vote elimination is not a forfeit; another game number is not compared at all.
        val voted = clues.copy(history = clues.history + HistoryEntry(1, sam.id, Role.CIVILIAN, HistoryCause.VOTE))
        assertTrue(diffViews(clues, voted).isEmpty())
        assertTrue(diffViews(clues, after.copy(gameNumber = clues.gameNumber + 1)).isEmpty())
    }

    @Test
    fun skippedAwaySpeakers() {
        val order = clues.speakingOrder // Léa, نور, Sam, Rami; Léa speaks
        val awayNour = clues.players.map { if (it.id == order[1]) it.copy(connected = false) else it }
        val before = clues.copy(players = awayNour)
        val after = before.copy(currentSpeakerId = order[2])
        assertEquals(listOf(ViewEvent.TurnSkipped("نور")), diffViews(before, after))
        // A normal hand-over skips nobody.
        assertTrue(diffViews(clues, clues.copy(currentSpeakerId = order[1])).isEmpty())
        // The order ends on a skip: everyone between the last speaker and the end is announced.
        val lastAway = clues.players.map { if (it.id == order[3]) it.copy(connected = false) else it }
        val b2 = clues.copy(players = lastAway, currentSpeakerId = order[2])
        assertEquals(listOf(ViewEvent.TurnSkipped("Rami")), diffViews(b2, b2.copy(currentSpeakerId = null)))
    }
}
