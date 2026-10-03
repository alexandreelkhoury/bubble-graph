package app.mishana.tv

import app.mishana.tv.game.ArmedAction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArmedActionTest {
    @Test
    fun secondPressWithinThreeSecondsFires() {
        val a = ArmedAction()
        assertEquals(ArmedAction.Result.ARMED, a.press(1_000))
        assertTrue(a.isArmed(3_999))
        assertEquals(ArmedAction.Result.FIRED, a.press(3_999))
        assertFalse(a.isArmed(4_000))
    }

    @Test
    fun lateSecondPressReArms() {
        val a = ArmedAction()
        a.press(0)
        assertFalse(a.isArmed(3_000))
        assertEquals(ArmedAction.Result.ARMED, a.press(3_000))
        assertEquals(ArmedAction.Result.FIRED, a.press(3_500))
    }
}
