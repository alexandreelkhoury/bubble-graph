package app.mishana.tv.game

import app.mishana.tv.protocol.PublicPlayer

/** Scoreboard ordering and ranks, shared logic with the web client (web-client/src/lib/view.ts). */
object Ranking {
    /** Scoreboard order: total desc, then seat. */
    fun order(players: List<PublicPlayer>): List<PublicPlayer> =
        players.sortedWith(compareByDescending<PublicPlayer> { it.score }.thenBy { it.seat })

    /**
     * Competition ranking ("1, 1, 1, 4"): each player's rank is 1 + the number of players with a strictly higher
     * total, so equal totals share a rank (and the trophy). Returned in the same order as [players].
     */
    fun ranks(players: List<PublicPlayer>): List<Int> = players.map { p -> 1 + players.count { it.score > p.score } }
}
