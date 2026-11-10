package app.jamaa.tv.games.likely

import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.Choreo.Lite
import app.jamaa.tv.motion.Choreo.Reduced
import app.jamaa.tv.motion.ChoreoSampler
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

// The Likely signature moments as step lists (GAME-LIKELY §12, DESIGN-JAMAA §5.3), sampled with the platform's
// shared sampler (motion/Choreo.kt, the Kotlin port of shared/src/motion/choreo.ts) so the curves are the ones the
// browser TV runs. The step ids, start times and easings below are the reference the /tv mock mirrors (JAMAA-GAP: the
// Likely steps are not in shared/src/motion/choreo.ts yet, so there is no cross-platform fixture for them).
//
// The server never waits for an animation (§12): every timeline fits inside the phase's server duration (tested
// against `likelyRevealMs`), the open-ended "hold" fills the rest, and OK on the remote snaps to the end state.

object LikelyTiming {
    const val CARD_MS = 3_500L
    const val ENTRANCE_GRACE_MS = 2_500L
    const val REVEAL_MIN_MS = 8_000L
    const val REVEAL_MAX_MS = 12_000L
    const val AWARDS_BASE_MS = 3_000L
    const val AWARDS_TRIO_MS = 4_000L
    const val AWARDS_MIND_READER_MS = 4_000L

    /** `clamp(14 000 + 1 000 × n, 18 000, 26 000)` (GAME-LIKELY §4.1; mirrors `likelyVotingMs`). */
    fun votingMs(players: Int): Long = (14_000L + 1_000L * players).coerceIn(18_000L, 26_000L)

    /**
     * Mirrors shared `likelyRevealMs`: `7 000 + 150 × votes + (unanimous ? 1 200 : 0) + (ties > 1 ? 600 : 0)`, clamped to
     * 8 000–12 000 (owner-approved G3 review change of GAME-LIKELY §12.2, which still says 5 000 + 100 × votes, 6 000–9 500).
     */
    fun revealMs(votes: Int, unanimous: Boolean, topCount: Int): Long =
        (7_000L + 150L * votes + (if (unanimous) 1_200L else 0L) + (if (topCount > 1) 600L else 0L)).coerceIn(REVEAL_MIN_MS, REVEAL_MAX_MS)

    /** `3 000 + 4 000 × ceil(holders / 3) + 4 000` (the last 4 000 = Mind Reader, public mode only). */
    fun awardsMs(holders: Int, publicMode: Boolean): Long =
        AWARDS_BASE_MS + AWARDS_TRIO_MS * ceil(holders / 3.0).toLong() + (if (publicMode) AWARDS_MIND_READER_MS else 0L)
}

/** A timeline: step list + sound marks (cue ids of DESIGN-JAMAA §5.5 / GAME-LIKELY §12.6) + its natural end. */
data class LikelyTimeline(val id: String, val steps: List<Choreo.Step>, val totalMs: Int, val marks: List<LikelyMark>) {
    fun step(id: String): Choreo.Step? = steps.firstOrNull { it.id == id }

    fun endOf(id: String, index: Int = 0): Int = step(id)?.let { it.startMs + it.staggerMs * index + it.durationMs } ?: 0
}

/** A sound on the timeline: [cue] is the DESIGN cue id (`likely.tok`, `coinLand`…), [rate] its pitch. */
data class LikelyMark(val atMs: Int, val cue: String, val rate: Float = 1f)

object LikelyChoreo {
    /** Calm motion: a FADE step becomes a 200 ms linear fade at its start; SKIP jumps to its end at its start. */
    const val REDUCED_FADE_MS = 200

    // The reveal is a line-for-line port of the browser TV's step list (web-client/src/games/likely/tv/choreo.ts,
    // `revealSteps` + `fitReveal`), so both TVs play the same moment from the same public result.

    /** Drumroll: lights dim, the card shrinks to the top (0–800 ms). */
    const val DRUM_MS = 800

    /** Run to your pick: 100 ms per voter, the whole run ≤ 2 500 ms (§12.2 step 2). */
    const val RUN_MS = 520
    const val RUN_WINDOW_MS = 2_500 - RUN_MS
    const val CONFETTI_MS = 1_200
    const val SCRAMBLE_MS = 1_200

    /** Time kept free at the end of the server's REVEAL window: the hold ("defend yourself") and network slack. */
    const val REVEAL_TAIL_MS = 1_000

    private fun step(id: String, start: Int, dur: Int, easing: String, stagger: Int = 0, reduced: Reduced = Reduced.FADE, lite: Lite = Lite.KEEP) =
        Choreo.Step(id, start, dur, easing, stagger, reduced, lite)

    /** Same as the TS `S(id, start, dur, easing, reduced = "skip", stagger)`. */
    private fun s(id: String, start: Double, dur: Int, easing: String, reduced: Reduced = Reduced.SKIP, stagger: Double = 0.0) =
        Choreo.Step(id, kotlin.math.round(start).toInt(), dur, easing, kotlin.math.round(stagger).toInt(), reduced, Lite.KEEP)

    /** Which reveal plays (§12.2): conga (public), ballot rain (secret votes), chaos scramble, or nobody voted. */
    enum class RevealKind { PUBLIC, SECRET, CHAOS, NONE }

    fun revealKind(r: LikelyReveal, anonymous: Boolean): RevealKind = when {
        r.none || r.votesCast == 0 -> RevealKind.NONE
        r.chaos -> RevealKind.CHAOS
        anonymous || r.ballots == null -> RevealKind.SECRET
        else -> RevealKind.PUBLIC
    }

    fun runStagger(runners: Int): Double = if (runners <= 1) 100.0 else min(100.0, RUN_WINDOW_MS.toDouble() / (runners - 1))

    /** The shape of a reveal, from the public result only (TS `RevealShape`). */
    data class RevealShape(
        val runners: Int,
        val envelopes: Int,
        val publicMode: Boolean,
        val chaos: Boolean,
        val none: Boolean,
        val unanimous: Boolean,
        val coins: Int,
        /** Lines on the secret-vote percentage board (each adds reading time). */
        val lines: Int = 1,
    ) {
        /** The staggered element count `fitReveal` measures with. */
        val count: Int get() = max(max(runners, envelopes), max(coins, 1))
    }

    /** The percentage board stays readable: 1 800 ms + 120 ms per line (TS `boardMs`). */
    fun boardMs(lines: Int): Int = 1_800 + 120 * max(1, lines)

    /** TS `revealSteps`. Ids: dim, run, box, env, scramble, count, spot, stamp, confetti, coin, tick, board, hold. */
    fun revealSteps(o: RevealShape): List<Choreo.Step> {
        val steps = mutableListOf(s("dim", 0.0, DRUM_MS, "ease.standard", Reduced.FADE))
        if (o.none) return steps + s("hold", DRUM_MS.toDouble(), 400, "ease.decel", Reduced.FADE)
        var t = DRUM_MS.toDouble()
        if (o.chaos) {
            steps += s("scramble", t, SCRAMBLE_MS, "linear")
            t += SCRAMBLE_MS
            if (o.publicMode && o.runners > 0) {
                steps += s("run", t, RUN_MS, "spring.bouncy", Reduced.SKIP, runStagger(o.runners))
                t += RUN_MS + runStagger(o.runners) * max(0, o.runners - 1)
            }
            steps += s("count", t, 600, "ease.decel", Reduced.FADE)
            t += 600
            if (!o.publicMode) {
                val b = boardMs(o.lines)
                steps += s("board", t, b, "ease.decel", Reduced.FADE, 120.0)
                t += b
            }
            return steps + s("hold", t, 400, "ease.decel", Reduced.FADE)
        }
        if (o.publicMode) {
            val st = runStagger(o.runners)
            steps += s("run", t, RUN_MS, "ease.decel", Reduced.SKIP, st)
            t += if (o.runners > 0) RUN_MS + st * (o.runners - 1) else 200.0
        } else {
            steps += s("box", t, 360, "ease.overshoot")
            steps += s("env", t + 240, 450, "ease.coin", Reduced.SKIP, 70.0)
            t += 240 + 450 + 70.0 * max(0, o.envelopes - 1)
        }
        t += 100
        steps += s("count", t, 600, "ease.decel", Reduced.FADE)
        t += 600
        steps += s("spot", t, 800, "ease.overshoot", Reduced.FADE)
        t += 800
        steps += s("stamp", t, 600, "ease.overshoot", Reduced.FADE)
        if (o.unanimous) steps += s("confetti", t + 300, CONFETTI_MS, "linear")
        t += 600
        if (o.publicMode) {
            if (o.coins > 0) {
                steps += s("coin", t, 450, "ease.coin", Reduced.SKIP, 70.0)
                steps += s("tick", t + 450, 600, "ease.decel", Reduced.FADE)
                t += 450 + 70.0 * max(0, o.coins - 1) + 600
            }
        } else {
            val b = boardMs(o.lines)
            steps += s("board", t, b, "ease.decel", Reduced.FADE, 120.0)
            t += b
        }
        return steps + s("hold", t, 400, "ease.decel", Reduced.FADE)
    }

    /** Shared `endMs(steps, count)`. */
    fun endMs(steps: List<Choreo.Step>, count: Int = 1): Int =
        steps.maxOfOrNull { it.startMs + it.staggerMs * max(0, count - 1) + it.durationMs } ?: 0

    /** Shared `scaled(steps, k)`: springs keep their (physical) duration but move with the timeline. */
    fun scaled(steps: List<Choreo.Step>, k: Double): List<Choreo.Step> = steps.map {
        val spring = Choreo.easings[it.easing] is Choreo.Easing.Spring
        it.copy(
            startMs = kotlin.math.round(it.startMs * k).toInt(),
            durationMs = if (spring) it.durationMs else kotlin.math.round(it.durationMs * k).toInt(),
            staggerMs = kotlin.math.round(it.staggerMs * k).toInt(),
        )
    }

    /** The "defend yourself" hold gets at least this long on screen when the window allows it (§12.2 step 7). */
    const val HOLD_MIN_MS = 2_000

    /** The beats before the hold are never squeezed below this fraction of their natural speed to make room for it. */
    const val FIT_MIN_SCALE = 0.7

    /** Shortest hold step (its fade-in; the caption then stays until the server deals the next card). */
    const val HOLD_FLOOR_MS = 400

    /**
     * TS `fitReveal`: the beats before the hold are scaled down (springs keep their settle time) when they would leave the
     * hold less than [HOLD_MIN_MS] of `window − REVEAL_TAIL_MS`, never below [FIT_MIN_SCALE] (the floor of
     * `budget − HOLD_FLOOR_MS` still applies); then `hold` starts where the beats end and fills the rest of the budget.
     */
    fun fitReveal(steps: List<Choreo.Step>, windowMs: Long, count: Int): List<Choreo.Step> {
        val budget = max(2_000L, windowMs - REVEAL_TAIL_MS).toDouble()
        val hold = steps.firstOrNull { it.id == "hold" }
        val core = steps.filter { it.id != "hold" }
        val holdAt = hold?.startMs?.toDouble() ?: endMs(core, count).toDouble()
        val want = max(budget - HOLD_MIN_MS, holdAt * FIT_MIN_SCALE)
        val k = min(min(1.0, want / max(1.0, holdAt)), (budget - HOLD_FLOOR_MS) / max(1, endMs(core, count)))
        val fitted = if (k < 1) scaled(core, k) else core
        if (hold == null) return fitted
        val start = holdAt * min(1.0, k)
        return fitted + hold.copy(startMs = kotlin.math.round(start).toInt(), durationMs = max(HOLD_FLOOR_MS.toDouble(), budget - start).roundToIntSafe())
    }

    private fun Double.roundToIntSafe(): Int = kotlin.math.round(this).toInt()

    /** The REVEAL timeline (steps fitted to the server window of [r]) with its sound marks. */
    fun reveal(r: LikelyReveal, shape: RevealShape): LikelyTimeline {
        val steps = fitReveal(revealSteps(shape), LikelyTiming.revealMs(r.votesCast, r.unanimous, r.topIds.size), shape.count)
        fun st(id: String) = steps.firstOrNull { it.id == id }
        val marks = mutableListOf(LikelyMark(0, "sfx.drumroll"))
        st("scramble")?.let { marks += LikelyMark(it.startMs, "likely.scramble") }
        st("box")?.let { marks += LikelyMark(it.startMs, "likely.ballot") }
        st("run")?.let { run ->
            // "tok" on each landing, pitch rising with the line (capped to the SoundPool range).
            for (i in 0 until min(shape.runners, 12)) marks += LikelyMark(run.startMs + run.staggerMs * i + run.durationMs, "likely.tok", (1f + 0.06f * i).coerceAtMost(2f))
        }
        st("env")?.let { env -> for (i in 0 until min(shape.envelopes, 12)) marks += LikelyMark(env.startMs + env.staggerMs * i + env.durationMs, "likely.tok", (1f + 0.04f * i).coerceAtMost(2f)) }
        st("count")?.let { marks += LikelyMark(it.startMs, "counterTick") }
        st("spot")?.let { marks += LikelyMark(it.startMs, "likely.spot") }
        st("stamp")?.let { marks += LikelyMark(it.startMs + 200, "likely.rosette") }
        st("confetti")?.let { marks += LikelyMark(it.startMs, "likely.confetti") }
        st("coin")?.let { c ->
            marks += LikelyMark(c.startMs, "coinFly")
            for (i in 0 until min(shape.coins, 10)) marks += LikelyMark(c.startMs + c.staggerMs * i + c.durationMs, "coinLand", (1f + 0.06f * i).coerceAtMost(2f))
        }
        // The score rail's counters roll from scoreBefore to score (public mode, DESIGN-JAMAA §5.1 counters ticking).
        st("tick")?.let { marks += LikelyMark(it.startMs, "counterTick") }
        if (shape.none) marks += LikelyMark(DRUM_MS, "likely.puff")
        val total = endMs(steps, shape.count)
        val kind = when {
            shape.none -> "none"
            shape.chaos -> "chaos"
            shape.publicMode -> "public"
            else -> "secret"
        }
        return LikelyTimeline("likely.reveal.$kind", steps, total, marks.filter { it.atMs <= total }.sortedBy { it.atMs })
    }


    /**
     * The card entrance (§12.3): dealt from the golden deck at the top-end corner, flipped on the Y axis in mid-air
     * (`motion.dramatic` 800 ms) and landing with a soft bounce; header first, the phrase 150 ms later.
     */
    val cardDeal: LikelyTimeline = LikelyTimeline(
        "likely.card",
        listOf(
            step("deal", 0, 800, "spring.bouncy", reduced = Reduced.FADE),
            step("flip", 0, 800, "ease.decel", reduced = Reduced.SKIP),
            step("header", 450, 240, "ease.decel"),
            step("phrase", 600, 300, "ease.overshoot"),
            step("award", 800, 240, "ease.decel"),
        ),
        1_100,
        listOf(LikelyMark(0, "likely.deal")),
    )

    /** One award page (§12.4): walk to the podium marks, rosettes drop, names type in, a glint sweeps. */
    val awardsTrio: LikelyTimeline = LikelyTimeline(
        "likely.awards.trio",
        listOf(
            step("walk", 0, 600, "spring.bouncy", 120, Reduced.SKIP),
            step("rosette", 500, 600, "ease.overshoot", 200),
            step("name", 900, 400, "ease.decel", 200),
            step("glint", 1_300, 700, "linear", 200, Reduced.SKIP, Lite.DROP),
        ),
        2_400,
        listOf(LikelyMark(500, "likely.rosette"), LikelyMark(700, "likely.rosette"), LikelyMark(900, "likely.rosette"), LikelyMark(1_300, "likely.glint")),
    )

    /** The Mind Reader podium (public mode only): steps rise 3-2-1, the crystal ball glows on the winner. */
    val mindReader: LikelyTimeline = LikelyTimeline(
        "likely.awards.mindReader",
        listOf(
            step("podium", 0, 600, "spring.bouncy", 150, Reduced.FADE),
            step("crystal", 700, 600, "ease.overshoot"),
            step("glint", 1_300, 700, "linear", reduced = Reduced.SKIP, lite = Lite.DROP),
        ),
        2_000,
        listOf(LikelyMark(0, "likely.rosette"), LikelyMark(700, "likely.glint")),
    )

    /** The intro page of AWARDS: the curtain sweeps, "Awards Night" lands. */
    val awardsIntro: LikelyTimeline = LikelyTimeline(
        "likely.awards.intro",
        listOf(step("curtain", 0, 750, "ease.door", reduced = Reduced.FADE), step("title", 600, 400, "ease.overshoot")),
        1_000,
        listOf(LikelyMark(0, "worldLikelySting")),
    )

    /**
     * Progress of [step] at [tMs] for element [index], 0..1 (overshoot easings may leave the range). Calm motion:
     * SKIP jumps to 1 at the step's start, FADE runs a 200 ms linear fade, KEEP is unchanged. Lite: a DROP step is 1.
     */
    fun progress(step: Choreo.Step?, tMs: Double, index: Int = 0, reduced: Boolean = false, lite: Boolean = false): Float {
        if (step == null) return 1f
        val start = step.startMs + step.staggerMs.toDouble() * index
        if ((reduced || lite) && step.lite == Lite.DROP) return if (tMs >= start) 1f else 0f
        if (reduced) {
            return when (step.reduced) {
                Reduced.SKIP -> if (tMs >= start) 1f else 0f
                Reduced.FADE -> ((tMs - start) / REDUCED_FADE_MS).coerceIn(0.0, 1.0).toFloat()
                Reduced.KEEP -> ChoreoSampler.sample(step, tMs, index).toFloat()
            }
        }
        return ChoreoSampler.sample(step, tMs, index).toFloat()
    }

    /** How a timeline starts given the time the server still gives the phase (the server never waits, §12). */
    data class Start(val atMs: Int, val scale: Double)

    /**
     * A timeline mounted with [remainingMs] left in the phase: plays at full speed if it fits, compressed down to
     * [MIN_SCALE] if needed, and otherwise starts at its end state (a TV that reconnects mid-reveal sees the verdict).
     */
    fun start(totalMs: Int, remainingMs: Long?): Start {
        if (remainingMs == null || remainingMs >= totalMs) return Start(0, 1.0)
        val k = remainingMs.toDouble() / totalMs
        return if (k >= MIN_SCALE) Start(0, k) else Start(totalMs, 1.0)
    }

    const val MIN_SCALE = 0.6

    /**
     * CARD (GAME-LIKELY §4, §12.1): the first card of a game is never dealt under the platform world entrance. Its
     * deadline carries [LikelyTiming.ENTRANCE_GRACE_MS] on top of [LikelyTiming.CARD_MS], so the deal starts where the
     * grace ends: a negative [Start.atMs] is the wait (the card stays in the deck). Later cards start like any timeline.
     */
    fun cardStart(cardIndex: Int, remainingMs: Long?): Start {
        if (cardIndex == 0 && remainingMs != null) {
            val wait = remainingMs - LikelyTiming.CARD_MS
            if (wait > 0) return Start(-wait.coerceAtMost(LikelyTiming.ENTRANCE_GRACE_MS).toInt(), 1.0)
        }
        return start(cardDeal.totalMs, remainingMs)
    }

    /** Marks crossed between [prevMs] (exclusive) and [nowMs] (inclusive); a jump (OK) of more than the slack is silent. */
    fun marksBetween(t: LikelyTimeline, prevMs: Double, nowMs: Double, slackMs: Int = 250): List<LikelyMark> =
        t.marks.filter { it.atMs > prevMs && it.atMs <= nowMs && nowMs - it.atMs <= slackMs }
}
