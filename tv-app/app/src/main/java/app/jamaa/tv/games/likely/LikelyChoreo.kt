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

    /** `clamp(14 000 + 1 000 × n, 18 000, 26 000)` (GAME-LIKELY §4.1; mirrors `likelyVotingMs`). */
    fun votingMs(players: Int): Long = (14_000L + 1_000L * players).coerceIn(18_000L, 26_000L)

    /** Mirrors shared `likelyRevealMs`: `7 000 + 150 × votes + (unanimous ? 1 200 : 0) + (ties > 1 ? 600 : 0)`, clamped to 8 000–12 000. */
    fun revealMs(votes: Int, unanimous: Boolean, topCount: Int): Long =
        (7_000L + 150L * votes + (if (unanimous) 1_200L else 0L) + (if (topCount > 1) 600L else 0L)).coerceIn(REVEAL_MIN_MS, REVEAL_MAX_MS)

    /** `3 000 + 4 000 × ceil(holders / 3)`: the intro, then one page per trio (no Mind Reader: no points, GAME-LIKELY §6). */
    fun awardsMs(holders: Int): Long = AWARDS_BASE_MS + AWARDS_TRIO_MS * ceil(holders / 3.0).toLong()
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
    // `revealSteps` + `fitReveal`), so both TVs play the same moment from the same public result. Owner redesign
    // 2026-11-12: the card lifts and the row glides up ("dim"); the votes land under their targets one by one ("token":
    // public mode, each voter's own character in miniature; secret votes, identical envelopes); the counts pop
    // ("count"); the room dims around the most-voted ("spot"); the award stamp lands ("stamp"). No points, no
    // "defend yourself" hold: the rest of the window keeps the finished picture on screen ("hold").

    /** The card lifts, the row glides up (0–700 ms). */
    const val LIFT_MS = 700
    const val TOKEN_AT = 750
    const val TOKEN_MS = 520
    const val TOKEN_WINDOW_MS = 2_400
    const val CONFETTI_MS = 1_200
    const val SCRAMBLE_MS = 1_000

    /** Time kept free at the end of the server's REVEAL window (network slack before the next card is dealt). */
    const val REVEAL_TAIL_MS = 1_000

    private fun step(id: String, start: Int, dur: Int, easing: String, stagger: Int = 0, reduced: Reduced = Reduced.FADE, lite: Lite = Lite.KEEP) =
        Choreo.Step(id, start, dur, easing, stagger, reduced, lite)

    /** Same as the TS `S(id, start, dur, easing, reduced = "skip", stagger)`. */
    private fun s(id: String, start: Double, dur: Int, easing: String, reduced: Reduced = Reduced.SKIP, stagger: Double = 0.0) =
        Choreo.Step(id, kotlin.math.round(start).toInt(), dur, easing, kotlin.math.round(stagger).toInt(), reduced, Lite.KEEP)

    /** Which reveal plays (§12.2): public (the voters' own tokens), secret (envelopes), chaos, or nobody voted. */
    enum class RevealKind { PUBLIC, SECRET, CHAOS, NONE }

    fun revealKind(r: LikelyReveal, anonymous: Boolean): RevealKind = when {
        r.none || r.votesCast == 0 -> RevealKind.NONE
        r.chaos -> RevealKind.CHAOS
        anonymous || r.ballots == null -> RevealKind.SECRET
        else -> RevealKind.PUBLIC
    }

    /** Tokens leave one after the other, 160–320 ms apart, the whole build ≈ 2.4 s (TS `tokenStagger`). */
    fun tokenStagger(tokens: Int): Double = if (tokens <= 1) 320.0 else min(320.0, max(160.0, TOKEN_WINDOW_MS.toDouble() / (tokens - 1)))

    /** The shape of a reveal, from the public result only (TS `RevealShape`). */
    data class RevealShape(val tokens: Int, val chaos: Boolean, val none: Boolean, val unanimous: Boolean) {
        val count: Int get() = max(tokens, 1)
    }

    /** TS `revealSteps`. Ids: dim, token, count, scramble, spot, stamp, confetti, hold. */
    fun revealSteps(o: RevealShape): List<Choreo.Step> {
        val steps = mutableListOf(s("dim", 0.0, LIFT_MS, "ease.standard", Reduced.FADE))
        if (o.none || o.tokens == 0) return steps + s("hold", LIFT_MS.toDouble(), 400, "ease.decel", Reduced.FADE)
        val st = tokenStagger(o.tokens)
        steps += s("token", TOKEN_AT.toDouble(), TOKEN_MS, "ease.decel", Reduced.SKIP, st)
        var t = TOKEN_AT + st * (o.tokens - 1) + TOKEN_MS + 100
        steps += s("count", t, 400, "ease.overshoot", Reduced.FADE)
        t += 400
        if (o.chaos) {
            steps += s("scramble", t, SCRAMBLE_MS, "linear")
            t += SCRAMBLE_MS
            return steps + s("hold", t, 400, "ease.decel", Reduced.FADE)
        }
        steps += s("spot", t, 600, "ease.decel", Reduced.FADE)
        steps += s("stamp", t + 300, 600, "ease.overshoot", Reduced.FADE)
        if (o.unanimous) steps += s("confetti", t + 600, CONFETTI_MS, "linear")
        t += 900
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

    /** The finished picture (who voted for whom, or the percentages) stays at least this long when the window allows it. */
    const val HOLD_MIN_MS = 2_000

    /** The beats before the hold are never squeezed below this fraction of their natural speed to make room for it. */
    const val FIT_MIN_SCALE = 0.7

    /** Shortest hold step (its fade-in; the picture then stays until the server deals the next card). */
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
        st("token")?.let { tk ->
            // "tok" as each vote lands, pitch rising with the build (capped to the SoundPool range).
            for (i in 0 until min(shape.tokens, 12)) marks += LikelyMark(tk.startMs + tk.staggerMs * i + tk.durationMs, "likely.tok", (1f + 0.05f * i).coerceAtMost(2f))
        }
        st("count")?.let { marks += LikelyMark(it.startMs, "counterTick") }
        st("scramble")?.let { marks += LikelyMark(it.startMs, "likely.scramble") }
        st("spot")?.let { marks += LikelyMark(it.startMs, "likely.spot") }
        st("stamp")?.let { marks += LikelyMark(it.startMs + 200, "likely.rosette") }
        st("confetti")?.let { marks += LikelyMark(it.startMs, "likely.confetti") }
        if (shape.none) marks += LikelyMark(LIFT_MS, "likely.puff")
        val total = endMs(steps, shape.count)
        val kind = when {
            shape.none -> "none"
            shape.chaos -> "chaos"
            else -> "reveal"
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
