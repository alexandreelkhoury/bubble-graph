package app.jamaa.tv.games.mishana

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Mish Ana! TV layout math (DESIGN TV-04…TV-11, "fill the stage"), pure and in dp so it is JVM-tested for 3–12
 * players (MishanaLayoutTest). The screens give it the box they measured (BoxWithConstraints), never constants for
 * the stage height: Arabic line heights, the font scale and the platform chrome all change what is left.
 */
object MishanaLayout {
    /** Live area of the 960 × 540 canvas (48 dp sides, 27 dp top and bottom). */
    const val SAFE_W = 864f

    /** A tile's height for its width (the avatar over a name line). */
    const val TILE_ASPECT = 0.86f
    const val TILE_MAX_W = 196f
    const val TILE_MIN_W = 96f

    /** One grid of player tiles: [cols] × [rows], each [tileW] × [tileH] dp, [gapX]/[gapY] apart. */
    data class Grid(val cols: Int, val rows: Int, val tileW: Float, val tileH: Float, val avatar: Float, val gapX: Float, val gapY: Float) {
        val width: Float get() = cols * tileW + (cols - 1) * gapX
        val height: Float get() = rows * tileH + (rows - 1) * gapY
    }

    /**
     * The vote board (TV-06, reused by the reveal TV-07 so the tiles do not move between the two screens): n tiles
     * in the [w] × [h] box. Tries 1–3 rows and keeps the one with the biggest tiles (ties: fewer rows), tiles
     * 96–196 dp wide at [TILE_ASPECT]; [gapY] leaves room above each row (the reveal's chip stacks).
     */
    fun voteGrid(n: Int, w: Float, h: Float, gapX: Float = 16f, gapY: Float = 16f): Grid {
        val count = n.coerceAtLeast(1)
        var best: Grid? = null
        for (rows in 1..3) {
            val cols = ceil(count / rows.toFloat()).toInt()
            if ((rows - 1) * cols >= count) continue // an empty last row
            val byW = (w - (cols - 1) * gapX) / cols
            val byH = (h - (rows - 1) * gapY) / rows / TILE_ASPECT
            val tw = floor(min(TILE_MAX_W, min(byW, byH)).coerceAtLeast(TILE_MIN_W))
            val g = Grid(cols, rows, tw, floor(tw * TILE_ASPECT), avatarFor(tw * TILE_ASPECT), gapX, gapY)
            if (best == null || g.tileW > best.tileW + 0.5f) best = g
        }
        return best!!
    }

    /** Avatar size inside a tile of height [tileH] (the name line and the paddings take the rest). */
    fun avatarFor(tileH: Float): Float = floor((tileH * 0.56f).coerceIn(40f, 112f))

    /** TV-04: the ready avatars in one row up to 6 players, else two balanced rows. */
    fun revealRows(n: Int): List<Int> = when {
        n <= 0 -> emptyList()
        n <= 6 -> listOf(n)
        else -> listOf((n + 1) / 2, n / 2)
    }

    /**
     * TV-04 avatar size: as big as the widest row allows (each avatar column is avatar + 40 dp for the name, 20 dp
     * apart), at most 112 dp, and the rows must fit [h] with a name line of [nameH] dp under each avatar.
     */
    fun revealAvatar(n: Int, w: Float, h: Float, nameH: Float): Float {
        val rows = revealRows(n)
        if (rows.isEmpty()) return 0f
        val cols = rows.max()
        val byW = (w - (cols - 1) * 20f) / cols - 40f
        val byH = (h - (rows.size - 1) * 12f) / rows.size - nameH - 6f
        return floor(min(112f, min(byW, byH)).coerceAtLeast(36f))
    }

    /** TV-11 scoreboard: rows per column and the row height, in one column when it fits at ≥ [minRow] dp, else two. */
    data class Board(val columns: Int, val perColumn: Int, val rowH: Float)

    fun scoreBoard(n: Int, h: Float, gap: Float = 4f, minRow: Float = 36f, maxRow: Float = 48f): Board {
        val count = n.coerceAtLeast(1)
        fun rowFor(perCol: Int) = (h - (perCol - 1) * gap) / perCol
        if (rowFor(count) >= minRow) return Board(1, count, floor(min(maxRow, rowFor(count))))
        val perCol = (count + 1) / 2
        return Board(2, perCol, floor(min(maxRow, max(28f, rowFor(perCol)))))
    }

    /** TV-05 hero ring: what the stage height leaves, 150–260 dp. */
    fun heroRing(h: Float): Float = floor(h.coerceIn(150f, 260f))

    /** The scale a block of [content] dp needs to fit [available] dp (never grows it). */
    fun fitScale(content: Float, available: Float): Float = if (content <= available || content <= 0f) 1f else available / content
}
