package app.mishana.tv

import app.mishana.tv.game.SettingsStepper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SettingsStepperTest {
    private val b = Constants.SETTINGS_BOUNDS

    @Test
    fun timersStepThroughOff() {
        assertEquals(50, SettingsStepper.stepInt(45, b.clueSeconds, +1))
        assertEquals(120, SettingsStepper.stepInt(120, b.clueSeconds, +1))
        assertEquals(0, SettingsStepper.stepInt(10, b.clueSeconds, -1)) // below min → off
        assertEquals(0, SettingsStepper.stepInt(0, b.clueSeconds, -1)) // stays off
        assertEquals(10, SettingsStepper.stepInt(0, b.clueSeconds, +1)) // off → min
        assertEquals(30, SettingsStepper.stepInt(15, b.voteSeconds, +1))
        assertEquals(0, SettingsStepper.stepInt(15, b.voteSeconds, -1))
    }

    @Test
    fun countsClampWithoutOff() {
        assertEquals(0, SettingsStepper.stepInt(1, b.undercoverCount, -1)) // the Undercover is optional (rules v2)
        assertEquals(0, SettingsStepper.stepInt(0, b.undercoverCount, -1))
        assertEquals(5, SettingsStepper.stepInt(5, b.blankCount, +1))
        assertEquals(5, SettingsStepper.stepInt(5, b.undercoverCount, +1))
        assertEquals(0, SettingsStepper.stepInt(0, b.blankCount, -1))
        assertEquals(20, SettingsStepper.stepInt(20, b.points, +1))
        assertEquals(0, SettingsStepper.stepInt(0, b.points, -1))
    }

    @Test
    fun cycleWraps() {
        val langs = listOf("en", "fr", "ar")
        assertEquals("fr", SettingsStepper.cycle(langs, "en", +1))
        assertEquals("ar", SettingsStepper.cycle(langs, "en", -1))
        assertEquals("en", SettingsStepper.cycle(langs, "ar", +1))
    }

    @Test
    fun packsAndDifficulties() {
        val all = listOf("a", "b", "c")
        assertEquals(listOf("b"), SettingsStepper.togglePack(emptyList(), "b", all))
        assertEquals(listOf("a", "b"), SettingsStepper.togglePack(listOf("b"), "a", all))
        assertEquals(emptyList<String>(), SettingsStepper.togglePack(listOf("b"), "b", all)) // last one off → all
        assertEquals(emptyList<String>(), SettingsStepper.togglePack(listOf("a", "b"), "c", all)) // every pack → all
        assertEquals(listOf(1, 3), SettingsStepper.toggleDifficulty(listOf(1, 2, 3), 2))
        assertEquals(listOf(1, 2, 3), SettingsStepper.toggleDifficulty(listOf(3, 1), 2))
        assertNull(SettingsStepper.toggleDifficulty(listOf(2), 2))
    }

    @Test
    fun packLabelShowsOnlyTheRoomLanguagesSelectedPacks() {
        data class P(val id: String, val locale: String)
        val avail = listOf(P("en-everyday-01", "en"), P("fr-everyday-01", "fr"), P("ar-everyday-01", "ar-LB"), P("en-food-01", "en"))
        val defaults = listOf("en-everyday-01", "fr-everyday-01", "ar-everyday-01")
        assertEquals(listOf("en-everyday-01"), SettingsStepper.selectedPacks(defaults, "en", avail, { it.id }, { it.locale }).map { it.id })
        assertEquals(listOf("ar-everyday-01"), SettingsStepper.selectedPacks(defaults, "ar", avail, { it.id }, { it.locale }).map { it.id })
        assertEquals(emptyList<P>(), SettingsStepper.selectedPacks(listOf("fr-everyday-01"), "en", avail, { it.id }, { it.locale }))
    }
}
