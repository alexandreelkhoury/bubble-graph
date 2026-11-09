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
    const val REVEAL_MIN_MS = 6_000L
    const val REVEAL_MAX_MS = 9_500L
    const val AWARDS_BASE_MS = 3_000L
    const val AWARDS_TRIO_MS = 4_000L
    const val AWARDS_MIND_READER_MS = 4_000L

    /** `clamp(14 000 + 1 000 × n, 18 000, 26 000)` (GAME-LIKELY §4.1; mirrors `likelyVotingMs`). */
    fun votingMs(players: Int): Long = (14_000L + 1_000L * players).coerceIn(18_000L, 26_000L)

    /** §12.2 `5 000 + 100 × votes + (unanimous ? 1 200 : 0) + (ties > 1 ? 600 : 0)`, clamped to 6 000–9 500. */
    fun revealMs(votes: Int, unanimous: Boolean, topCount: Int): Long =
        (5_000L + 100L * votes + (if (unanimous) 1_200L else 0L) + (if (topCount > 1) 600L else 0L)).coerceIn(REVEAL_MIN_MS, REVEAL_MAX_MS)

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

    // Reveal step lengths (DESIGN-JAMAA §5.3).
    const val DRUMROLL_MS = 800
    const val RUN_MS = 500
    const val RUN_STAGGER_MS = 100
    const val COUNT_MS = 600
    const val SPOT_MS = 800
    const val STAMP_MS = 600
    const val STAMP_STAGGER_MS = 150

    /** Ties share the 600 ms tie allowance of the server formula (§12.2). */
    const val STAMP_STAGGER_BUDGET_MS = 600
    const val POINTS_MS = 800
    const val CONFETTI_MS = 1_200
    const val SCRAMBLE_MS = 1_200
    const val HOLD_MIN_MS = 1_000
    const val COIN_FLIGHT_MS = 450
    const val BOARD_LINE_MS = 400

    private fun step(id: String, start: Int, dur: Int, easing: String, stagger: Int = 0, reduced: Reduced = Reduced.FADE, lite: Lite = Lite.KEEP) =
        Choreo.Step(id, start, dur, easing, stagger, reduced, lite)

    /** Which reveal plays (§12.2): conga (public), ballot rain (secret votes), chaos scramble, or nobody voted. */
    enum class RevealKind { PUBLIC, SECRET, CHAOS, NONE }

    fun revealKind(r: LikelyReveal, anonymous: Boolean): RevealKind = when {
        r.none || r.votesCast == 0 -> RevealKind.NONE
        r.chaos -> RevealKind.CHAOS
        anonymous || r.ballots == null -> RevealKind.SECRET
        else -> RevealKind.PUBLIC
    }

    /** Stagger between rosettes of tied targets, inside the formula's tie allowance. */
    fun stampStagger(tops: Int): Int = if (tops <= 1) 0 else min(STAMP_STAGGER_MS, STAMP_STAGGER_BUDGET_MS / (tops - 1))

    /**
     * The REVEAL timeline. [runners] = characters that travel (public: non-self voters in ballot order; secret: one
     * envelope per vote), [coins] = scoring voters (public only), [boardLines] = percentage lines (secret only).
     */
    fun reveal(r: LikelyReveal, anonymous: Boolean, runners: Int, coins: Int, boardLines: Int): LikelyTimeline {
        val kind = revealKind(r, anonymous)
        val marks = mutableListOf(LikelyMark(0, "sfx.drumroll"))
        val steps = mutableListOf(
            step("dim", 0, DRUMROLL_MS, "ease.standard"),
            step("cardUp", 0, DRUMROLL_MS, "ease.standard"),
        )
        when (kind) {
            RevealKind.NONE -> {
                steps += step("noneTitle", DRUMROLL_MS, 400, "ease.overshoot")
                marks += LikelyMark(DRUMROLL_MS, "likely.puff")
                return LikelyTimeline("likely.reveal.none", steps, DRUMROLL_MS + 400 + HOLD_MIN_MS, marks)
            }
            RevealKind.CHAOS -> {
                steps += step("scramble", DRUMROLL_MS, SCRAMBLE_MS, "linear", reduced = Reduced.SKIP, lite = Lite.KEEP)
                steps += step("chaosTitle", DRUMROLL_MS + 400, 400, "ease.overshoot")
                marks += LikelyMark(DRUMROLL_MS, "likely.scramble")
                return LikelyTimeline("likely.reveal.chaos", steps, DRUMROLL_MS + SCRAMBLE_MS + HOLD_MIN_MS, marks)
            }
            else -> Unit
        }
        val secret = kind == RevealKind.SECRET
        val n = max(1, runners)
        // Secret votes: the ballot box shakes during the drumroll, then the envelopes burst out (no voter colour).
        if (secret) {
            steps += step("box", 300, 500, "spring.hop", reduced = Reduced.FADE)
            marks += LikelyMark(400, "likely.ballot")
        }
        steps += step("run", DRUMROLL_MS, RUN_MS, if (secret) "ease.coin" else "ease.standard", RUN_STAGGER_MS, Reduced.SKIP)
        val runEnd = DRUMROLL_MS + RUN_STAGGER_MS * (n - 1) + RUN_MS
        for (i in 0 until min(runners, 12)) {
            // "tok" on each landing, pitch rising with the line (capped to the SoundPool range).
            marks += LikelyMark(DRUMROLL_MS + RUN_STAGGER_MS * i + RUN_MS, "likely.tok", (1f + 0.06f * i).coerceAtMost(2f))
        }
        steps += step("count", runEnd, COUNT_MS, "ease.decel", reduced = Reduced.SKIP)
        marks += LikelyMark(runEnd, "counterTick")
        val spotAt = runEnd + COUNT_MS
        steps += step("spot", spotAt, SPOT_MS, "ease.overshoot")
        marks += LikelyMark(spotAt, "likely.spot")
        val stampAt = spotAt + SPOT_MS
        val tops = max(1, r.topIds.size)
        val stagger = stampStagger(tops)
        steps += step("stamp", stampAt, STAMP_MS, "ease.overshoot", stagger)
        for (i in 0 until tops) marks += LikelyMark(stampAt + stagger * i + 200, "likely.rosette")
        val stampEnd = stampAt + stagger * (tops - 1) + STAMP_MS
        var end = stampEnd
        if (secret) {
            // The percentage board replaces the points step and takes its time (§12.2).
            val lines = max(1, boardLines)
            val lineStagger = if (lines <= 1) 0 else min(120, (POINTS_MS - BOARD_LINE_MS) / (lines - 1))
            steps += step("board", stampEnd, BOARD_LINE_MS, "ease.decel", lineStagger)
            end = stampEnd + POINTS_MS
        } else if (coins > 0) {
            val coinStagger = coinStagger(coins)
            steps += step("coins", stampEnd, COIN_FLIGHT_MS, "ease.coin", coinStagger, Reduced.SKIP)
            steps += step("pointsLabel", stampEnd, POINTS_MS, "ease.decel")
            marks += LikelyMark(stampEnd, "coinFly")
            for (i in 0 until min(coins, 10)) marks += LikelyMark(stampEnd + coinStagger * i + COIN_FLIGHT_MS, "coinLand", (1f + 0.06f * i).coerceAtMost(2f))
            end = stampEnd + POINTS_MS
        }
        if (r.unanimous) {
            steps += step("confetti", stampEnd, CONFETTI_MS, "linear", reduced = Reduced.SKIP, lite = Lite.KEEP)
            marks += LikelyMark(stampEnd, "likely.confetti")
            end = max(end, stampEnd + CONFETTI_MS)
        }
        steps += step("defend", end, 400, "ease.overshoot")
        val id = if (secret) "likely.reveal.secret" else "likely.reveal.public"
        return LikelyTimeline(id, steps, end + HOLD_MIN_MS, marks)
    }

    /** Coins land inside the 800 ms points step: 70 ms apart, squeezed for a big table (≤ 12 coins, DESIGN §5.1). */
    fun coinStagger(coins: Int): Int = if (coins <= 1) 0 else min(70, (POINTS_MS - COIN_FLIGHT_MS) / (coins - 1))

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

    /** Marks crossed between [prevMs] (exclusive) and [nowMs] (inclusive); a jump (OK) of more than the slack is silent. */
    fun marksBetween(t: LikelyTimeline, prevMs: Double, nowMs: Double, slackMs: Int = 250): List<LikelyMark> =
        t.marks.filter { it.atMs > prevMs && it.atMs <= nowMs && nowMs - it.atMs <= slackMs }
}
