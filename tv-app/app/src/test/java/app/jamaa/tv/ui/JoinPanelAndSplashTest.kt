package app.jamaa.tv.ui

import app.jamaa.tv.Constants
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.ui.components.JoinPanelMetrics
import app.jamaa.tv.ui.screens.LobbyMetrics
import app.jamaa.tv.ui.screens.SplashGeometry
import org.junit.Assert.assertTrue
import org.junit.Test
import java.awt.Font
import java.awt.font.FontRenderContext
import java.io.File
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max

/**
 * DESIGN-JAMAA §2.1 join panel and HUB-01 splash: the hub's code and its `host/CODE` line fit the 200 dp tile width
 * with the real Cairo fonts, and no splash character ever overlaps the wordmark, at rest or anywhere on its entrance.
 */
class JoinPanelAndSplashTest {
    private fun font(name: String): Font {
        val file = listOf("src/main/res/font/$name", "app/src/main/res/font/$name", "tv-app/app/src/main/res/font/$name")
            .map(::File).firstOrNull { it.isFile } ?: error("font $name not found")
        return Font.createFont(Font.TRUETYPE_FONT, file).deriveFont(1000f)
    }

    private fun em(f: Font, text: String): Double =
        f.createGlyphVector(FontRenderContext(null, false, true), text).logicalBounds.width / 1000.0

    @Test
    fun hubCodeIsBigAndTheAddressFitsWithTheCode() {
        val black = font("cairo_black.ttf")
        val widest = Constants.ROOM_CODE_ALPHABET.maxBy { em(black, it.toString()) }.toString().repeat(Constants.ROOM_CODE_LENGTH)
        // Ink width (the trailing tracking is taken back) at the code's 50 dp line: 50 / 1.08 ≈ 46 dp letters.
        val size = 50 / 1.08
        val ink = (em(black, widest) + (Constants.ROOM_CODE_LENGTH - 1) * LobbyMetrics.CODE_TRACKING_EM) * size
        assertTrue("$widest is $ink dp at $size dp", ink <= HubModel.PANEL_GATHERING_DP)
        // The production host with the code fits at ≥ 12 dp (JoinAddress's minimum before it drops the code).
        val semi = font("cairo_semibold.ttf")
        val line = "play.mishana.workers.dev/$widest"
        val at12 = em(semi, line) * 12
        assertTrue("$line is $at12 dp at 12 dp", at12 <= JoinPanelMetrics.HUB_QR_DP)
    }

    @Test
    fun splashCharactersNeverTouchTheWordmark() {
        val wordW = 200f
        val wordH = 200f * 0.739f // the bilingual lockup's aspect (BrandPaths box + padding)
        val ring = SplashGeometry.ring(wordW, wordH, 36f)
        val r = 18f
        val a = wordW / 2
        val b = wordH / 2
        fun clearance(x: Float, y: Float): Float {
            val dx = max(abs(x) - a, 0f)
            val dy = max(abs(y) - b, 0f)
            return hypot(dx, dy) - r
        }
        // At rest, and along the spiral (k ≥ 1, any turn).
        for (i in 0 until 12) {
            for (k in listOf(1f, 1.05f, 1.3f, 2f, 3.4f)) {
                for (s in 0..36) {
                    val (x, y) = ring.slot(i, 12, k, turn = -PI * 0.66 * s / 36)
                    assertTrue("slot $i k $k step $s clearance ${clearance(x, y)}", clearance(x, y) >= SplashGeometry.GAP - 0.5f)
                }
            }
        }
        // The ring box fits the safe area's height with the slogan (8 + 28) and the status slot (16 + 140).
        assertTrue("ring ${ring.boxW} × ${ring.boxH}", ring.boxH + 8 + 28 + 16 + 140 <= 486 && ring.boxW <= 864)
    }
}
