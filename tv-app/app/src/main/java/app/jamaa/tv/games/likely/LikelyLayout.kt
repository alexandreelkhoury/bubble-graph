package app.jamaa.tv.games.likely

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Kotlin mirror of shared/src/games/likely/layout.ts (GAME-LIKELY §12.2 / §12.7, DESIGN-JAMAA §6.4.3 "one layout math"):
// the card, ONE centred row of players and the vote stacks under their targets, in stage units (the 864 × 442 area
// under the 44 dp game header; 1 unit = 1 dp on a 960 × 540 dp TV). Line for line with the TS file; both sides assert
// shared/fixtures/v2/games/likely/layout.json (LikelyLayoutTest). No randomness. Owner redesign 2026-11-12: no
// left/right split; the voters' tokens stack under the person they voted for.

data class LikelyPt(val x: Double, val y: Double)

/** The token grid of a reveal: [cols] tokens side by side, [cell] units per token (one size for every stack). */
data class LikelyStackGrid(val cols: Int, val cell: Double)

/** One vote of the reveal, landing under its target ([voterId] null with secret votes: an anonymous envelope). */
data class LikelyToken(val voterId: String?, val targetId: String, val k: Int, val at: LikelyPt)

object LikelyLayout {
    const val WIDTH = 864.0
    const val HEIGHT = 442.0
    const val CARD_TOP = 8.0
    const val CARD_WIDTH = 700.0
    const val CARD_HEIGHT = 236.0
    const val CARD_REVEAL_SCALE = 0.5
    const val ROW_Y = 374.0
    const val ROW_LIFT = 14.0
    const val CHAR_SIZE = 72.0
    const val REVEAL_CHAR = 64.0
    const val MAX_SPREAD = 792.0
    const val MAX_STEP = 150.0
    const val BANNER_Y = 146.0
    const val REVEAL_ROW_Y = 240.0
    const val STACK_TOP = 276.0
    const val STACK_BOTTOM = 442.0
    const val CELL_MAX = 44.0
    const val CELL_MIN = 22.0
    const val STACK_COLS_MAX = 3

    /** JS `Math.round(v * 10) / 10` (floor(v + 0.5) semantics, also for negatives). */
    fun r1(v: Double): Double = floor(v * 10 + 0.5) / 10

    /** Distance between two neighbours of a row of [n] characters. */
    fun rowStep(n: Int): Double = if (n > 1) min(MAX_STEP, MAX_SPREAD / (n - 1)) else MAX_STEP

    /** Seat-order feet positions of [n] characters in one centred row: a gentle arc (CARD/VOTING) or flat ([reveal]). RTL: seat 0 on the right. */
    fun row(n: Int, rtl: Boolean = false, reveal: Boolean = false): List<LikelyPt> {
        if (n <= 0) return emptyList()
        val cx = WIDTH / 2
        val step = rowStep(n)
        val half = step * (n - 1) / 2
        return (0 until n).map { i ->
            val dx = -half + i * step
            val u = if (half > 0) dx / half else 0.0
            val x = if (rtl) cx - dx else cx + dx
            LikelyPt(r1(x), r1(if (reveal) REVEAL_ROW_Y else ROW_Y - ROW_LIFT * u * u))
        }
    }

    /** TS `likelyStackGrid`: columns the row step allows (≤ 3), cell fitting the step, the stage edges and the zone height. */
    fun stackGrid(n: Int, maxCount: Int): LikelyStackGrid {
        val step = rowStep(n)
        val colsMax = max(1, min(STACK_COLS_MAX, floor(step / 30).toInt()))
        val m = max(1, maxCount)
        val cols = min(colsMax, m)
        val rows = ceil(m.toDouble() / cols)
        val edge = 2 * (WIDTH / 2 - step * (max(1, n) - 1) / 2) / cols
        val cell = max(CELL_MIN, minOf(CELL_MAX, (step - 4) / cols, edge, (STACK_BOTTOM - STACK_TOP) / rows))
        return LikelyStackGrid(cols, floor(cell * 10) / 10)
    }

    /** TS `likelyStackSlot`: the centre of the k-th token (k ≥ 0) of a stack of [count] under [target]. */
    fun stackSlot(target: LikelyPt, k: Int, count: Int, grid: LikelyStackGrid, rtl: Boolean = false): LikelyPt {
        val row = k / grid.cols
        val col = k % grid.cols
        val inRow = min(grid.cols, count - row * grid.cols)
        val dx = (col - (inRow - 1) / 2.0) * grid.cell * (if (rtl) -1 else 1)
        return LikelyPt(r1(target.x + dx), r1(STACK_TOP + row * grid.cell + grid.cell / 2))
    }

    /** TS `likelyPublicTokens`: one token per ballot, in ballot order, self-votes included; unknown ids skipped. */
    fun publicTokens(row: List<LikelyPt>, ids: List<String>, ballots: List<LikelyBallot>, rtl: Boolean = false): List<LikelyToken> {
        val at = LinkedHashMap<String, LikelyPt>()
        ids.forEachIndexed { i, id -> row.getOrNull(i)?.let { at[id] = it } }
        val valid = ballots.filter { it.voterId in at && it.targetId in at }
        val count = HashMap<String, Int>()
        for (b in valid) count[b.targetId] = (count[b.targetId] ?: 0) + 1
        val grid = stackGrid(ids.size, count.values.maxOrNull() ?: 0)
        val seen = HashMap<String, Int>()
        return valid.map { b ->
            val k = seen[b.targetId] ?: 0
            seen[b.targetId] = k + 1
            LikelyToken(b.voterId, b.targetId, k, stackSlot(at.getValue(b.targetId), k, count.getValue(b.targetId), grid, rtl))
        }
    }

    /** TS `likelySecretTokens`: anonymous envelopes from the tally only, round-robin across targets in seat order. */
    fun secretTokens(row: List<LikelyPt>, ids: List<String>, counts: List<LikelyCount>, rtl: Boolean = false): List<LikelyToken> {
        val at = LinkedHashMap<String, LikelyPt>()
        ids.forEachIndexed { i, id -> row.getOrNull(i)?.let { at[id] = it } }
        val by = LinkedHashMap<String, Int>()
        for (c in counts) if (c.playerId in at && c.count > 0) by[c.playerId] = c.count
        val most = by.values.maxOrNull() ?: 0
        val grid = stackGrid(ids.size, most)
        val out = mutableListOf<LikelyToken>()
        for (k in 0 until most) for (id in ids) {
            val c = by[id] ?: 0
            if (k < c) out += LikelyToken(null, id, k, stackSlot(at.getValue(id), k, c, grid, rtl))
        }
        return out
    }
}
