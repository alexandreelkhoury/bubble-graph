package app.jamaa.tv.games.taqriban

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToLong

/**
 * GAME-TAQRIBAN §8.3: the number line and the number words, pure (JVM-tested). Same rules as the web view model
 * (web-client/src/games/taqriban/model.ts) and shared/src/games/taqriban/constants.ts (compactParts, groupDigits).
 * Positions are 0..1 from the left: numbers grow to the right in every locale (§8.2, never mirrored).
 */
object TaqribanLine {
    data class Dot(val id: String, val value: Double, val x: Float, val lane: Int)
    data class Tick(val x: Float, val value: Double)
    data class Line(val log: Boolean, val answerX: Float, val dots: List<Dot>, val ticks: List<Tick>)

    /** Magnitude words (`game.taqriban.mag.<id>`) by exponent. */
    val MAGNITUDES = listOf("thousand" to 3, "million" to 6, "billion" to 9, "trillion" to 12)

    /** Plain digits, at most 2 decimals, trailing zeros dropped ("8.5", "330"). */
    fun trimNum(v: Double): String {
        val r = (v * 100).roundToLong() / 100.0
        val s = if (r == floor(r) && abs(r) < 1e15) r.roundToLong().toString() else "%.2f".format(java.util.Locale.ROOT, r).trimEnd('0').trimEnd('.')
        return s
    }

    /** Western digits grouped by 3 with a narrow no-break space ("8 000 000 000"); always LTR. */
    fun groupDigits(v: Double): String {
        val parts = trimNum(v).split(".")
        val int = parts[0].reversed().chunked(3).joinToString(" ").reversed()
        return if (parts.size > 1) "$int.${parts[1]}" else int
    }

    /** "8.2" + "billion" for labels; below 10 000 the digits stay (no word). */
    fun compactParts(v: Double): Pair<String, String?> {
        if (v < 10_000) return trimNum(v) to null
        var pick = MAGNITUDES[0]
        for (m in MAGNITUDES) if (v >= 10.0.pow(m.second)) pick = m
        val x = v / 10.0.pow(pick.second)
        val digits = if (x >= 100) 0 else if (x >= 10) 1 else 2
        val rounded = "%.${digits}f".format(java.util.Locale.ROOT, x).toDouble()
        return trimNum(rounded) to pick.first
    }

    private fun niceStep(span: Double): Double {
        val raw = span / 5
        val p = 10.0.pow(floor(log10(raw)))
        val f = raw / p
        return (if (f < 1.5) 1.0 else if (f < 3) 2.0 else if (f < 7) 5.0 else 10.0) * p
    }

    /** Positions, ticks and lanes (≤ [lanes]); dots closer than [minGap] stack upward. */
    fun layout(answer: Double, guesses: List<Pair<String, Double>>, log: Boolean, lanes: Int = 4, minGap: Float = 0.07f): Line {
        val vals = listOf(answer) + guesses.map { it.second }
        val x: (Double) -> Double
        val ticks = mutableListOf<Tick>()
        if (log) {
            val pos = vals.filter { it > 0 }.ifEmpty { listOf(1.0) }
            val lo = log10(pos.min()) - 0.15
            val hi = log10(pos.max()) + 0.15
            x = { v -> if (v <= 0) 0.0 else (log10(v) - lo) / (hi - lo) }
            val first = ceil(lo).toInt()
            val last = floor(hi).toInt()
            val every = max(1, ceil((last - first + 1) / 7.0).toInt())
            var d = first
            while (d <= last) { ticks += Tick(x(10.0.pow(d)).toFloat(), 10.0.pow(d)); d += every }
        } else {
            val mx = vals.max()
            val mn = vals.min()
            val span = max(max(mx - mn, mx * 0.05), 1e-9)
            val lo = if (mn - span * 0.12 < 0 || mn < span * 0.5) max(0.0, mn - span * 0.12) else mn - span * 0.12
            val hi = mx + span * 0.12
            x = { v -> (v - lo) / (hi - lo) }
            val step = niceStep(hi - lo)
            var v = ceil(lo / step) * step
            while (v <= hi) { ticks += Tick(x(v).toFloat(), (v * 100).roundToLong() / 100.0); v += step }
        }
        val sorted = guesses.map { Triple(it.first, it.second, x(it.second).coerceIn(0.0, 1.0).toFloat()) }
            .sortedWith(compareBy({ it.third }, { it.first }))
        val laneEnd = mutableListOf<Float>()
        val dots = sorted.map { (id, v, px) ->
            var lane = laneEnd.indexOfFirst { px - it >= minGap }
            if (lane < 0) lane = if (laneEnd.size < lanes) laneEnd.size else laneEnd.indexOf(laneEnd.min())
            if (lane == laneEnd.size) laneEnd += px else laneEnd[lane] = px
            Dot(id, v, px, lane)
        }
        return Line(log, x(answer).coerceIn(0.0, 1.0).toFloat(), dots, ticks.filter { it.x in 0f..1f })
    }

    /** Reveal timeline (ms from the REVEAL start): the line, the guesses one by one, a beat, the pin, the stamp. */
    object Timeline {
        const val LINE_IN = 300L
        const val FIRST_DOT = 700L
        const val STEP = 260L
        const val BEAT = 900L
        const val STAMP = 700L
        fun dotAt(i: Int): Long = FIRST_DOT + STEP * i
        fun answerAt(n: Int): Long = FIRST_DOT + STEP * max(0, n - 1) + BEAT
        fun stampAt(n: Int): Long = answerAt(n) + STAMP
        /** Everything has landed: OK completes the reveal to here. */
        fun doneAt(n: Int): Long = stampAt(n) + 900L
    }

    /** Seconds left (ceil), from the server deadline and the clock offset. */
    fun secondsLeft(deadline: Long, nowLocal: Long, offset: Long): Int = max(0, ceil((deadline - (nowLocal + offset)) / 1000.0).toInt())

    fun fractionLeft(deadline: Long, durationMs: Long, nowLocal: Long, offset: Long): Float =
        if (durationMs <= 0) 0f else min(1f, max(0f, (deadline - (nowLocal + offset)).toFloat() / durationMs))
}
