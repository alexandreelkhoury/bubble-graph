package app.jamaa.tv.platform

import app.jamaa.tv.settings.MemoryPlatformPrefs
import app.jamaa.tv.settings.SharedPlatformPrefs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** JAMAA-PLATFORM §3.2 HUB-03 first-time How to play, per device; setup initial focus (§3.10 E rule 4). */
class IntroFlowTest {
    @Test
    fun autoAdvancesUntilTheLastCardAndPausesOnDpad() {
        val prefs = MemoryPlatformPrefs()
        assertTrue(IntroFlow.firstVisit(prefs, "mishana"))
        val f = IntroFlow("mishana", 4, prefs)
        f.start()
        assertTrue(f.open)
        assertFalse(f.tick(5_999))
        assertTrue(f.tick(1))
        assertEquals(1, f.index)
        f.onDpad() // any D-pad input pauses auto-advance for the rest of the intro
        assertFalse(f.tick(60_000))
        f.onOk()
        f.onOk()
        assertEquals(3, f.index)
        assertTrue(prefs.introSeen("mishana")) // set when the last card is reached
        assertTrue(f.open) // the last card never auto-dismisses
        f.onOk() // "Got it"
        assertFalse(f.open)
        assertFalse(IntroFlow.firstVisit(prefs, "mishana"))
    }

    @Test
    fun lastCardNeverAutoDismissesAndBackSkips() {
        val prefs = MemoryPlatformPrefs()
        val f = IntroFlow("bluff", 3, prefs)
        f.start()
        repeat(10) { f.tick(6_000) }
        assertEquals(2, f.index)
        assertTrue(f.open)
        val g = IntroFlow("likely", 4, prefs)
        g.start()
        g.onBack()
        assertFalse(g.open)
        assertTrue(prefs.introSeen("likely"))
    }

    @Test
    fun anExternalStartCollapsesWithoutSettingTheFlag() {
        val prefs = MemoryPlatformPrefs()
        val f = IntroFlow("mishana", 4, prefs)
        f.start()
        f.collapse()
        assertFalse(f.open)
        assertFalse(prefs.introSeen("mishana"))
    }

    @Test
    fun setupInitialFocus() {
        assertEquals(SetupFocus.HOW_TO, SetupFocusRule.initial(introSeenBefore = false, canStart = true))
        assertEquals(SetupFocus.START, SetupFocusRule.initial(introSeenBefore = true, canStart = true))
        assertEquals(SetupFocus.FIRST_ROW, SetupFocusRule.initial(introSeenBefore = true, canStart = false))
    }

    @Test
    fun sharedPrefsStoreIntroFlagsAndCalmMotion() {
        val p = SharedPlatformPrefs(android.content.Context())
        p.setIntroSeen("mishana")
        p.setIntroSeen("trivia")
        assertTrue(p.introSeen("mishana"))
        assertEquals("intro_seen_mishana", SharedPlatformPrefs.introKey("mishana"))
        p.clearIntros() // "Show how-to again"
        assertFalse(p.introSeen("mishana") || p.introSeen("trivia"))
        p.calmMotion = true
        assertTrue(p.calmMotion)
    }

    @Test
    fun liteAndCalmMotionDecision() {
        val normal = MotionMode.decide(1f, calmPref = false, isLowRamDevice = false, memoryClassMb = 256)
        assertEquals(MotionMode(reduced = false, lite = false), normal)
        assertEquals(12, normal.ambientElements)
        assertTrue(MotionMode.decide(0f, false, false, 256).reduced) // animator scale 0
        assertTrue(MotionMode.decide(1f, true, false, 256).reduced) // Calm animations
        val lite = MotionMode.decide(1f, false, false, 128)
        assertTrue(lite.lite && !lite.reduced)
        assertEquals(4, lite.ambientElements)
        assertEquals(10, lite.particles(20))
        assertFalse(lite.blur || lite.grain)
        assertTrue(MotionMode.decide(1f, false, true, 512).lite)
        assertTrue(MotionMode.decide(1f, false, false, 512, debugLite = true).lite)
        assertEquals(0, MotionMode.decide(1f, true, true, 64).ambientElements) // reduced wins
    }
}
