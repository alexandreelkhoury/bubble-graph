package app.mishana.tv

import app.mishana.tv.game.ClockOffset
import app.mishana.tv.game.Countdown
import app.mishana.tv.protocol.DeadlineKind
import app.mishana.tv.protocol.DeadlineView
import org.junit.Assert.assertEquals
import org.junit.Test

class CountdownTest {
    private val deadline = DeadlineView(DeadlineKind.VOTE, at = 1_790_000_120_000L, durationMs = 90_000L)

    @Test
    fun remainingUsesTheServerClock() {
        // Server is 2 s ahead of the TV.
        val offset = 2_000L
        val localNow = 1_790_000_040_000L - offset
        assertEquals(80_000L, Countdown.remainingMs(deadline.at, offset, localNow))
        assertEquals(80, Countdown.remainingSeconds(deadline.at, offset, localNow))
        assertEquals(80f / 90f, Countdown.fraction(deadline, offset, localNow), 1e-4f)
    }

    @Test
    fun secondsRoundUpAndClampAtZero() {
        assertEquals(1, Countdown.remainingSeconds(1_000L, 0L, 1L))
        assertEquals(0, Countdown.remainingSeconds(1_000L, 0L, 1_000L))
        assertEquals(0L, Countdown.remainingMs(1_000L, 0L, 5_000L))
        assertEquals(0f, Countdown.fraction(deadline, 0L, deadline.at + 1), 0f)
        assertEquals(1f, Countdown.fraction(deadline, 0L, deadline.at - 200_000), 0f)
    }

    @Test
    fun urgencyStages() {
        assertEquals(Countdown.Urgency.CALM, Countdown.urgency(10_001))
        assertEquals(Countdown.Urgency.WARN, Countdown.urgency(10_000))
        assertEquals(Countdown.Urgency.WARN, Countdown.urgency(5_001))
        assertEquals(Countdown.Urgency.DANGER, Countdown.urgency(5_000))
    }

    @Test
    fun clockOffsetKeepsTheLargestOfTheLastFive() {
        val c = ClockOffset()
        assertEquals(0L, c.value)
        c.add(serverNow = 1_000, localNow = 900) // +100
        c.add(1_000, 1_100) // -100
        assertEquals(100L, c.value)
        repeat(4) { c.add(1_000, 1_050) } // -50 x4 pushes +100 out of the window
        assertEquals(-50L, c.value)
        c.add(5_000, 1_000)
        assertEquals(4_000L, c.value)
    }
}
