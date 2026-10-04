package app.mishana.tv.game

/**
 * The in-game action pill (SPEC §9.6): the first OK arms it for [windowMs] (label → `tv.pressAgain`),
 * a second OK within the window fires `HOST_ADVANCE`. Pure; the caller supplies the clock.
 *
 * OK is also the universal "skip the reveal" key, and focus lands on the next phase's pill straight away, so presses
 * mashed to skip an animation would carry over and arm + fire the new pill. [reset] (called when the pill's phase or
 * label changes) disarms it and ignores presses for [guardMs], like the phone's DONE_GUARD_MS.
 */
class ArmedAction(private val windowMs: Long = 3_000L, private val guardMs: Long = 800L) {
    enum class Result { IGNORED, ARMED, FIRED }

    var armedAt: Long? = null
        private set

    private var readyAt = Long.MIN_VALUE

    fun isArmed(now: Long): Boolean = armedAt?.let { now - it < windowMs } ?: false

    fun press(now: Long): Result = when {
        now < readyAt -> Result.IGNORED
        isArmed(now) -> {
            armedAt = null
            Result.FIRED
        }
        else -> {
            armedAt = now
            Result.ARMED
        }
    }

    /** A new phase/label took the pill: disarm, and ignore presses until `now + guardMs`. */
    fun reset(now: Long) {
        armedAt = null
        readyAt = now + guardMs
    }

    fun disarm() {
        armedAt = null
    }
}
