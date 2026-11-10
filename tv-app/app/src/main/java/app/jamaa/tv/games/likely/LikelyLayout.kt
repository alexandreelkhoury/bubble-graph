package app.jamaa.tv.games.likely

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Kotlin mirror of shared/src/games/likely/layout.ts (GAME-LIKELY §12.7, DESIGN-JAMAA §6.4.3 "one layout math"): the
// jury arc and the reveal conga lines in TV dp (the 864 × 486 safe area). Line for line with the TS file; both sides
// assert shared/fixtures/v2/games/likely/layout.json (LikelyLayoutTest). No randomness.

data class LikelyPt(val x: Double, val y: Double)

object LikelyLayout {
    const val WIDTH = 864.0
    const val HEIGHT = 486.0

    /** Feet line of the jury arc at its centre. */
    const val ARC_Y = 336.0

    /** How much higher the two ends of the arc sit than its centre. */
    const val ARC_LIFT = 28.0

    /** Character box (dp); 12 characters at 72 dp fit the 792 dp spread. */
    const val CHAR_SIZE = 72.0
    const val MAX_SPREAD = 792.0
    const val MAX_STEP = 104.0

    /** Conga: the first 6 runners stand in a diagonal line behind the target, sideways and slightly up. 44 dp against a
     *  72 dp character keeps each runner's face clear of the one in front (shared layout.ts, G3 review). */
    const val CONGA_DX = 44.0
    const val CONGA_DY = -16.0
    const val CONGA_STRAIGHT = 6
    const val CURL_RADIUS = 40.0
    const val CURL_SHRINK = 3.0
    const val CURL_STEP_DEG = 52.0

    /** The x range a character's centre may take: its whole 72 dp box stays inside the 864 dp safe area. */
    const val CONGA_MIN_X = CHAR_SIZE / 2
    const val CONGA_MAX_X = WIDTH - CHAR_SIZE / 2

    /** JS `Math.round(v * 10) / 10` (floor(v + 0.5) semantics, also for negatives). */
    fun r1(v: Double): Double = floor(v * 10 + 0.5) / 10

    /** Seat-order positions of n characters on the jury arc (centre of the feet). RTL: seat 0 is on the right. */
    fun juryArc(n: Int, rtl: Boolean = false): List<LikelyPt> {
        if (n <= 0) return emptyList()
        val cx = WIDTH / 2
        val step = if (n > 1) min(MAX_STEP, MAX_SPREAD / (n - 1)) else 0.0
        val half = step * (n - 1) / 2
        return (0 until n).map { i ->
            val dx = -half + i * step
            val u = if (half > 0) dx / half else 0.0
            val x = if (rtl) cx - dx else cx + dx
            LikelyPt(r1(x), r1(ARC_Y - ARC_LIFT * u * u))
        }
    }

    /** How far sideways a straight line of [count] runners reaches from its target. */
    private fun reach(count: Int): Double = CONGA_DX * count.coerceIn(1, CONGA_STRAIGHT)

    private fun fits(target: LikelyPt, side: Int, count: Int): Boolean {
        val x = target.x + side * reach(count)
        return x >= CONGA_MIN_X && x <= CONGA_MAX_X
    }

    /**
     * The side a line of [count] runners grows on: away from the stage centre (+1 right of centre, -1 otherwise), unless
     * that would leave the safe area while the other side fits (an outer seat then lines up toward the centre).
     */
    fun congaSide(target: LikelyPt, count: Int = 1): Int {
        val out = if (target.x >= WIDTH / 2) 1 else -1
        return if (fits(target, out, count) || !fits(target, -out, count)) out else -out
    }

    /**
     * The k-th place (k ≥ 1) behind [target]: 1..6 diagonally sideways and up, then a shrinking spiral around a point
     * above place 6. A place that would leave the safe area is pinned to its edge and climbs instead (1 dp up per dp
     * of overflow), so nobody walks off the stage.
     */
    fun congaSlot(target: LikelyPt, k: Int, side: Int = congaSide(target)): LikelyPt {
        var x: Double
        var y: Double
        if (k <= CONGA_STRAIGHT) {
            x = target.x + side * CONGA_DX * k
            y = target.y + CONGA_DY * k
        } else {
            val cx = target.x + side * CONGA_DX * CONGA_STRAIGHT
            val cy = target.y + CONGA_DY * CONGA_STRAIGHT - CURL_RADIUS
            val j = k - CONGA_STRAIGHT
            val radius = max(8.0, CURL_RADIUS - CURL_SHRINK * j)
            val deg = 90 - side * CURL_STEP_DEG * j
            val rad = deg * PI / 180
            x = cx + radius * cos(rad)
            y = cy + radius * sin(rad)
        }
        val over = if (x < CONGA_MIN_X) CONGA_MIN_X - x else if (x > CONGA_MAX_X) x - CONGA_MAX_X else 0.0
        if (over > 0) {
            x = if (x < CONGA_MIN_X) CONGA_MIN_X else CONGA_MAX_X
            y -= over
        }
        return LikelyPt(r1(x), r1(y))
    }

    /** Places 1..count behind [target]. */
    fun conga(target: LikelyPt, count: Int, side: Int = congaSide(target, count)): List<LikelyPt> =
        (1..count).map { congaSlot(target, it, side) }

    /**
     * The side of every line in a reveal ([lines]: target id → runners; [at]: target id → arc position). Each line first
     * takes [congaSide]; then, left to right, two neighbouring lines that would run into each other are turned apart
     * (the left one left, the right one right), each only where it still fits the safe area.
     */
    fun congaSides(lines: Map<String, Int>, at: Map<String, LikelyPt>): Map<String, Int> {
        val half = CHAR_SIZE / 2
        val ids = lines.keys.filter { it in at && (lines[it] ?: 0) > 0 }
            .sortedWith(compareBy<String> { at.getValue(it).x }.thenBy { it })
        val side = LinkedHashMap<String, Int>()
        for (id in ids) side[id] = congaSide(at.getValue(id), lines.getValue(id))
        for (i in 1 until ids.size) {
            val a = ids[i - 1]
            val b = ids[i]
            val pa = at.getValue(a)
            val pb = at.getValue(b)
            val ca = lines.getValue(a)
            val cb = lines.getValue(b)
            val gap = pb.x - pa.x - half
            val clash = (side[a] == 1 && reach(ca) >= gap) || (side[b] == -1 && reach(cb) >= gap)
            if (!clash) continue
            if (side[a] == 1 && fits(pa, -1, ca)) side[a] = -1
            if (side[b] == -1 && fits(pb, 1, cb)) side[b] = 1
        }
        return side
    }

    /**
     * Public-mode reveal (§12.2 step 2): where each voter's character ends. A self-voter stays in its seat
     * (`pointSelf`); every other voter joins the line behind its target in ballot order, on the side chosen by
     * [congaSides]. Unknown ids are skipped.
     */
    fun revealPositions(arc: List<LikelyPt>, seatIds: List<String>, ballots: List<LikelyBallot>): Map<String, LikelyPt> {
        val at = LinkedHashMap<String, LikelyPt>()
        seatIds.forEachIndexed { i, id -> arc.getOrNull(i)?.let { at[id] = it } }
        val lines = LinkedHashMap<String, Int>()
        for (b in ballots) if (b.voterId != b.targetId && b.voterId in at && b.targetId in at) lines[b.targetId] = (lines[b.targetId] ?: 0) + 1
        val sides = congaSides(lines, at)
        val lineLen = HashMap<String, Int>()
        val out = LinkedHashMap<String, LikelyPt>()
        for (b in ballots) {
            val target = at[b.targetId] ?: continue
            val seat = at[b.voterId] ?: continue
            if (b.voterId == b.targetId) {
                out[b.voterId] = seat
                continue
            }
            val k = (lineLen[b.targetId] ?: 0) + 1
            lineLen[b.targetId] = k
            out[b.voterId] = congaSlot(target, k, sides[b.targetId] ?: congaSide(target))
        }
        return out
    }
}
