package app.jamaa.tv.game

import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.protocol.RoomPhase
import app.jamaa.tv.protocol.RoomView

/** A billing toast: an i18n key and its one optional argument (an email, a language code). */
data class BillingToast(val key: String, val arg: String? = null)

/**
 * PAYMENTS-SPEC §4.4 "Billing toasts": shown at once only while the Store is open or between games (HUB, SETUP or a
 * finished game: JAMAA-PLATFORM §2.5 replaced LOBBY/RESULTS); otherwise at most one waits (the latest wins) and is
 * shown when the room is next between games. Pure.
 */
class BillingToastQueue {
    var queued: BillingToast? = null
        private set

    /** Returns the toast to show now, or null (then it is queued, replacing an older one). */
    fun offer(t: BillingToast, storeOpen: Boolean, between: Boolean): BillingToast? {
        if (canShow(storeOpen, between)) return t
        queued = t
        return null
    }

    /** The queued toast when it may now be shown (and clears it). */
    fun flush(storeOpen: Boolean, between: Boolean): BillingToast? {
        val q = queued ?: return null
        if (!canShow(storeOpen, between)) return null
        queued = null
        return q
    }

    fun clear() {
        queued = null
    }

    companion object {
        fun canShow(storeOpen: Boolean, between: Boolean): Boolean = storeOpen || between
    }
}

/**
 * §4.4 downgrade notice and free-pool notice, per room session (pure, fed every broadcast):
 * - `lobby.premiumEnded` once per true → false flip, in HUB/SETUP or on the first HUB/SETUP after a game during which
 *   it flipped;
 * - `lobby.wordsRepeating` once per room session when the Mish Ana! setup's `extras.poolExhausted` becomes true
 *   (JAMAA-PLATFORM §2.5: it moved from the LOBBY view to `room.setup.extras`).
 * Neither ever opens the Store.
 */
class LobbyNotices {
    private var flipPending = false
    private var poolShown = false

    fun onView(before: RoomView?, after: RoomView): List<String> {
        val out = mutableListOf<String>()
        val gathering = after.room.phase != RoomPhase.PLAYING
        if (before != null && before.room.premium && !after.room.premium) flipPending = true
        // The Pass came back before the hub: nothing to announce.
        if (after.room.premium) flipPending = false
        if (flipPending && gathering) {
            flipPending = false
            out += PREMIUM_ENDED
        }
        val pool = after.room.phase == RoomPhase.SETUP && MishanaTv.poolExhausted(after.room.setup)
        val poolBefore = before != null && before.room.phase == RoomPhase.SETUP && MishanaTv.poolExhausted(before.room.setup)
        if (!poolShown && pool && !poolBefore) {
            poolShown = true
            out += WORDS_REPEATING
        }
        return out
    }

    /** A new room is a new session. */
    fun reset() {
        flipPending = false
        poolShown = false
    }

    companion object {
        const val PREMIUM_ENDED = "lobby.premiumEnded"
        const val WORDS_REPEATING = "lobby.wordsRepeating"
    }
}
