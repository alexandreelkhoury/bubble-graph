package app.jamaa.tv.ui.setup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * HUB-03 players pane (DESIGN-JAMAA §2.3): 1..12 seats always fit the 196 dp wide room left above the QR and the
 * room code, in Latin (caption 26 dp) and Arabic (30 dp) line heights, and a 3-per-row cell never exceeds the width.
 */
class GangGridTest {
    private val width = 196

    // Pane 422 − 2 × 10 padding = 402; title (titleS + 6) ≈ 34 / 40 (AR); room code 52.
    private fun budget(n: Int, short: Boolean, arabic: Boolean): Int {
        val title = if (arabic) 40 else 34
        val footer = if (short) 2 * (if (arabic) 30 else 24) + 4 + 176 + 52 else (if (n > 8) 104 else 120) + 52
        return 402 - title - footer
    }

    @Test
    fun everyRoomSizeFits() {
        for (arabic in listOf(false, true)) {
            val nameLh = (if (arabic) 30 else 26) + 1
            for (n in 1..12) {
                for (short in listOf(false, true)) {
                    if (short && n > 3) continue // short of players: the slots are minPlayers (3) at most
                    val h = budget(n, short, arabic)
                    val fit = GangGrid.fit(n, width, h, nameLh)
                    assertTrue("n=$n short=$short ar=$arabic: ${fit.height(n, nameLh)} > $h", fit.height(n, nameLh) <= h)
                    assertTrue("n=$n width ${fit.width()}", fit.width() <= width)
                    assertTrue(fit.char >= GangGrid.MIN_CHAR)
                    assertTrue(fit.char <= fit.cell)
                }
            }
        }
    }

    @Test
    fun prefersBigCharactersThreePerRow() {
        // A small room: three 52 dp characters in 60 dp cells (3 × 60 + 2 × 4 = 188 ≤ 196).
        val three = GangGrid.fit(3, width, 196, 27)
        assertEquals(3, three.perRow)
        assertEquals(60, three.cell)
        assertEquals(52, three.char)
        // Eight members: two rows of four 44 dp characters beat three rows of small ones.
        val eight = GangGrid.fit(8, width, 196, 27)
        assertEquals(4, eight.perRow)
        assertEquals(44, eight.char)
        assertEquals(5, eight.graphemes)
    }
}
