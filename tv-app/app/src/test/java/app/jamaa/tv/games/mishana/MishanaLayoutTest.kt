package app.jamaa.tv.games.mishana

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** DESIGN TV-04…TV-11 "fill the stage": the layout math keeps 3–12 players inside the box it is given. */
class MishanaLayoutTest {
    // Vote stage (TV-06): 864 dp wide; what is left under the title/sub-line above the action bar.
    private val boxes = listOf(864f to 240f, 864f to 200f, 864f to 300f)

    @Test fun voteGridFitsEveryCountAndBox() {
        for ((w, h) in boxes) {
            for (n in 3..12) {
                val g = MishanaLayout.voteGrid(n, w, h)
                assertTrue("n=$n $w×$h width ${g.width}", g.width <= w + 0.5f)
                assertTrue("n=$n $w×$h height ${g.height}", g.height <= h + 0.5f || g.tileW == MishanaLayout.TILE_MIN_W)
                assertTrue("n=$n all tiles placed", g.cols * g.rows >= n)
                assertTrue("n=$n no empty row", (g.rows - 1) * g.cols < n)
            }
        }
    }

    @Test fun fewPlayersGetBigTilesInOneRow() {
        val g = MishanaLayout.voteGrid(4, 864f, 240f)
        assertEquals(1, g.rows)
        assertTrue(g.tileW >= 180f)
        assertTrue(g.avatar >= 80f)
    }

    @Test fun twelvePlayersUseTwoRowsOfSix() {
        val g = MishanaLayout.voteGrid(12, 864f, 240f)
        assertEquals(6, g.cols)
        assertEquals(2, g.rows)
        assertTrue(g.tileW >= 110f)
    }

    @Test fun revealRowsBalanced() {
        assertEquals(listOf(3), MishanaLayout.revealRows(3))
        assertEquals(listOf(6), MishanaLayout.revealRows(6))
        assertEquals(listOf(4, 3), MishanaLayout.revealRows(7))
        assertEquals(listOf(6, 6), MishanaLayout.revealRows(12))
    }

    @Test fun revealAvatarFitsWidthAndHeight() {
        for (n in 3..12) {
            val rows = MishanaLayout.revealRows(n)
            val a = MishanaLayout.revealAvatar(n, 864f, 220f, 32f)
            val cols = rows.max()
            assertTrue("n=$n width", cols * (a + 40f) + (cols - 1) * 20f <= 864f)
            assertTrue("n=$n height", rows.size * (a + 6f + 32f) + (rows.size - 1) * 12f <= 220f + 0.5f || a == 36f)
            assertTrue("n=$n ≤ 112", a <= 112f)
        }
    }

    @Test fun scoreBoardShowsEveryPlayerWithoutScrolling() {
        for (n in 3..12) {
            val b = MishanaLayout.scoreBoard(n, 230f, minRow = 34f)
            assertTrue("n=$n rows", b.columns * b.perColumn >= n)
            assertTrue("n=$n height", b.perColumn * b.rowH + (b.perColumn - 1) * 4f <= 230f + 0.5f)
            assertTrue("n=$n row ≥ 28", b.rowH >= 28f)
        }
        assertEquals(1, MishanaLayout.scoreBoard(5, 230f, minRow = 34f).columns)
        assertEquals(2, MishanaLayout.scoreBoard(12, 230f, minRow = 34f).columns)
    }

    @Test fun fitScaleNeverGrows() {
        assertEquals(1f, MishanaLayout.fitScale(100f, 200f), 0f)
        assertEquals(0.5f, MishanaLayout.fitScale(400f, 200f), 0.0001f)
    }
}
