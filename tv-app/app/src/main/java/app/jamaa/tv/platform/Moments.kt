package app.jamaa.tv.platform

import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.ChoreoSampler
import kotlin.math.ceil

// JAMAA-PLATFORM §3.8 / §3.10 signature moments on the TV (pure; JVM-tested), driven by lane D's generated Choreo.kt
// (step data + the Kotlin port of the shared sampler, parity-tested against shared/fixtures/v2/choreo.json).
// This file only picks the variant (first/repeat portal, calm motion) and adds what the input rule needs (totals).

/** One step of a playing moment; [timeScale] stretches its clock (the 700 ms repeat portal = the 1 100 ms one × 0.64). */
data class MomentStep(val step: Choreo.Step, val timeScale: Double = 1.0) {
    val id: String get() = step.id
    val startMs: Long get() = ceil(step.startMs * timeScale).toLong()
    val endMs: Long get() = ceil((step.startMs + step.durationMs) * timeScale).toLong()

    /** Sampled progress at [tMs] since the moment started, for the staggered element [index]. */
    fun progress(tMs: Long, index: Int = 0): Float = ChoreoSampler.sample(step, tMs / timeScale, index).toFloat()
}

/** A playing moment: [totalMs] is when OK stops completing it (§3.10 E) and the screen becomes interactive. */
data class ActiveMoment(val moment: Moment, val startedAt: Long, val gameId: String?, val completed: Boolean, val seq: Int)

data class Moment(val id: String, val steps: List<MomentStep>, val totalMs: Long) {
    fun step(id: String): MomentStep? = steps.firstOrNull { it.id == id }
    val reduced: Boolean get() = id.endsWith(".reduced")
}

object Moments {
    const val REPEAT_PORTAL_FACTOR = 0.64
    const val MAX_FLYING_STARS = 24

    /** The three HUB-03 panes stagger in (60 ms apart). */
    private const val SETUP_PANES = 3

    private fun of(id: String, elements: Int = 1, scale: Double = 1.0, name: String = id): Moment {
        val steps = Choreo.moments.getValue(id).map { MomentStep(it, scale) }
        return Moment(name, steps, ceil(Choreo.totalMs(id, elements) * scale).toLong())
    }

    /** Calm motion: a 150 ms crossfade (plus a still title hold for the entrance). */
    private fun crossfade(name: String, holdTitleMs: Int = 0): Moment {
        val fade = Choreo.moments.getValue("crossfade").map { MomentStep(it) }
        val hold = if (holdTitleMs > 0) listOf(MomentStep(Choreo.Step("title", 150, holdTitleMs, "linear", 0, Choreo.Reduced.KEEP, Choreo.Lite.KEEP))) else emptyList()
        val steps = fade + hold
        return Moment(name, steps, steps.maxOf { it.endMs })
    }

    /** §3.10 A: 1 100 ms the first time a game is opened in this session, 700 ms afterwards; calm: 150 ms crossfade. */
    fun portal(firstOpenThisSession: Boolean, reduced: Boolean): Moment = when {
        reduced -> crossfade("portal.reduced")
        firstOpenThisSession -> of("portal", SETUP_PANES)
        else -> of("portal", SETUP_PANES, REPEAT_PORTAL_FACTOR, "portal.repeat")
    }

    /** Back from setup: the reverse portal (600 ms) or a crossfade. */
    fun portalBack(reduced: Boolean): Moment = if (reduced) crossfade("portalBack.reduced") else of("portalBack")

    /** §3.10 B world entrance (≤ 2 000 ms); calm: crossfade, the title for 600 ms, characters in place. */
    fun entrance(reduced: Boolean, characters: Int = 1): Moment =
        if (reduced) crossfade("entrance.reduced", holdTitleMs = 600) else of("entrance", characters.coerceAtLeast(1))

    /** §3.10 D: placement stars fly from the podium to the cup chip (≤ 24 on screen, 70 ms stagger). */
    fun cup(starCount: Int, reduced: Boolean): Moment =
        if (reduced) crossfade("cup.reduced") else of("cup", starCount.coerceIn(1, MAX_FLYING_STARS))
}
