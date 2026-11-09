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

    const val CONGA_DX = 30.0
    const val CONGA_DY = -12.0
    const val CONGA_STRAIGHT = 6
    const val CURL_RADIUS = 40.0
    const val CURL_SHRINK = 3.0
    const val CURL_STEP_DEG = 52.0

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

    /** +1 when the line grows to the right of its target (targets right of centre), -1 otherwise: lines curl outward. */
    fun congaSide(target: LikelyPt): Int = if (target.x >= WIDTH / 2) 1 else -1

    /** The k-th place (k ≥ 1) behind [target]: 1..6 diagonally outward and up, then a shrinking spiral. */
    fun congaSlot(target: LikelyPt, k: Int, side: Int = congaSide(target)): LikelyPt {
        if (k <= CONGA_STRAIGHT) return LikelyPt(r1(target.x + side * CONGA_DX * k), r1(target.y + CONGA_DY * k))
        val p6x = target.x + side * CONGA_DX * CONGA_STRAIGHT
        val p6y = target.y + CONGA_DY * CONGA_STRAIGHT
        val cx = p6x
        val cy = p6y - CURL_RADIUS
        val j = k - CONGA_STRAIGHT
        val radius = max(8.0, CURL_RADIUS - CURL_SHRINK * j)
        val deg = 90 - side * CURL_STEP_DEG * j
        val rad = deg * PI / 180
        return LikelyPt(r1(cx + radius * cos(rad)), r1(cy + radius * sin(rad)))
    }

    /** Places 1..count behind [target]. */
    fun conga(target: LikelyPt, count: Int): List<LikelyPt> {
        val side = congaSide(target)
        return (1..count).map { congaSlot(target, it, side) }
    }

    /**
     * Public-mode reveal (§12.2 step 2): where each voter's character ends. A self-voter stays in its seat
     * (`pointSelf`); every other voter joins the line behind its target in ballot order. Unknown ids are skipped.
     */
    fun revealPositions(arc: List<LikelyPt>, seatIds: List<String>, ballots: List<LikelyBallot>): Map<String, LikelyPt> {
        val at = seatIds.indices.associate { seatIds[it] to arc[it] }
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
            out[b.voterId] = congaSlot(target, k)
        }
        return out
    }
}
