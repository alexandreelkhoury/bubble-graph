package app.mishana.tv

import app.mishana.tv.game.EliminationPlan
import app.mishana.tv.game.EliminationPlan.Timing
import app.mishana.tv.game.AfterElimination
import app.mishana.tv.game.afterElimination
import app.mishana.tv.protocol.Eliminated
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.HistoryEntry
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.VoteOutcome
import app.mishana.tv.protocol.WinRule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EliminationPlanTest {
    private val view = TvFixtures.view("elimination")
    private val plan = EliminationPlan.of(view.lastVote, view.players, view.eliminated?.playerId)

    @Test
    fun flightsInSeatOrderWithStacks() {
        val seat = view.players.associate { it.id to it.seat }
        assertEquals(4, plan.flights.size)
        assertEquals(plan.flights.sortedBy { seat[it.voterId] }, plan.flights)
        assertEquals(Timing.LOCK, plan.flights.first().startMs)
        val onSam = plan.flights.filter { it.targetId == view.eliminated?.playerId }
        assertEquals(listOf(0, 1, 2), onSam.map { it.stackIndex })
        assertTrue(plan.flights.all { it.startMs < Timing.LOCK + Timing.ARROWS_SPREAD })
    }

    @Test
    fun landedCountsFollowTheArrowsClock() {
        val sam = view.eliminated!!.playerId
        assertEquals(0, plan.landed(sam, 0f))
        assertEquals(3, plan.landed(sam, plan.arrowsEnd.toFloat()))
        assertEquals(0, plan.landed(null, plan.arrowsEnd.toFloat()))
    }

    @Test
    fun budgetFitsTheDeadline() {
        // DESIGN §6.2: C ≤ 4.5 s, and the whole sequence fits ELIMINATION_HOLD_MS (8 s) with ≥ 0.5 s to spare.
        assertTrue(Timing.GROW + Timing.HOLD + Timing.FLIP + Timing.WASH <= 4_500)
        assertTrue(plan.nominalMs <= 8_000 - EliminationPlan.END_MARGIN_MS)
        assertEquals(1f, plan.budgetFactor(60_000, reduceMotion = false))
        assertEquals(0.5f, plan.budgetFactor(60_000, reduceMotion = true))
        val k = plan.budgetFactor(3_000, reduceMotion = false)
        assertTrue(k < 1f && plan.nominalMs * k <= 3_000 - EliminationPlan.END_MARGIN_MS + 1)
        assertEquals(0f, plan.budgetFactor(1_499, reduceMotion = false))
        assertEquals(1f, plan.budgetFactor(null, reduceMotion = false)) // no deadline: 8 s assumed
    }

    @Test
    fun wheelAndNoEliminationDurations() {
        val random = EliminationPlan.of(view.lastVote!!.copy(outcome = VoteOutcome.RANDOM), view.players, view.eliminated?.playerId)
        assertEquals(plan.nominalMs + Timing.WHEEL, random.nominalMs)
        val none = EliminationPlan.of(view.lastVote.copy(outcome = VoteOutcome.NO_ELIMINATION), view.players, null)
        assertEquals(plan.nominalMs - (Timing.GROW + Timing.HOLD + Timing.FLIP + Timing.WASH) + Timing.NO_ELIMINATION_END, none.nominalMs)
    }

    @Test
    fun countdownCopyNeverPromisesARoundThatWillNotCome() {
        // Fixture: 3 civilians + 1 undercover, official rule, a civilian voted out → 2 civilians + 1 undercover left.
        assertEquals(AfterElimination.NEXT_ROUND, afterElimination(view))
        // Parity: 1 infiltrator vs 2 civilians still plays on; one more civilian out ends it.
        assertEquals(AfterElimination.NEXT_ROUND, afterElimination(view.copy(settings = view.settings.copy(winRule = WinRule.PARITY))))
        val leaUndercover = view.copy(players = view.players.map { if (it.name == "Léa") it.copy(alive = false, revealedRole = Role.UNDERCOVER) else it })
        assertEquals(AfterElimination.OTHER, afterElimination(leaUndercover)) // no infiltrator left: game over
        // The Blank caught with blankGuess on → the last-chance guess comes next.
        val blank = view.copy(eliminated = Eliminated(view.eliminated!!.playerId, Role.BLANK))
        assertEquals(AfterElimination.LAST_CHANCE, afterElimination(blank))
        assertEquals(AfterElimination.OTHER, afterElimination(blank.copy(settings = blank.settings.copy(blankGuess = false), roleCounts = null)))
        // Three no-elimination rounds in a row send everyone back to the lobby.
        val none = HistoryEntry(1, null, null, HistoryCause.NONE)
        assertEquals(AfterElimination.OTHER, afterElimination(view.copy(eliminated = null, history = listOf(none, none, none))))
    }
}
