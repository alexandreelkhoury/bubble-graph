package app.jamaa.tv

import app.jamaa.tv.game.ViewEvent
import app.jamaa.tv.game.diffMembers
import app.jamaa.tv.game.diffViews
import app.jamaa.tv.protocol.RoomPhase
import app.jamaa.tv.protocol.HistoryCause
import app.jamaa.tv.protocol.HistoryEntry
import app.jamaa.tv.protocol.Role
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ViewEventsTest {
    private val hub = TvFixtures.room("hub").room
    private val playing = TvFixtures.room("playing.mishana.clues").room
    private val clues = TvFixtures.mishana("clues")

    @Test
    fun firstViewAnnouncesNothing() {
        assertTrue(diffMembers(null, hub).isEmpty())
        assertTrue(diffMembers(hub, hub).isEmpty())
        assertTrue(diffViews(null, clues).isEmpty())
        assertTrue(diffViews(clues, clues).isEmpty())
    }

    @Test
    fun hubJoinAndLeave() {
        val three = hub.copy(members = hub.members.dropLast(1))
        assertEquals(listOf(ViewEvent.PlayerJoined("Sam")), diffMembers(three, hub))
        assertEquals(listOf(ViewEvent.PlayerLeft("Sam")), diffMembers(hub, three))
        // The same in SETUP; HUB → SETUP with the same members says nothing.
        val setup = hub.copy(phase = RoomPhase.SETUP, setupGameId = "mishana")
        assertTrue(diffMembers(hub, setup).isEmpty())
        assertEquals(listOf(ViewEvent.PlayerLeft("Sam")), diffMembers(setup, three.copy(phase = RoomPhase.SETUP)))
    }

    @Test
    fun benchedJoinMidGameIsAnnouncedAndLeftMembersRemovedAtTheEndAreNot() {
        // Zoé joined while PLAYING: benched, still "with us".
        val before = playing.copy(members = playing.members.filter { it.name != "Zoé" })
        assertEquals(listOf(ViewEvent.PlayerJoined("Zoé")), diffMembers(before, playing))
        // A member who left mid-game is removed when the game ends: no second toast.
        val leftFlag = playing.copy(members = playing.members.map { if (it.name == "Sam") it.copy(left = true) else it })
        val backToSetup = hub.copy(phase = RoomPhase.SETUP, members = hub.members.filter { it.name != "Sam" })
        assertTrue(diffMembers(leftFlag, backToSetup).isEmpty())
    }

    @Test
    fun awayMidGame() {
        val away = playing.copy(members = playing.members.map { if (it.name == "Léa") it.copy(connected = false) else it })
        assertEquals(listOf(ViewEvent.PlayerAway("Léa")), diffMembers(playing, away))
        // Coming back is silent; dropping in the hub is not "away" (the seat hold handles it).
        assertTrue(diffMembers(away, playing).isEmpty())
        assertTrue(diffMembers(hub, hub.copy(members = hub.members.map { it.copy(connected = false) })).isEmpty())
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
        val order = clues.speakingOrder // نور, Sam, Rami, Léa; نور speaks
        val awaySam = clues.players.map { if (it.id == order[1]) it.copy(connected = false) else it }
        val before = clues.copy(players = awaySam)
        val after = before.copy(currentSpeakerId = order[2])
        assertEquals(listOf(ViewEvent.TurnSkipped("Sam")), diffViews(before, after))
        // A normal hand-over skips nobody.
        assertTrue(diffViews(clues, clues.copy(currentSpeakerId = order[1])).isEmpty())
        // The order ends on a skip: everyone between the last speaker and the end is announced.
        val lastAway = clues.players.map { if (it.id == order[3]) it.copy(connected = false) else it }
        val b2 = clues.copy(players = lastAway, currentSpeakerId = order[2])
        assertEquals(listOf(ViewEvent.TurnSkipped("Léa")), diffViews(b2, b2.copy(currentSpeakerId = null)))
    }
}
