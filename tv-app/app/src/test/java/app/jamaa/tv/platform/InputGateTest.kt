package app.jamaa.tv.platform

import app.jamaa.tv.Constants
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** JAMAA-PLATFORM §3.10 E: the TV input rule. */
class InputGateTest {
    private var now = 0L
    private val gate = InputGate { now }

    @Test
    fun okCompletesARunningChoreographyAndIsConsumed() {
        var completed = 0
        gate.start("portal", 1_100) { completed++ }
        assertEquals(GateDecision.CONSUME, gate.onKey(RemoteKey.LEFT))
        assertEquals(GateDecision.PASS, gate.onKey(RemoteKey.BACK)) // Back still works (reverse / pause menu)
        assertEquals(GateDecision.COMPLETE, gate.onKey(RemoteKey.OK))
        assertEquals(1, completed)
        assertNull(gate.runningId)
        // The next screen is guarded for INPUT_GUARD_MS.
        assertEquals(GateDecision.CONSUME, gate.onKey(RemoteKey.OK))
        now += Constants.INPUT_GUARD_MS - 1
        assertEquals(GateDecision.CONSUME, gate.onKey(RemoteKey.DOWN))
        now += 1
        assertEquals(GateDecision.PASS, gate.onKey(RemoteKey.OK))
        assertEquals(1, completed)
    }

    @Test
    fun aNaturalEndStartsTheGuardToo() {
        gate.start("entrance", 2_000)
        now += 2_000
        // The end was not reported yet: the gate treats the time-up choreography as finished and guards.
        assertEquals(GateDecision.CONSUME, gate.onKey(RemoteKey.OK))
        now += Constants.INPUT_GUARD_MS
        assertEquals(GateDecision.PASS, gate.onKey(RemoteKey.OK))
        gate.start("x", 500)
        gate.finish("other") // stale end callback: ignored
        assertEquals("x", gate.runningId)
        gate.finish("x")
        assertTrue(gate.guarded)
    }

    @Test
    fun keyRepeatNeverActivates() {
        assertEquals(GateDecision.CONSUME, gate.onKey(RemoteKey.OK, repeatCount = 1))
        assertEquals(GateDecision.MOVE_ONLY, gate.onKey(RemoteKey.RIGHT, repeatCount = 4))
        assertEquals(GateDecision.PASS, gate.onKey(RemoteKey.RIGHT))
        assertEquals(GateDecision.PASS, gate.onKey(RemoteKey.INFO, repeatCount = 2))
    }

    @Test
    fun okMashedThreeTimesWithin300msOnAPoster() {
        val screens = mutableListOf("HUB")
        fun press() {
            when (gate.onKey(RemoteKey.OK)) {
                GateDecision.PASS -> if (screens.last() == "HUB") {
                    gate.start("portal", 1_100) { screens += "SETUP" }
                } else if (screens.last() == "SETUP") screens += "PLAYING"
                else -> Unit
            }
        }
        press(); now += 100; press(); now += 100; press()
        assertEquals(listOf("HUB", "SETUP"), screens)
    }
}
