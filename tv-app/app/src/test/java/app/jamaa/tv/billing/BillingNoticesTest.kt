package app.jamaa.tv.billing

import app.jamaa.tv.TvFixtures
import app.jamaa.tv.game.BillingToast
import app.jamaa.tv.game.BillingToastQueue
import app.jamaa.tv.game.LobbyNotices
import app.jamaa.tv.protocol.RoomView
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** PAYMENTS-SPEC §4.4 billing toast queue, downgrade notice and free-pool notice (§4.9 BillingRepositoryTest items). */
class BillingNoticesTest {
    @Test
    fun billingToastsAreQueuedLatestOnlyWhileAGameRuns() {
        val q = BillingToastQueue()
        assertEquals(BillingToast("store.unlocked"), q.offer(BillingToast("store.unlocked"), storeOpen = false, between = true))
        assertEquals(BillingToast("a"), q.offer(BillingToast("a"), storeOpen = true, between = false))
        assertNull(q.offer(BillingToast("first"), storeOpen = false, between = false))
        assertNull(q.offer(BillingToast("latest"), storeOpen = false, between = false))
        assertNull(q.flush(storeOpen = false, between = false))
        assertEquals(BillingToast("latest"), q.flush(storeOpen = false, between = true))
        assertNull(q.flush(storeOpen = false, between = true))
    }

    private fun RoomView.premium(p: Boolean) = copy(room = room.copy(premium = p))

    private fun RoomView.pool(exhausted: Boolean): RoomView {
        val setup = room.setup!!
        return copy(room = room.copy(setup = setup.copy(extras = JsonObject(setup.extras + ("poolExhausted" to JsonPrimitive(exhausted))))))
    }

    @Test
    fun premiumEndedOncePerFlipInLobbyOrOnTheFirstLobbyAfterAGame() {
        val n = LobbyNotices()
        val lobby = TvFixtures.room("hub")
        val clues = TvFixtures.room("playing.mishana.clues")
        assertEquals(emptyList<String>(), n.onView(null, lobby.premium(true)))
        assertEquals(listOf("lobby.premiumEnded"), n.onView(lobby.premium(true), lobby.premium(false)))
        assertEquals(emptyList<String>(), n.onView(lobby, lobby))
        // Flip during a game: announced on the first HUB/SETUP after it, once.
        assertEquals(emptyList<String>(), n.onView(lobby.premium(true), clues.premium(true)))
        assertEquals(emptyList<String>(), n.onView(clues.premium(true), clues.premium(false)))
        assertEquals(emptyList<String>(), n.onView(clues, clues))
        assertEquals(listOf("lobby.premiumEnded"), n.onView(clues, lobby))
        assertEquals(emptyList<String>(), n.onView(lobby, lobby))
    }

    @Test
    fun wordsRepeatingOncePerRoomSession() {
        val n = LobbyNotices()
        val lobby = TvFixtures.room("setup.mishana")
        assertEquals(emptyList<String>(), n.onView(null, lobby))
        assertEquals(listOf("lobby.wordsRepeating"), n.onView(lobby, lobby.pool(true)))
        assertEquals(emptyList<String>(), n.onView(lobby.pool(true), lobby))
        assertEquals(emptyList<String>(), n.onView(lobby, lobby.pool(true)))
        n.reset() // a new room
        assertEquals(listOf("lobby.wordsRepeating"), n.onView(lobby, lobby.pool(true)))
        // Another game's setup has no pool notice.
        assertEquals(emptyList<String>(), LobbyNotices().onView(null, TvFixtures.room("setup.bluff")))
    }
}
