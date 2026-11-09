package app.jamaa.tv.games.bluff

import app.jamaa.tv.Constants
import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.platform.Moment
import app.jamaa.tv.platform.MomentStep

// The non-reveal Bluff moments (GAME-BLUFF §12, DESIGN-JAMAA §5.2 / §7.6) as step lists for the shared sampler, and the
// in-game remote rule (JAMAA-PLATFORM §3.10 E). Pure; JVM-tested. Times are relative to the phase start on the server
// clock (`deadline − phase length`), so a TV that reconnects mid-phase lands on the right frame instead of replaying.
//
// JAMAA-GAP (G2): shared/src/motion/choreo.ts has no Bluff step lists yet (GAME-BLUFF §12.7 asks for them there); these
// are the GAME-BLUFF timings written once here, sampled by the generated Kotlin port of the shared sampler. When lane A
// adds them, this file maps to `Choreo.moments["bluff.*"]` and the parity fixture covers them.

object BluffMoments {
    // Server phase lengths for pace "normal" (GAME-BLUFF §4.1), used to place a mid-phase reconnect on the timeline.
    const val ROUND_INTRO_MS = 4_000L
    const val ROUND_INTRO_FINAL_MS = 6_000L
    const val SCORES_MS = 6_000L
    const val AWARDS_BASE_MS = 2_500L
    const val AWARDS_PER_CARD_MS = 3_500L

    /** "Knew it! {names} +150" opens VOTING in round 1 when someone was Spot on (GAME-BLUFF §8.2). */
    const val KNEW_IT_MS = 1_500L

    /** The last 10 s of WRITING put a gentle spotlight on the unsubmitted characters (GAME-BLUFF §8.2). */
    const val WAITING_SPOTLIGHT_MS = 10_000L

    /** Results podium: steps 3, 2, 1 in that order (GAME-BLUFF §12.5). */
    const val PODIUM_STAGGER_MS = 300

    private fun s(id: String, start: Int, duration: Int, easing: String, stagger: Int = 0, reduced: Choreo.Reduced = Choreo.Reduced.FADE) =
        Choreo.Step(id, start, duration, easing, stagger, reduced, Choreo.Lite.KEEP)

    /** The key a phase moment restarts on: a new instance, phase, prompt slot or prompt (skip / "Too famous!" swap). */
    fun key(v: BluffView): String = "${v.n}:${v.phase}:${v.promptIndex}:${v.prompt?.id ?: "-"}"

    /** The full-motion steps of [v]'s phase, plus their staggered element counts. */
    private fun steps(v: BluffView): Pair<List<Choreo.Step>, Map<String, Int>> = when (v.phase) {
        BluffPhase.ROUND_INTRO -> {
            val base = listOf(
                s("card", 0, 500, "ease.overshoot"),
                s("title", 250, 400, "ease.overshoot"),
                s("rule", 600, 400, "ease.decel"),
            )
            // Final: the music drops out for a beat, then "No truth" lands as a stamp (GAME-BLUFF §3, §12.6).
            (if (v.isFinal) base + s("stamp", 1_400, 400, "ease.overshoot") else base) to emptyMap()
        }
        BluffPhase.WRITING -> listOf(
            s("card", 0, 450, "ease.decel"),
            s("hint", 300, 300, "ease.decel"),
            s("row", 200, 400, "spring.bouncy", 40, Choreo.Reduced.SKIP),
        ) to mapOf("row" to v.active.size)
        BluffPhase.VOTING -> {
            val lead = if (v.spotOnPlayers.isNotEmpty() && v.round == 1) KNEW_IT_MS.toInt() else 0
            buildList {
                if (lead > 0) add(s("knewIt", 0, lead, "linear", reduced = Choreo.Reduced.KEEP))
                add(s("pins", lead, 300, "ease.overshoot", 80))
            } to mapOf("pins" to v.options.size)
        }
        BluffPhase.SCORES -> listOf(
            s("bars", 0, 1_200, "ease.decel"),
            s("reorder", 1_300, 400, "ease.standard"),
            s("crown", 1_800, 260, "spring.hop"),
            s("tease", 2_200, 300, "ease.decel"),
        ) to emptyMap()
        BluffPhase.AWARDS -> listOf(
            s("title", 0, 600, "ease.overshoot"),
            s("card", AWARDS_BASE_MS.toInt(), 500, "ease.overshoot", AWARDS_PER_CARD_MS.toInt(), Choreo.Reduced.KEEP),
            s("winner", AWARDS_BASE_MS.toInt() + 300, 600, "spring.bouncy", AWARDS_PER_CARD_MS.toInt(), Choreo.Reduced.KEEP),
            s("count", AWARDS_BASE_MS.toInt() + 900, 600, "ease.decel", AWARDS_PER_CARD_MS.toInt(), Choreo.Reduced.KEEP),
        ) to mapOf("card" to v.awards.size, "winner" to v.awards.size, "count" to v.awards.size)
        BluffPhase.RESULTS -> listOf(
            s("podium", 0, 400, "spring.bouncy", PODIUM_STAGGER_MS, Choreo.Reduced.SKIP),
            s("confetti", 900, 1_600, "linear", reduced = Choreo.Reduced.SKIP),
            s("board", 600, 400, "ease.decel"),
            s("buttons", 1_100, 300, "ease.decel"),
        ) to mapOf("podium" to 3)
        BluffPhase.HOLD -> listOf(s("card", 0, 400, "ease.decel")) to emptyMap()
        BluffPhase.REVEAL -> emptyList<Choreo.Step>() to emptyMap() // [BluffScript]
    }

    /**
     * The phase moment of [v]. Calm motion: every step becomes a 150 ms fade at its own start (information keeps its
     * order: award cards still arrive one by one, in step with the server's AWARDS deadline); travel steps are dropped.
     */
    fun of(v: BluffView, reduced: Boolean): Moment {
        val (full, counts) = steps(v)
        val steps = if (!reduced) full else full.filter { it.reduced != Choreo.Reduced.SKIP }.map {
            it.copy(durationMs = minOf(it.durationMs, 150), easing = "ease.standard")
        }
        val total = steps.maxOfOrNull { it.startMs + it.staggerMs * maxOf(0, (counts[it.id] ?: 1) - 1) + it.durationMs } ?: 0
        return Moment("bluff.${v.phase.name.lowercase()}${if (reduced) ".reduced" else ""}", steps.map { MomentStep(it) }, total.toLong())
    }

    /** The server length of [v]'s phase when it is fixed (to find the phase start from its deadline), else null. */
    fun phaseLengthMs(v: BluffView): Long? = when (v.phase) {
        BluffPhase.ROUND_INTRO -> if (v.isFinal) ROUND_INTRO_FINAL_MS else ROUND_INTRO_MS
        BluffPhase.SCORES -> if (v.voided) 4_000L else SCORES_MS
        BluffPhase.AWARDS -> AWARDS_BASE_MS + AWARDS_PER_CARD_MS * v.awards.size
        BluffPhase.REVEAL -> v.reveal?.durationMs
        else -> null
    }

    /**
     * Time since the phase started, from the server deadline: a TV that (re)joins mid-phase starts at the right frame.
     * The first ROUND_INTRO of a game carries the entrance grace on top of its length: the elapsed time is then
     * negative, so the card waits under the café entrance and plays in full after it (GAME-BLUFF §4). Phases without a
     * fixed length start when first seen.
     */
    fun elapsedAtFirstSight(v: BluffView, serverNow: Long): Long {
        val len = phaseLengthMs(v) ?: return 0L
        val deadline = v.deadline ?: return 0L
        return (serverNow - (deadline - len)).coerceIn(-Constants.ENTRANCE_GRACE_MS, len)
    }

    /** Award card [i] (0-based) arrives at this time in the AWARDS phase (GAME-BLUFF §4.1 `2 500 + 3 500 × n`). */
    fun awardAtMs(i: Int): Long = AWARDS_BASE_MS + AWARDS_PER_CARD_MS * i
}

/** The in-game remote rule for Bluff (JAMAA-PLATFORM §3.10 E): there is no focusable control while playing. */
object BluffInput {
    /** OK completes a running moment (phase moment or reveal script) and is consumed; it never does anything else. */
    fun okCompletes(tMs: Long, totalMs: Long, completed: Boolean): Boolean = !completed && tMs < totalMs

    /**
     * RESULTS buttons accept OK only once the podium moment ended (naturally or by OK) and [Constants.INPUT_GUARD_MS]
     * passed (so OK mashed through the final reveal can never press "Play again"), and never on a key repeat.
     */
    fun resultsAccepts(nowMs: Long, interactiveAtMs: Long?, repeatCount: Int): Boolean =
        interactiveAtMs != null && repeatCount == 0 && nowMs >= interactiveAtMs + Constants.INPUT_GUARD_MS
}
