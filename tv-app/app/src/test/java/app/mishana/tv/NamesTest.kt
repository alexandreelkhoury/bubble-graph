package app.mishana.tv

import app.mishana.tv.game.Names
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NamesTest {
    @Test
    fun ellipsizeCountsGraphemes() {
        assertEquals("Rami", Names.ellipsize("Rami", 12))
        assertEquals("Abcdefghijkl", Names.ellipsize("Abcdefghijkl", 12))
        assertEquals("Abcdefghijkl…", Names.ellipsize("Abcdefghijklm", 12))
        assertEquals("نور", Names.ellipsize("نور", 12))
        // A combining sequence counts as one character and is never split.
        val e = "é"
        assertEquals(e.repeat(3), Names.ellipsize(e.repeat(3), 3))
        assertEquals(e.repeat(2) + "…", Names.ellipsize(e.repeat(3), 2))
    }

    @Test
    fun arabicDetection() {
        assertTrue(Names.hasArabic("نور"))
        assertTrue(Names.hasArabic("Rami نور"))
        assertFalse(Names.hasArabic("Léa"))
    }
}
