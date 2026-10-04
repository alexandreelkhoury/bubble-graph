package app.mishana.tv

import app.mishana.tv.game.Ranking
import app.mishana.tv.protocol.PublicPlayer
import org.junit.Assert.assertEquals
import org.junit.Test

class RankingTest {
    private fun p(id: String, seat: Int, score: Int) = PublicPlayer(
        id = id, name = id, color = "c0", seat = seat, connected = true, alive = true, left = false,
        isHost = false, ready = true, spoke = false, hasVoted = false, revealedRole = null, score = score,
    )

    @Test
    fun ordersByTotalThenSeat() {
        val order = Ranking.order(listOf(p("a", 0, 5), p("b", 1, 10), p("c", 2, 10), p("d", 3, 0)))
        assertEquals(listOf("b", "c", "a", "d"), order.map { it.id })
    }

    @Test
    fun tiedTotalsShareACompetitionRank() {
        val order = Ranking.order(listOf(p("a", 0, 10), p("b", 1, 10), p("c", 2, 10), p("d", 3, 4), p("e", 4, 4)))
        assertEquals(listOf(1, 1, 1, 4, 4), Ranking.ranks(order))
    }

    @Test
    fun distinctTotalsRankByPosition() {
        assertEquals(listOf(1, 2, 3), Ranking.ranks(Ranking.order(listOf(p("a", 0, 1), p("b", 1, 2), p("c", 2, 3)))))
        assertEquals(listOf(1, 1), Ranking.ranks(listOf(p("a", 0, 0), p("b", 1, 0))))
        assertEquals(emptyList<Int>(), Ranking.ranks(emptyList()))
    }
}
