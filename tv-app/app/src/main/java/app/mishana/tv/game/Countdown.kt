package app.mishana.tv.game

import app.mishana.tv.protocol.DeadlineView
import kotlin.math.ceil

/**
 * Remaining-time computation against the server clock (SPEC §9.6, §9.8): every on-screen countdown uses
 * `deadline.at − (now + clockOffsetMs)`, never local constants.
 */
object Countdown {
    fun serverNow(nowMs: Long, clockOffsetMs: Long): Long = nowMs + clockOffsetMs

    fun remainingMs(deadlineAt: Long, clockOffsetMs: Long, nowMs: Long): Long =
        (deadlineAt - serverNow(nowMs, clockOffsetMs)).coerceAtLeast(0L)

    /** Whole seconds shown on timers: ceil, so "1" shows until the very end and "0" only at expiry. */
    fun remainingSeconds(deadlineAt: Long, clockOffsetMs: Long, nowMs: Long): Int =
        ceil(remainingMs(deadlineAt, clockOffsetMs, nowMs) / 1000.0).toInt()

    /** 1.0 = full, 0.0 = expired. */
    fun fraction(deadline: DeadlineView, clockOffsetMs: Long, nowMs: Long): Float {
        if (deadline.durationMs <= 0L) return 0f
        val rem = remainingMs(deadline.at, clockOffsetMs, nowMs)
        return (rem.toDouble() / deadline.durationMs.toDouble()).toFloat().coerceIn(0f, 1f)
    }

    /** Timer colour stage (DESIGN TV-05): text until 10 s, accent until 5 s, then danger. */
    enum class Urgency { CALM, WARN, DANGER }

    fun urgency(remainingMs: Long): Urgency = when {
        remainingMs <= 5_000L -> Urgency.DANGER
        remainingMs <= 10_000L -> Urgency.WARN
        else -> Urgency.CALM
    }
}

/** `clockOffsetMs` = the largest of the last [window] samples of `serverNow − localNow` (SPEC §9.8). */
class ClockOffset(private val window: Int = 5) {
    private val samples = ArrayDeque<Long>()

    fun add(serverNow: Long, localNow: Long): Long {
        samples.addLast(serverNow - localNow)
        while (samples.size > window) samples.removeFirst()
        return value
    }

    val value: Long get() = samples.maxOrNull() ?: 0L

    fun clear() = samples.clear()
}
