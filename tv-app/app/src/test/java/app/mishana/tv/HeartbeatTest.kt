package app.mishana.tv

import app.mishana.tv.net.Heartbeat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HeartbeatTest {

    @Test
    fun pingEvery20sAndPongCancelsTimeout() = runTest {
        val sent = mutableListOf<Pair<Long, String>>()
        var timeouts = 0
        val hb = Heartbeat(
            scope = backgroundScope,
            clock = { testScheduler.currentTime },
            send = { sent += testScheduler.currentTime to it; true },
            onTimeout = { timeouts++ },
        )
        hb.start()
        advanceTimeBy(19_999); runCurrent()
        assertTrue(sent.isEmpty())
        advanceTimeBy(1); runCurrent()
        assertEquals(listOf(20_000L to Constants.PING_FRAME), sent)

        advanceTimeBy(5_000); runCurrent()
        hb.onPong()
        advanceTimeBy(14_999); runCurrent() // t = 39 999
        assertEquals(0, timeouts)
        assertEquals(1, sent.size)
        advanceTimeBy(1); runCurrent() // t = 40 000
        assertEquals(2, sent.size)
        assertEquals(40_000L, sent[1].first)
        hb.onPong()
        advanceTimeBy(25_000); runCurrent() // t = 65 000: third ping at 60 000 still within its 10 s window
        assertEquals(3, sent.size)
        assertEquals(0, timeouts)
        hb.stop()
    }

    @Test
    fun timeout10sAfterAnUnansweredPing() = runTest {
        var pings = 0
        var timeoutAt = -1L
        val hb = Heartbeat(
            scope = backgroundScope,
            clock = { testScheduler.currentTime },
            send = { pings++; true },
            onTimeout = { timeoutAt = testScheduler.currentTime },
        )
        hb.start()
        advanceTimeBy(20_000); runCurrent()
        assertEquals(1, pings)
        advanceTimeBy(9_999); runCurrent()
        assertEquals(-1L, timeoutAt)
        advanceTimeBy(1); runCurrent()
        assertEquals(30_000L, timeoutAt)
        // After a timeout the heartbeat stops itself: no more pings or timeouts.
        advanceTimeBy(120_000); runCurrent()
        assertEquals(1, pings)
        assertEquals(30_000L, timeoutAt)
    }

    @Test
    fun stopStopsEverything() = runTest {
        var pings = 0
        var timeouts = 0
        val hb = Heartbeat(backgroundScope, { testScheduler.currentTime }, { pings++; true }, { timeouts++ })
        hb.start()
        advanceTimeBy(20_000); runCurrent()
        assertEquals(1, pings)
        hb.stop()
        advanceTimeBy(200_000); runCurrent()
        assertEquals(1, pings)
        assertEquals(0, timeouts)
    }
}
