package app.jamaa.tv.platform

import app.jamaa.tv.settings.PlatformPrefs

/**
 * The first-time full-screen "How to play" (JAMAA-PLATFORM §3.2 HUB-03, DESIGN-JAMAA §2.5), pure (JVM-tested):
 * - opens expanded the first time this game's setup opens on this TV (`intro_seen_<gameId>` missing);
 * - cards auto-advance after [AUTO_ADVANCE_MS], and any D-pad input pauses auto-advance for the rest of the intro;
 * - OK = next card; Back = skip; the last card never auto-dismisses ("Got it");
 * - the flag is set when the last card is reached or the intro is skipped;
 * - START_GAME / CLOSE_GAME from elsewhere collapses it instantly without setting the flag.
 */
class IntroFlow(private val gameId: String, val cardCount: Int, private val prefs: PlatformPrefs) {
    var index: Int = 0
        private set
    var autoAdvance: Boolean = true
        private set
    var open: Boolean = false
        private set

    /** Time spent on the current card while auto-advance was running. */
    private var onCardMs = 0L

    val isLast: Boolean get() = index >= cardCount - 1

    /** Opens the full-screen intro: automatically on a first visit, or on OK on the collapsed how-to pane. */
    fun start() {
        open = cardCount > 0
        index = 0
        autoAdvance = true
        onCardMs = 0
        if (open && isLast) prefs.setIntroSeen(gameId)
    }

    /** Frame time passing ([deltaMs]); returns true when the card changed. */
    fun tick(deltaMs: Long): Boolean {
        if (!open || !autoAdvance || isLast) return false
        onCardMs += deltaMs
        if (onCardMs < AUTO_ADVANCE_MS) return false
        next()
        return true
    }

    fun onDpad() {
        autoAdvance = false
    }

    /** OK: the next card, or "Got it" on the last one (closes). */
    fun onOk() {
        if (!open) return
        if (isLast) close() else next()
    }

    /** Back: skip to the setup (the flag is set). */
    fun onBack() {
        if (!open) return
        prefs.setIntroSeen(gameId)
        close()
    }

    /** START_GAME / CLOSE_GAME arrived while open: collapse at once (no animation, flag unchanged). */
    fun collapse() {
        open = false
    }

    private fun next() {
        index = (index + 1).coerceAtMost(cardCount - 1)
        onCardMs = 0
        if (isLast) prefs.setIntroSeen(gameId)
    }

    private fun close() {
        open = false
    }

    companion object {
        const val AUTO_ADVANCE_MS = 6_000L

        /** Should the setup open with the full-screen intro? */
        fun firstVisit(prefs: PlatformPrefs, gameId: String): Boolean = !prefs.introSeen(gameId)
    }
}

/** Where focus lands on HUB-03 (§3.2, §3.10 E rule 4). */
enum class SetupFocus { START, HOW_TO, FIRST_ROW }

object SetupFocusRule {
    /**
     * [introSeenBefore] = the flag as it was when the setup opened (before a first-visit intro sets it): Start only if
     * the intro was already seen **and** `canStart`; otherwise the how-to pane (first visit) or the first settings row.
     */
    fun initial(introSeenBefore: Boolean, canStart: Boolean): SetupFocus = when {
        !introSeenBefore -> SetupFocus.HOW_TO
        canStart -> SetupFocus.START
        else -> SetupFocus.FIRST_ROW
    }
}
