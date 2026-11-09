package app.jamaa.tv.games.trivia

import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.Choreo.Reduced
import app.jamaa.tv.platform.Moment
import app.jamaa.tv.platform.MomentStep

// Quiz Night's on-screen moments as step lists (GAME-TRIVIA §12, DESIGN-JAMAA §5.4), sampled by the platform's shared
// sampler (Choreo.kt / ChoreoSampler, parity-fixed against shared/fixtures/v2/choreo.json) — Compose's own springs are
// never used for these. Easing ids are the platform's (ease.*, spring.*). Pure; JVM-tested.
// The timings are GAME-TRIVIA's binding script, so the browser TV reaches the same keyframes at the same times.
// Calm/reduced motion: travel is removed (`skip` steps are already at their end), the rest becomes a 200 ms fade
// (DESIGN-JAMAA §5.4 "Reduced motion"). Every moment is anchored to the server phase start, so a TV that reconnects
// mid-reveal resumes at the right frame, and OK completes it locally (platform §3.10 E).

object TriviaMoments {
    private fun step(id: String, start: Int, dur: Int, easing: String, stagger: Int = 0, reduced: Reduced = Reduced.FADE) =
        Choreo.Step(id, start, dur, easing, stagger, reduced, Choreo.Lite.KEEP)

    /** Reduced variant: `skip` steps drop out (sampled as done), the rest fade in 200 ms at their start. */
    private fun reduce(steps: List<Choreo.Step>): List<Choreo.Step> = steps.filter { it.reduced != Reduced.SKIP }.map {
        if (it.reduced == Reduced.KEEP) it else it.copy(durationMs = REDUCED_FADE_MS, easing = "ease.standard", staggerMs = 0)
    }

    const val REDUCED_FADE_MS = 200

    private fun build(id: String, steps: List<Choreo.Step>, elements: Int, reduced: Boolean): Moment {
        val list = if (reduced) reduce(steps) else steps
        val total = list.maxOfOrNull { it.startMs + it.staggerMs * maxOf(0, elements - 1) + it.durationMs } ?: 0
        return Moment(if (reduced) "$id.reduced" else id, list.map { MomentStep(it) }, total.toLong())
    }

    /**
     * TR-TV-01: the quiz card scales in from the marquee (0.6 → 1, 400 ms decel), the stars fill one by one (150 ms
     * each, overshoot), domain and topic chips stagger in (60 ms), the count line, the studio lights sweep on.
     * It starts when the entrance is over: the phase deadline minus QUIZ_INTRO_MS.
     */
    fun quizIntro(chips: Int, reduced: Boolean): Moment = build(
        "trivia.quizIntro",
        listOf(
            step("lights", 0, 800, "linear", reduced = Reduced.SKIP),
            step("card", 0, 400, "ease.decel"),
            step("stars", 400, 150, "ease.overshoot", stagger = 150),
            step("chips", 700, 240, "ease.decel", stagger = 60),
            step("count", 1_000, 240, "ease.standard"),
        ),
        elements = maxOf(3, chips),
        reduced = reduced,
    )

    /** QUIZ_INTRO = ENTRANCE_GRACE_MS + 4 000 (GAME-TRIVIA §4.1): the card waits for the platform entrance. */
    const val QUIZ_INTRO_MS = 4_000L

    /** TR-TV-02a: the question card slams in from above (400 ms overshoot); the ghost slots fade in under it. */
    fun read(reduced: Boolean): Moment = build(
        "trivia.read",
        listOf(
            step("slam", 0, 400, "ease.overshoot"),
            step("ghosts", 200, 240, "ease.decel"),
        ),
        elements = 1,
        reduced = reduced,
    )

    /** The slam's thud lands when the overshoot first reaches the card's place (≈ 37 % of 400 ms). */
    const val SLAM_LAND_MS = 150L

    /** TR-TV-02: the tiles flip in A→D on the Y axis, 90 ms apart (`motion.base` 240 ms). Calm: they just appear. */
    fun answer(tiles: Int, reduced: Boolean): Moment = build(
        "trivia.answer",
        listOf(step("tiles", 0, 240, "ease.standard", stagger = 90, reduced = Reduced.SKIP)),
        elements = tiles,
        reduced = reduced,
    )

    /**
     * TR-TV-03 (GAME-TRIVIA §12.3, 6 s + 3 s with a fact). [jumpers] characters jump onto tiles, [coins] coins fly.
     * Steps: lock (Time! stamp, bulbs flash) → wrongOut (+ the correct shape spins) → jump (spring.hop, 60 ms stagger)
     * → fastest (the bolt) → coin / badge / counter per coin (ease.coin, 70 ms stagger) → reorder (FLIP 400 ms) + hop
     * for overtakers → explain ("Did you know?" slides up at 6 s).
     * Stumped and voided reveals keep lock and wrongOut (all tiles dim; "dun-dun"), and skip the rest but the fact.
     */
    fun reveal(jumpers: Int, coins: Int, explain: Boolean, stumped: Boolean, reduced: Boolean): Moment {
        val steps = buildList {
            add(step("lock", 0, 300, "ease.standard"))
            add(step("wrongOut", 300, 600, "ease.accel"))
            add(step("spin", 300, 500, "ease.standard", reduced = Reduced.SKIP))
            if (stumped) {
                add(step("stamp", 900, 400, "ease.overshoot"))
            } else {
                if (jumpers > 0) add(step("jump", JUMP_AT, JUMP_MS, "spring.hop", stagger = JUMP_STAGGER, reduced = Reduced.FADE))
                add(step("fastest", 2_400, 600, "ease.overshoot"))
                if (coins > 0) {
                    add(step("coin", COIN_AT, COIN_MS, "ease.coin", stagger = COIN_STAGGER, reduced = Reduced.SKIP))
                    add(step("badgePop", COIN_AT + COIN_MS, 160, "ease.overshoot", stagger = COIN_STAGGER, reduced = Reduced.SKIP))
                    add(step("counter", COIN_AT + COIN_MS, 600, "ease.decel", stagger = COIN_STAGGER, reduced = Reduced.SKIP))
                }
                add(step("reorder", REORDER_AT, 400, "ease.standard"))
                add(step("hop", REORDER_AT, 260, "spring.hop", reduced = Reduced.SKIP))
            }
            if (explain) add(step("explain", EXPLAIN_AT, 400, "ease.decel"))
        }
        return build("trivia.reveal", steps, elements = maxOf(1, jumpers, coins), reduced = reduced)
    }

    const val JUMP_AT = 900
    const val JUMP_MS = 420
    const val JUMP_STAGGER = 60
    const val COIN_AT = 3_000
    const val COIN_MS = 450
    const val COIN_STAGGER = 70
    const val REORDER_AT = 4_500
    const val EXPLAIN_AT = 6_000

    /** The arc height of the jump-on (DESIGN-JAMAA §5.4: 100 dp arcs). */
    const val JUMP_ARC_DP = 100f

    /**
     * TR-TV-04 (GAME-TRIVIA §12.4, 6 s): bars grow from the previous totals (1.2 s, odometer numbers), re-sort with
     * a spring, the leader's crown drops, the biggest climber's "+n places!" arrow pops.
     */
    fun leaderboard(rows: Int, reduced: Boolean): Moment = build(
        "trivia.leaderboard",
        listOf(
            step("rows", 0, 300, "ease.decel", stagger = 50),
            step("bars", 300, 1_200, "ease.decel", reduced = Reduced.SKIP),
            step("reorder", 1_500, 600, "spring.bouncy"),
            step("crown", 2_100, 300, "ease.overshoot"),
            step("climb", 2_300, 400, "ease.overshoot"),
        ),
        elements = rows,
        reduced = reduced,
    )

    /** TR-TV-05 (GAME-TRIVIA §12.5): the lights shift to red-amber, the title hits, a drum build, "×2" stamps on. */
    fun finalIntro(reduced: Boolean): Moment = build(
        "trivia.finalIntro",
        listOf(
            step("lights", 0, 600, "ease.standard"),
            step("title", 200, 300, "ease.overshoot"),
            step("stamp", 1_200, 400, "ease.overshoot"),
        ),
        elements = 1,
        reduced = reduced,
    )

    /** The ×2 stamp's thud and the drum build's end. */
    const val FINAL_STAMP_LAND_MS = 1_350L

    /**
     * TR-TV-06 (GAME-TRIVIA §12.5): the podium steps rise, characters jump onto them 3-2-1 (250 ms apart), the trophy
     * lands on the winner, confetti, then the stats cards drop in one by one. The results buttons wait for its end.
     */
    fun results(stats: Int, reduced: Boolean): Moment = build(
        "trivia.results",
        listOf(
            step("steps", 0, 400, "ease.decel"),
            step("jump", 300, 500, "spring.bouncy", stagger = 250),
            step("trophy", 1_300, 300, "ease.overshoot"),
            step("confetti", 1_400, 1_200, "linear", reduced = Reduced.SKIP),
            step("stats", 1_800, 300, "ease.decel", stagger = 200),
        ),
        elements = maxOf(3, stats),
        reduced = reduced,
    )

    /** HOLD and anything without a choreography. */
    val NONE = Moment("trivia.none", emptyList(), 0L)

    /** The moment of a phase for [view]: what the screen plays on entering it. */
    fun of(view: TriviaView, reduced: Boolean): Moment {
        val r = view.reveal
        return when (view.phase) {
            TriviaPhase.QUIZ_INTRO -> quizIntro(chips(view.quiz.featuredTopics.size, view.quiz.topicCount), reduced)
            TriviaPhase.READ -> read(reduced)
            TriviaPhase.ANSWER -> answer(view.options.size.coerceAtLeast(1), reduced)
            TriviaPhase.REVEAL -> reveal(
                jumpers = TriviaBoard.stacks(view).values.sumOf { it.size },
                coins = TriviaBoard.coins(view).size,
                explain = r?.explain != null,
                stumped = r == null || r.stumped || r.voided,
                reduced = reduced,
            )
            TriviaPhase.LEADERBOARD -> leaderboard(view.active.size.coerceAtMost(TriviaBoard.TOWER_ROWS), reduced)
            TriviaPhase.FINAL_INTRO -> finalIntro(reduced)
            TriviaPhase.RESULTS -> results(TriviaBoard.stats(view).size, reduced)
            TriviaPhase.HOLD -> NONE
        }
    }

    /** Chips on the quiz card: the featured topics, plus a "+n" chip when the quiz has more, plus the domain chip. */
    fun chips(featured: Int, topicCount: Int): Int = 1 + featured + if (topicCount > featured) 1 else 0

    /**
     * Where a phase's moment is now, from the server clock: QUIZ_INTRO starts after the entrance grace (its deadline
     * minus [QUIZ_INTRO_MS]); every other phase at its server start (deadline − durationMs). A phase without a
     * deadline (RESULTS, HOLD) starts when the screen first shows it ([shownAt], server time).
     */
    fun elapsed(view: TriviaView, serverNow: Long, shownAt: Long): Long {
        val d = view.deadline
        val dur = view.durationMs
        if (d == null || dur == null) return (serverNow - shownAt).coerceAtLeast(0L)
        val start = if (view.phase == TriviaPhase.QUIZ_INTRO) d - minOf(QUIZ_INTRO_MS, dur) else d - dur
        return (serverNow - start).coerceAtLeast(0L)
    }

    /** One key per phase occurrence: a completed (OK) moment stays completed until the next phase or question. */
    fun key(view: TriviaView): String = "${view.n}:${view.phase}:${view.index}"
}

/**
 * The in-game input rule for Quiz Night (platform §3.10 E rules 1, 2 and 5), pure: in game there is nothing to
 * focus, so OK only completes the running moment; on RESULTS the three buttons accept OK only once the podium moment
 * ended (or was completed) and [app.jamaa.tv.Constants.INPUT_GUARD_MS] passed, so OK mashed through the podium never
 * triggers REPLAY.
 */
object TriviaInput {
    /** OK completes the moment when it is still running and was not completed already. */
    fun okCompletes(elapsedMs: Long, moment: Moment, completed: Boolean): Boolean =
        !completed && moment.totalMs > 0 && elapsedMs < moment.totalMs

    /** When the screen became interactive: the moment's natural end, or the local time OK completed it. */
    fun interactiveAt(startedAtMs: Long, moment: Moment, completedAtMs: Long?): Long =
        minOf(startedAtMs + moment.totalMs, completedAtMs ?: Long.MAX_VALUE)

    fun buttonsReady(nowMs: Long, interactiveAtMs: Long): Boolean = nowMs - interactiveAtMs >= app.jamaa.tv.Constants.INPUT_GUARD_MS
}
