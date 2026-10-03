package app.mishana.tv

import app.mishana.tv.ui.screens.LobbyMetrics
import org.junit.Assert.assertTrue
import org.junit.Test
import java.awt.Font
import java.awt.font.FontRenderContext
import java.io.File

/**
 * The lobby code and join host are fit-to-width single lines (never wrapped or ellipsized). This checks, with the
 * real Cairo fonts, that the worst cases still fit the 264 dp column at the smallest size the text may step down to.
 * Advance widths in em are size-independent, so "fits at N dp" = em width × N ≤ 264.
 */
class LobbyMetricsTest {
    private fun font(name: String): Font {
        val file = listOf("src/main/res/font/$name", "app/src/main/res/font/$name", "tv-app/app/src/main/res/font/$name")
            .map(::File).firstOrNull { it.isFile } ?: error("font $name not found from ${File(".").absolutePath}")
        return Font.createFont(Font.TRUETYPE_FONT, file).deriveFont(1000f)
    }

    /** Advance width of [text] in em (no kerning, as a plain run). */
    private fun em(f: Font, text: String): Double {
        val gv = f.createGlyphVector(FontRenderContext(null, false, true), text)
        return gv.logicalBounds.width / 1000.0
    }

    @Test
    fun widestRoomCodeFitsTheColumnAtTheMinimumSize() {
        val black = font("cairo_black.ttf")
        val widest = Constants.ROOM_CODE_ALPHABET.maxBy { em(black, it.toString()) }
        val code = widest.toString().repeat(Constants.ROOM_CODE_LENGTH)
        // Android letterSpacing adds the tracking to every glyph's advance.
        val width = (em(black, code) + Constants.ROOM_CODE_LENGTH * LobbyMetrics.CODE_TRACKING_EM) * LobbyMetrics.CODE_MIN_DP
        assertTrue("$code is $width dp at ${LobbyMetrics.CODE_MIN_DP} dp", width <= LobbyMetrics.START_COLUMN_DP)
        // The review's failing case: MWMW used to wrap its last letter at 72 sp.
        val mwmw = (em(black, "MWMW") + 4 * LobbyMetrics.CODE_TRACKING_EM) * LobbyMetrics.CODE_MIN_DP
        assertTrue(mwmw <= LobbyMetrics.START_COLUMN_DP)
    }

    @Test
    fun longJoinHostFitsTheColumnAtTheMinimumSize() {
        val semibold = font("cairo_semibold.ttf")
        // The placeholder host and a longer workers.dev account subdomain (the real prod host is set at deploy time).
        for (host in listOf("mish-ana.example.workers.dev", "mish-ana.some-account-name.workers.dev")) {
            val width = em(semibold, host) * LobbyMetrics.HOST_MIN_DP
            assertTrue("$host is $width dp at ${LobbyMetrics.HOST_MIN_DP} dp", width <= LobbyMetrics.START_COLUMN_DP)
        }
    }
}
