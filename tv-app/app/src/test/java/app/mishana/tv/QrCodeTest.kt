package app.mishana.tv

import app.mishana.tv.ui.components.QrMatrix
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** SPEC §9.9: module size ≥ 6 dp at a 240 dp panel for the production and LAN-dev URL shapes. */
class QrCodeTest {
    private fun moduleFor(url: String): Int {
        val m = QrMatrix.encode(QrMatrix.content(url))
        assertEquals("square matrix", m.width, m.height)
        return QrMatrix.moduleDp(240, m.width)
    }

    @Test
    fun productionShape() {
        assertTrue(moduleFor("https://mish-ana.example.workers.dev/KXRT") >= 6)
        // The longest production shape SPEC allows: 61 characters upper-cased.
        val host = "mish-ana." + "x".repeat(61 - "https://mish-ana..workers.dev/KXRT".length) + ".workers.dev"
        val longest = "https://$host/KXRT"
        assertEquals(61, longest.length)
        assertTrue(moduleFor(longest) >= 6)
    }

    @Test
    fun lanDevShape() {
        assertTrue(moduleFor("http://192.168.100.200:8787/KXRT") >= 6)
        assertTrue(moduleFor("http://10.0.0.5:8787/ABCD") >= 6)
    }

    @Test
    fun moduleFormula() {
        assertEquals(6, QrMatrix.moduleDp(240, 29)) // version 3 → 240 / 37
        assertEquals(7, QrMatrix.moduleDp(240, 25)) // version 2 → 240 / 33
        assertEquals("HTTPS://A.B/KXRT", QrMatrix.content("https://a.b/KXRT"))
    }
}
