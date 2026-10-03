package app.mishana.tv.game

/**
 * The in-game action pill (SPEC §9.6): the first OK arms it for [windowMs] (label → `tv.pressAgain`),
 * a second OK within the window fires `HOST_ADVANCE`. Pure; the caller supplies the clock.
 */
class ArmedAction(private val windowMs: Long = 3_000L) {
    enum class Result { ARMED, FIRED }

    var armedAt: Long? = null
        private set

    fun isArmed(now: Long): Boolean = armedAt?.let { now - it < windowMs } ?: false

    fun press(now: Long): Result =
        if (isArmed(now)) {
            armedAt = null
            Result.FIRED
        } else {
            armedAt = now
            Result.ARMED
        }

    fun disarm() {
        armedAt = null
    }
}
