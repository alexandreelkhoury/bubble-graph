package app.jamaa.tv.platform

import app.jamaa.tv.Constants

/** The remote keys the input rule distinguishes. */
enum class RemoteKey { OK, UP, DOWN, LEFT, RIGHT, BACK, INFO, OTHER }

val RemoteKey.isDpad: Boolean get() = this == RemoteKey.UP || this == RemoteKey.DOWN || this == RemoteKey.LEFT || this == RemoteKey.RIGHT

/** What a screen must do with one key event after the gate saw it. */
enum class GateDecision {
    /** Swallow it: nothing else may react (guard window, D-pad during a choreography, a repeated OK). */
    CONSUME,

    /** OK during a choreography: the choreography jumps to its end state; the key is consumed. */
    COMPLETE,

    /** Deliver it normally; OK may activate the focused control. */
    PASS,

    /** Deliver it for focus movement only (a repeated D-pad event): it must never activate a button. */
    MOVE_ONLY,
}

/**
 * JAMAA-PLATFORM §3.10 E, the one TV input rule (pure; JVM-tested):
 * 1. while a choreography runs, OK only completes it (consumed) and D-pad input is ignored;
 * 2. every screen reached through a transition ignores OK and D-pad for [Constants.INPUT_GUARD_MS] after it becomes
 *    interactive;
 * 3. key-repeat events never activate buttons; they may only move focus.
 * Back, INFO and other keys always pass (Back opens the pause menu or plays a reverse transition).
 */
class InputGate(private val clock: () -> Long) {
    private var running: Choreography? = null
    private var guardUntil = Long.MIN_VALUE

    private class Choreography(val id: String, val endsAt: Long, val onComplete: () -> Unit)

    /** The id of the running choreography, or null. A choreography whose time is up counts as finished. */
    val runningId: String? get() = running?.takeIf { clock() < it.endsAt }?.id

    val guarded: Boolean get() = clock() < guardUntil

    /** A choreography starts; [onComplete] jumps it to its end state (called at most once, by OK or by [finish]). */
    fun start(id: String, durationMs: Long, onComplete: () -> Unit = {}) {
        running = Choreography(id, clock() + durationMs, onComplete)
    }

    /**
     * The choreography ended (naturally or completed by OK): the screen it leads to becomes interactive now, so the
     * guard starts. Ignored when [id] is not the running one (a stale end callback).
     */
    fun finish(id: String) {
        val c = running ?: return
        if (c.id != id) return
        running = null
        becameInteractive()
    }

    /** A screen reached through a transition without a choreography (a dialog opening, results) became interactive. */
    fun becameInteractive() {
        guardUntil = clock() + Constants.INPUT_GUARD_MS
    }

    /** Drops any running choreography without the guard (e.g. the room was re-created). */
    fun reset() {
        running = null
        guardUntil = Long.MIN_VALUE
    }

    fun onKey(key: RemoteKey, repeatCount: Int = 0): GateDecision {
        val c = running
        if (c != null) {
            if (clock() >= c.endsAt) {
                // Its natural end was not reported yet: treat it as finished now.
                running = null
                becameInteractive()
            } else {
                return when {
                    key == RemoteKey.OK -> {
                        running = null
                        c.onComplete()
                        becameInteractive()
                        GateDecision.COMPLETE
                    }
                    key.isDpad -> GateDecision.CONSUME
                    else -> GateDecision.PASS
                }
            }
        }
        if ((key == RemoteKey.OK || key.isDpad) && guarded) return GateDecision.CONSUME
        if (repeatCount > 0) {
            return when {
                key == RemoteKey.OK -> GateDecision.CONSUME
                key.isDpad -> GateDecision.MOVE_ONLY
                else -> GateDecision.PASS
            }
        }
        return GateDecision.PASS
    }
}
