package app.mishana.tv.net

import kotlin.math.min

/**
 * SPEC §9.7: `delayMs(attempt) = min(10_000, 500 * 2^attempt) * (0.8 + 0.4 * random)`.
 * Pure: the random source is injected. [baseMs]/[capMs] exist only so tests can run fast.
 */
class ReconnectPolicy(
    private val random: () -> Double = { Math.random() },
    val baseMs: Long = 500L,
    val capMs: Long = 10_000L,
) {
    fun delayMs(attempt: Int): Long {
        val shift = attempt.coerceIn(0, 30)
        val raw = min(capMs, baseMs * (1L shl shift))
        val jitter = 0.8 + 0.4 * random().coerceIn(0.0, 1.0)
        return (raw * jitter).toLong()
    }
}
