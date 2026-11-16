package app.jamaa.tv

import app.jamaa.tv.ui.components.QrMatrix
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
        assertTrue(moduleFor("https://play.example.workers.dev/KXRT") >= 6)
        // The longest production shape SPEC allows: 61 characters upper-cased.
        val host = "play." + "x".repeat(61 - "https://play..workers.dev/KXRT".length) + ".workers.dev"
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

    @Test
    fun pixelModulesKeepTheQuietZoneNearFourModules() {
        // The hub tile (200 dp) and the setup / intro / compact tiles at 2.0 density (1080p TV), then at 1.5 and 3.0.
        for (density in listOf(2.0f, 1.5f, 3.0f)) {
            // Small corner tiles are checked at the 1080p TV density only (at 1.5 their 4 px modules round coarsely).
            for (dp in listOf(200, 184, 176, 152, 120, 104).filter { it >= 176 || density == 2.0f }) {
                for (url in listOf("https://jamaa.example.workers.dev/ZUZQ", "http://192.168.100.200:8787/KXRT", "https://play.some-long-account-name.workers.dev/KXRT")) {
                    val w = QrMatrix.encode(QrMatrix.content(url)).width
                    val px = (dp * density).toInt()
                    val q = QrMatrix.quietModules(px, w)
                    // Big tiles stay near 4 modules; the small corner tiles (5–6 px modules) may round up to ~6.
                    assertTrue("$url @ $dp dp × $density: quiet $q", q >= 4f && q < (if (dp >= 176) 6f else 7f))
                    assertTrue("$url @ $dp dp × $density: module ${QrMatrix.modulePx(px, w)} px", QrMatrix.modulePx(px, w) >= 3)
                }
            }
        }
        // The old whole-dp module left 7.5 modules of margin on the hub's version-2 code; pixel modules leave < 5.
        // The hub's version-2 code on the 200 dp tile at 2.0: 12 px modules, 4.2 modules of quiet zone (whole-dp
        // modules gave 5 dp = 10 px and 7.5 modules).
        assertEquals(12, QrMatrix.modulePx(400, 25))
        assertEquals(4.17f, QrMatrix.quietModules(400, 25), 0.01f)
    }
}
