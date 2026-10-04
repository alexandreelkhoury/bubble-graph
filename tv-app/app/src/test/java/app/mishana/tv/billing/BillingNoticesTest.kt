package app.mishana.tv.billing

import app.mishana.tv.TvFixtures
import app.mishana.tv.game.BillingToast
import app.mishana.tv.game.BillingToastQueue
import app.mishana.tv.game.LobbyNotices
import app.mishana.tv.protocol.Phase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** PAYMENTS-SPEC §4.4 billing toast queue, downgrade notice and free-pool notice (§4.9 BillingRepositoryTest items). */
class BillingNoticesTest {
    @Test
    fun billingToastsAreQueuedLatestOnlyOutsideStoreLobbyResults() {
        val q = BillingToastQueue()
        assertEquals(BillingToast("store.unlocked"), q.offer(BillingToast("store.unlocked"), storeOpen = false, phase = Phase.LOBBY))
        assertEquals(BillingToast("a"), q.offer(BillingToast("a"), storeOpen = true, phase = Phase.CLUES))
        assertNull(q.offer(BillingToast("first"), storeOpen = false, phase = Phase.CLUES))
        assertNull(q.offer(BillingToast("latest"), storeOpen = false, phase = Phase.VOTING))
        assertNull(q.flush(storeOpen = false, phase = Phase.ELIMINATION))
        assertEquals(BillingToast("latest"), q.flush(storeOpen = false, phase = Phase.RESULTS))
        assertNull(q.flush(storeOpen = false, phase = Phase.LOBBY))
    }

    @Test
    fun premiumEndedOncePerFlipInLobbyOrOnTheFirstLobbyAfterAGame() {
        val n = LobbyNotices()
        val lobby = TvFixtures.view("lobby")
        val clues = TvFixtures.view("clues")
        assertEquals(emptyList<String>(), n.onView(null, lobby.copy(premium = true)))
        assertEquals(listOf("lobby.premiumEnded"), n.onView(lobby.copy(premium = true), lobby.copy(premium = false)))
        assertEquals(emptyList<String>(), n.onView(lobby, lobby))
        // Flip during a game: announced on the first LOBBY after it, once.
        assertEquals(emptyList<String>(), n.onView(lobby.copy(premium = true), clues.copy(premium = true)))
        assertEquals(emptyList<String>(), n.onView(clues.copy(premium = true), clues.copy(premium = false)))
        assertEquals(emptyList<String>(), n.onView(clues, clues))
        assertEquals(listOf("lobby.premiumEnded"), n.onView(clues, lobby))
        assertEquals(emptyList<String>(), n.onView(lobby, lobby))
    }

    @Test
    fun wordsRepeatingOncePerRoomSession() {
        val n = LobbyNotices()
        val lobby = TvFixtures.view("lobby")
        assertEquals(emptyList<String>(), n.onView(null, lobby))
        assertEquals(listOf("lobby.wordsRepeating"), n.onView(lobby, lobby.copy(poolExhausted = true)))
        assertEquals(emptyList<String>(), n.onView(lobby.copy(poolExhausted = true), lobby))
        assertEquals(emptyList<String>(), n.onView(lobby, lobby.copy(poolExhausted = true)))
        n.reset() // a new room
        assertEquals(listOf("lobby.wordsRepeating"), n.onView(lobby, lobby.copy(poolExhausted = true)))
    }
}
