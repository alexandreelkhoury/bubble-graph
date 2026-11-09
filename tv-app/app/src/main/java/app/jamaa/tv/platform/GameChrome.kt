package app.jamaa.tv.platform

import app.jamaa.tv.games.GameView
import app.jamaa.tv.games.mishana.MishanaGameView

/** Platform chrome drawn over any game screen (JAMAA-PLATFORM §3.2 HUB-06), pure (JVM-tested). */
object GameChrome {
    /** The "◁ Back: menu & rules" hint shows for this long after each phase change. */
    const val HINT_AFTER_PHASE_MS = 3_000L

    /**
     * Round 1 of the instance (the hint stays up all round). Only Mish Ana! exposes a round today; for the other games
     * the envelope carries none, so their hint relies on the phase-change window (JAMAA-GAP until G2–G4 add one).
     */
    fun firstRound(game: GameView): Boolean = (game as? MishanaGameView)?.view?.let { it.round <= 1 } ?: false

    /** In game only (never on results): during round 1, and for [HINT_AFTER_PHASE_MS] after each phase change. */
    fun backHintVisible(game: GameView, sincePhaseChangeMs: Long): Boolean =
        !game.envelope.over && (firstRound(game) || sincePhaseChangeMs in 0 until HINT_AFTER_PHASE_MS)
}
