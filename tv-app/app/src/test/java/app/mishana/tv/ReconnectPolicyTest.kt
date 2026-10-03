package app.mishana.tv

import app.mishana.tv.net.ReconnectPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReconnectPolicyTest {
    @Test
    fun delaysAreBoundedAndGrowWithTheCapAt10s() {
        for (r in listOf(0.0, 0.25, 0.5, 0.75, 1.0)) {
            val p = ReconnectPolicy(random = { r })
            var prev = 0L
            for (attempt in 0..40) {
                val d = p.delayMs(attempt)
                val raw = minOf(10_000L, 500L * (1L shl minOf(attempt, 30)))
                assertTrue("lower bound a=$attempt r=$r d=$d", d >= (raw * 0.8).toLong())
                assertTrue("upper bound a=$attempt r=$r d=$d", d <= (raw * 1.2).toLong())
                assertTrue("never above 12 s", d <= 12_000L)
                assertTrue("non-decreasing for fixed jitter", d >= prev)
                prev = d
            }
        }
    }

    @Test
    fun exactValuesAtMidJitter() {
        val p = ReconnectPolicy(random = { 0.5 })
        assertEquals(500L, p.delayMs(0))
        assertEquals(1_000L, p.delayMs(1))
        assertEquals(2_000L, p.delayMs(2))
        assertEquals(8_000L, p.delayMs(4))
        assertEquals(10_000L, p.delayMs(5))
        assertEquals(10_000L, p.delayMs(1_000))
    }
}
