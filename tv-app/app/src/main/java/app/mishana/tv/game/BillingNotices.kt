package app.mishana.tv.game

import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.TvView

/** A billing toast: an i18n key and its one optional argument (an email, a language code). */
data class BillingToast(val key: String, val arg: String? = null)

/**
 * PAYMENTS-SPEC §4.4 "Billing toasts": shown at once only while the Store is open or the phase is LOBBY/RESULTS;
 * otherwise at most one waits (the latest wins) and is shown on the next LOBBY/RESULTS. Pure.
 */
class BillingToastQueue {
    var queued: BillingToast? = null
        private set

    /** Returns the toast to show now, or null (then it is queued, replacing an older one). */
    fun offer(t: BillingToast, storeOpen: Boolean, phase: Phase?): BillingToast? {
        if (canShow(storeOpen, phase)) return t
        queued = t
        return null
    }

    /** The queued toast when it may now be shown (and clears it). */
    fun flush(storeOpen: Boolean, phase: Phase?): BillingToast? {
        val q = queued ?: return null
        if (!canShow(storeOpen, phase)) return null
        queued = null
        return q
    }

    fun clear() {
        queued = null
    }

    companion object {
        fun canShow(storeOpen: Boolean, phase: Phase?): Boolean = storeOpen || phase == Phase.LOBBY || phase == Phase.RESULTS
    }
}

/**
 * §4.4 downgrade notice and free-pool notice, per room session (pure, fed every broadcast):
 * - `lobby.premiumEnded` once per true → false flip, in LOBBY or on the first LOBBY after a game during which it flipped;
 * - `lobby.wordsRepeating` once per room session when `poolExhausted` becomes true in LOBBY.
 * Neither ever opens the Store.
 */
class LobbyNotices {
    private var flipPending = false
    private var poolShown = false

    fun onView(before: TvView?, after: TvView): List<String> {
        val out = mutableListOf<String>()
        if (before != null && before.premium && !after.premium) flipPending = true
        // Premium came back before the lobby: nothing to announce.
        if (after.premium) flipPending = false
        if (flipPending && after.phase == Phase.LOBBY) {
            flipPending = false
            out += PREMIUM_ENDED
        }
        if (!poolShown && after.phase == Phase.LOBBY && after.poolExhausted && (before == null || !before.poolExhausted || before.phase != Phase.LOBBY)) {
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
