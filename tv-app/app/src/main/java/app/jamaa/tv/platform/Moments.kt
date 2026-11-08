package app.jamaa.tv.platform

import kotlin.math.abs
import kotlin.math.roundToLong

// JAMAA-PLATFORM §3.8 / §3.10 signature moments as step lists (pure; JVM-tested).
// JAMAA-GAP: the binding step data and the sampler are lane D's generated `Choreo.kt` (tools/gen-characters, from
// shared/src/motion/choreo.ts) with the parity fixture shared/fixtures/v2/choreo.json. Neither exists in the tree yet,
// so these timelines are transcribed from DESIGN-JAMAA §3.1/§3.2 (binding numbers) with the DESIGN §6.1 cubic-bezier
// tokens. When Choreo.kt lands, [Moments] delegates to it and the parity test runs against choreo.json.

/** DESIGN §6.1 easing tokens (the same control points as ui/theme/JamaaMotion). */
enum class EasingId(val x1: Float, val y1: Float, val x2: Float, val y2: Float) {
    LINEAR(0f, 0f, 1f, 1f),
    STANDARD(0.2f, 0f, 0f, 1f),
    DECEL(0.05f, 0.7f, 0.1f, 1f),
    ACCEL(0.3f, 0f, 0.8f, 0.15f),
    OVERSHOOT(0.34f, 1.56f, 0.64f, 1f),
}

data class MomentStep(val id: String, val startMs: Long, val durationMs: Long, val easing: EasingId, val staggerMs: Long = 0) {
    val endMs: Long get() = startMs + durationMs

    /** Eased progress of this step at [tMs] since the moment started (0 before, 1 after). */
    fun progress(tMs: Long): Float {
        if (durationMs <= 0) return if (tMs >= startMs) 1f else 0f
        val lin = ((tMs - startMs).toFloat() / durationMs).coerceIn(0f, 1f)
        return CubicBezier.ease(easing, lin)
    }
}

/** A moment playing on the TV: [completed] = OK snapped it to its end state (the UI jumps there, then reports the end). */
data class ActiveMoment(val moment: Moment, val startedAt: Long, val gameId: String?, val completed: Boolean, val seq: Int)

data class Moment(val id: String, val steps: List<MomentStep>) {
    val totalMs: Long get() = steps.maxOfOrNull { it.endMs } ?: 0L
    fun step(id: String): MomentStep? = steps.firstOrNull { it.id == id }

    /** The same moment with every time scaled (the 700 ms repeat portal = the 1 100 ms one × 0.64). */
    fun scaled(f: Double, newId: String = id): Moment = Moment(newId, steps.map {
        it.copy(startMs = (it.startMs * f).roundToLong(), durationMs = (it.durationMs * f).roundToLong(), staggerMs = (it.staggerMs * f).roundToLong())
    })
}

object Moments {
    /** §3.10 A portal, first open in the session (DESIGN-JAMAA §3.1 timeline). */
    val PORTAL_FIRST = Moment(
        "portal", listOf(
            MomentStep("press", 0, 120, EasingId.STANDARD),
            MomentStep("othersOut", 0, 240, EasingId.ACCEL),
            MomentStep("arch", 120, 580, EasingId.DECEL),
            MomentStep("parallax", 200, 600, EasingId.DECEL),
            MomentStep("crossfade", 700, 200, EasingId.STANDARD),
            MomentStep("title", 800, 200, EasingId.OVERSHOOT),
            MomentStep("panes", 900, 200, EasingId.DECEL, staggerMs = 60),
        ),
    )

    fun portal(firstOpenThisSession: Boolean, reduced: Boolean): Moment = when {
        reduced -> Moment("portal.reduced", listOf(MomentStep("crossfade", 0, 150, EasingId.STANDARD)))
        firstOpenThisSession -> PORTAL_FIRST
        else -> PORTAL_FIRST.scaled(REPEAT_PORTAL_FACTOR, "portal.repeat")
    }

    /** Back from setup: the reverse portal (600 ms) or a 150 ms crossfade. */
    fun portalBack(reduced: Boolean): Moment =
        if (reduced) Moment("portalBack.reduced", listOf(MomentStep("crossfade", 0, 150, EasingId.STANDARD)))
        else Moment("portalBack", listOf(
            MomentStep("panesOut", 0, 150, EasingId.ACCEL),
            MomentStep("arch", 100, 400, EasingId.ACCEL),
            MomentStep("othersIn", 350, 250, EasingId.DECEL),
        ))

    /** §3.10 B world entrance (≤ 2 000 ms; DESIGN-JAMAA §3.2 skeleton). */
    val ENTRANCE = Moment(
        "entrance", listOf(
            MomentStep("darken", 0, 250, EasingId.ACCEL, staggerMs = 60),
            MomentStep("door", 250, 750, EasingId.DECEL),
            MomentStep("title", 1_000, 250, EasingId.OVERSHOOT),
            MomentStep("characters", 1_100, 700, EasingId.DECEL, staggerMs = 40),
            MomentStep("settle", 1_800, 200, EasingId.STANDARD),
        ),
    )

    fun entrance(reduced: Boolean): Moment =
        if (reduced) Moment("entrance.reduced", listOf(MomentStep("crossfade", 0, 150, EasingId.STANDARD), MomentStep("title", 150, 600, EasingId.LINEAR)))
        else ENTRANCE

    /** §3.10 D / HUB-05: stars fly from the podium to the cup chip, then the leaderboard reorders (FLIP 400 ms). */
    fun cup(starCount: Int, reduced: Boolean): Moment {
        if (reduced) return Moment("cup.reduced", listOf(MomentStep("crossfade", 0, 150, EasingId.STANDARD)))
        val flights = starCount.coerceIn(0, MAX_FLYING_STARS)
        val fly = if (flights == 0) 0L else 450L + (flights - 1) * 70L
        return Moment("cup", listOf(
            MomentStep("stars", 0, fly, EasingId.DECEL, staggerMs = 70),
            MomentStep("reorder", fly, 400, EasingId.STANDARD),
        ))
    }

    const val REPEAT_PORTAL_FACTOR = 0.64
    const val MAX_FLYING_STARS = 24
}

/** Cubic-bezier easing y(x) for x in [0, 1] (Newton with a bisection fallback), like CSS / Compose CubicBezierEasing. */
object CubicBezier {
    fun ease(e: EasingId, x: Float): Float = ease(e.x1, e.y1, e.x2, e.y2, x)

    fun ease(x1: Float, y1: Float, x2: Float, y2: Float, x: Float): Float {
        if (x <= 0f) return 0f
        if (x >= 1f) return 1f
        fun bx(t: Double) = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
        fun by(t: Double) = 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
        fun dx(t: Double) = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2)
        var t = x.toDouble()
        repeat(8) {
            val err = bx(t) - x
            if (abs(err) < 1e-6) return by(t).toFloat()
            val d = dx(t)
            if (abs(d) < 1e-6) return@repeat
            t -= err / d
        }
        var lo = 0.0
        var hi = 1.0
        t = x.toDouble()
        repeat(40) {
            val v = bx(t)
            if (abs(v - x) < 1e-6) return by(t).toFloat()
            if (v < x) lo = t else hi = t
            t = (lo + hi) / 2
        }
        return by(t).toFloat()
    }
}
