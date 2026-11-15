package app.jamaa.tv.games.taqriban

import app.jamaa.tv.games.GameView
import app.jamaa.tv.protocol.GameEnvelope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Kotlin mirror of Taqriban's wire views (GAME-TAQRIBAN §13.2, shared/src/games/taqriban/protocol.ts). Exact names and
// key order of `TaqribanPublicSchema`. The TV never receives `game.me`, and before REVEAL it has no answer and no guess.

@Serializable enum class TaqPhase { QUESTION, REVEAL, LEADERBOARD, FINAL_INTRO, RESULTS, HOLD }

@Serializable enum class TaqMode { @SerialName("ratio") RATIO, @SerialName("absolute") ABSOLUTE }

@Serializable data class TaqQuestion(val id: String, val text: String, val unit: String)

@Serializable data class TaqGuess(val id: String, val value: Double, val rank: Int, val closest: Boolean, val bullseye: Boolean, val points: Int)

@Serializable data class TaqReveal(
    val answer: Double,
    val source: String,
    val mode: TaqMode,
    val logLine: Boolean,
    val guesses: List<TaqGuess>,
    val missingIds: List<String>,
    val closestIds: List<String>,
    val bullseyeIds: List<String>,
    val wildId: String?,
)

@Serializable data class TaqScore(
    val playerId: String,
    val score: Int,
    val scoreBefore: Int,
    val rank: Int?,
    val rankBefore: Int?,
    val closest: Int,
    val bullseyes: Int,
    val left: Boolean,
)

/** `game.public` for `taqriban` (exact key order of `TaqribanPublicSchema`). */
@Serializable data class TaqPub(
    val schema: Int,
    val phase: TaqPhase,
    val index: Int,
    val total: Int,
    val isFinal: Boolean,
    val deadline: Long?,
    val durationMs: Long?,
    val question: TaqQuestion?,
    val answeredIds: List<String>,
    val reveal: TaqReveal?,
    val scores: List<TaqScore>,
    val newIds: List<String>,
    val waitingIds: List<String>,
    val rerun: Boolean,
    val endedEarly: Boolean,
)

/** `room.setup.extras` for `taqriban`: how many playable questions the selected packs hold. */
@Serializable data class TaqExtras(val gameId: String, val available: Int)

/** One player of the instance (a `scores` line) joined to its room member. */
data class TaqPlayer(
    val id: String,
    val name: String,
    val color: String,
    val seat: Int,
    val connected: Boolean,
    val left: Boolean,
    val waiting: Boolean,
    /** QUESTION: has locked a guess (never which). */
    val guessed: Boolean,
    val score: TaqScore,
)

/** The in-game view the Taqriban screens draw. */
data class TaqView(
    val n: Int,
    val phase: TaqPhase,
    val index: Int,
    val total: Int,
    val isFinal: Boolean,
    val deadline: Long?,
    val durationMs: Long?,
    val question: TaqQuestion?,
    val reveal: TaqReveal?,
    val players: List<TaqPlayer>,
    val endedEarly: Boolean,
    val over: Boolean,
) {
    /** Players still in the instance (seat order). */
    val cast: List<TaqPlayer> get() = players.filter { !it.left }

    /** Who may guess this question. */
    val guessers: List<TaqPlayer> get() = cast.filter { !it.waiting }

    fun player(id: String?): TaqPlayer? = if (id == null) null else players.firstOrNull { it.id == id }

    /** The standings: rank, then seat (left players out). */
    val ranked: List<TaqPlayer> get() = cast.sortedWith(compareBy({ it.score.rank ?: 99 }, { it.seat }))
}

data class TaqribanGameView(override val envelope: GameEnvelope, val view: TaqView) : GameView {
    override val gameId: String get() = envelope.gameId
}
