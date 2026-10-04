package app.mishana.tv.game

import app.mishana.tv.Constants
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.VoteOutcome
import app.mishana.tv.protocol.VoteSummary
import app.mishana.tv.protocol.WinRule
import kotlin.math.min

/**
 * The TV-07 vote reveal + TV-09 card sequence as data (DESIGN §6.2-B/C), pure so its timing contract is JVM-tested:
 * the chip flights in seat order, the nominal duration of every stage, and the budget factor that fits the whole
 * sequence into the ELIMINATION deadline (never local constants).
 */
class EliminationPlan(
    val flights: List<Flight>,
    val outcome: VoteOutcome?,
    val hasElimination: Boolean,
) {
    /** One voter's chip: voter → target (null = the "No vote" bin), launched at [startMs]; [stackIndex] on its target. */
    data class Flight(val voterId: String, val targetId: String?, val startMs: Int, val stackIndex: Int)

    /** Nominal durations (ms) before budget scaling. B ≤ 3 s, C ≤ 4.5 s (binding, DESIGN §6.2). */
    object Timing {
        const val LOCK = 300
        const val ARROWS_SPREAD = 1_500
        const val FLIGHT = 600
        const val TRAIL_FADE = 600
        const val SUSPENSE = 600
        const val VERDICT = 400
        const val VERDICT_SETTLE = 250
        const val WHEEL = 2_000
        const val GROW = 400
        const val HOLD = 600
        const val FLIP = 800
        const val WASH = 600
        const val NO_ELIMINATION_END = 600
    }

    /** When the last chip lands (ms on the arrows clock). */
    val arrowsEnd: Int = (flights.maxOfOrNull { it.startMs } ?: Timing.LOCK) + Timing.FLIGHT

    val hasWheel: Boolean get() = outcome == VoteOutcome.RANDOM

    /** The whole sequence at 1×: B (reveal) + the random-pick wheel + C (card), or a short end for no elimination. */
    val nominalMs: Int
        get() {
            val b = Timing.LOCK + Timing.ARROWS_SPREAD + Timing.FLIGHT + Timing.SUSPENSE + Timing.VERDICT
            val wheel = if (hasWheel) Timing.WHEEL else 0
            val c = if (hasElimination) Timing.GROW + Timing.HOLD + Timing.FLIP + Timing.WASH else Timing.NO_ELIMINATION_END
            return b + wheel + c
        }

    /** Chips that have landed on [targetId] (null = the bin) at [arrowsMs] on the arrows clock. */
    fun landed(targetId: String?, arrowsMs: Float): Int =
        flights.count { it.targetId == targetId && arrowsMs >= it.startMs + Timing.FLIGHT }

    /**
     * Time scale of the sequence: everything must end ≥ 0.5 s before the deadline. 1 (0.5 in reduced motion) when it
     * fits; less when it does not; 0 = skip straight to the end state (less than 1.5 s left, or nothing to play).
     * [availableMs] = time left until the deadline, or null when the phase has no deadline (then 8 s are assumed).
     */
    fun budgetFactor(availableMs: Long?, reduceMotion: Boolean): Float {
        val available = availableMs ?: NO_DEADLINE_BUDGET_MS
        val base = if (reduceMotion) 0.5f else 1f
        return if (available < MIN_BUDGET_MS) 0f else min(base, (available - END_MARGIN_MS) / nominalMs.toFloat())
    }

    companion object {
        const val NO_DEADLINE_BUDGET_MS = 8_000L
        const val MIN_BUDGET_MS = 1_500L
        const val END_MARGIN_MS = 500L

        /** Flights in seat order (voters spread over [Timing.ARROWS_SPREAD] after [Timing.LOCK]); abstentions → the bin. */
        fun of(vote: VoteSummary?, players: List<PublicPlayer>, eliminatedId: String?): EliminationPlan {
            if (vote == null) return EliminationPlan(emptyList(), null, eliminatedId != null)
            val byVoter = mutableListOf<Pair<String, String?>>()
            for (t in vote.tally) for (v in t.voterIds) byVoter += v to t.targetId
            for (a in vote.abstainIds) byVoter += a to null
            val seat = players.associate { it.id to it.seat }
            val ordered = byVoter.sortedBy { seat[it.first] ?: Int.MAX_VALUE }
            val n = ordered.size.coerceAtLeast(1)
            val stackCount = mutableMapOf<String?, Int>()
            val flights = ordered.mapIndexed { i, (v, t) ->
                val idx = stackCount.getOrDefault(t, 0)
                stackCount[t] = idx + 1
                Flight(v, t, Timing.LOCK + i * Timing.ARROWS_SPREAD / n, idx)
            }
            return EliminationPlan(flights, vote.outcome, eliminatedId != null)
        }
    }
}

/** What follows the ELIMINATION hold, as far as public information tells (the end-state countdown copy, TV-09). */
enum class AfterElimination { NEXT_ROUND, LAST_CHANCE, OTHER }

/**
 * Mirrors the engine's order (shared/src/engine/turns.ts `afterElimination`) on public data only — the role counts,
 * the revealed roles of eliminated/departed players and the history — so the TV never says "Next round in…" before
 * a game-over or a lobby reset, and never reveals more than the players could count themselves.
 * [OTHER] = the game ends (or returns to the lobby), or the counts are not known: the screen stays neutral.
 */
fun afterElimination(view: TvView): AfterElimination {
    if (view.phase != Phase.ELIMINATION) return AfterElimination.OTHER
    val elim = view.eliminated
    if (elim?.role == Role.BLANK && view.settings.blankGuess) return AfterElimination.LAST_CHANCE
    val rc = view.roleCounts ?: return AfterElimination.OTHER
    val outInfiltrators = view.players.count { it.revealedRole == Role.UNDERCOVER || it.revealedRole == Role.BLANK }
    val aliveI = rc.undercover + rc.blank - outInfiltrators
    val aliveC = view.players.count { it.alive && !it.left } - aliveI
    val over = aliveI <= 0 ||
        (view.settings.winRule == WinRule.OFFICIAL && aliveC <= 1) ||
        (view.settings.winRule == WinRule.PARITY && aliveI >= aliveC)
    if (over) return AfterElimination.OTHER
    val relevant = view.history.filter { it.cause == HistoryCause.VOTE || it.cause == HistoryCause.RANDOM || it.cause == HistoryCause.NONE }
    val streak = relevant.takeLast(Constants.MAX_NO_ELIMINATION_STREAK)
    if (streak.size == Constants.MAX_NO_ELIMINATION_STREAK && streak.all { it.cause == HistoryCause.NONE }) return AfterElimination.OTHER
    return AfterElimination.NEXT_ROUND
}
