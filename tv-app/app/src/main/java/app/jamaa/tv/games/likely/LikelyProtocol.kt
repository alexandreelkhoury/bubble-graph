package app.jamaa.tv.games.likely

import app.jamaa.tv.games.GameView
import app.jamaa.tv.protocol.GameEnvelope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Kotlin mirror of Likely's wire views (GAME-LIKELY §13.2, shared/src/games/likely/protocol.ts). Exact names and key
// order of `LikelyPublicSchema`; S2C JSON never omits keys. The TV never receives `game.me` (it is `null` for the TV).

@Serializable enum class LikelyPhase { CARD, VOTING, REVEAL, AWARDS, RESULTS, HOLD }

@Serializable enum class LikelyMode { @SerialName("family") FAMILY, @SerialName("spicy") SPICY }

/** GAME-LIKELY §6.2. `SELF_AWARE` and `MIND_READER` exist in public mode only. */
@Serializable enum class LikelyAwardKind {
    @SerialName("signature") SIGNATURE,
    @SerialName("mystery") MYSTERY,
    @SerialName("star") STAR,
    @SerialName("selfAware") SELF_AWARE,
    @SerialName("mindReader") MIND_READER,
}

@Serializable enum class LikelyDeltaReason { @SerialName("agree") AGREE, @SerialName("unanimous") UNANIMOUS, @SerialName("selfAware") SELF_AWARE }

/** The card on screen (CARD+). `prompt` already has `{player}` resolved to the named player's name. */
@Serializable data class LikelyCard(
    val id: String,
    val prompt: String,
    val award: String,
    val spicy: Boolean,
    val namedPlayerId: String?,
    val rerun: Boolean,
)

/** Votes per target; `percent` = round(100 × count / votesCast), both modes (§5.1). */
@Serializable data class LikelyCount(val playerId: String, val count: Int, val percent: Int)

/** Public mode only (`null` in secret-vote mode, never projected there). */
@Serializable data class LikelyBallot(val voterId: String, val targetId: String)

@Serializable data class LikelyDelta(val playerId: String, val points: Int, val reason: LikelyDeltaReason)

@Serializable data class LikelyReveal(
    val votesCast: Int,
    val counts: List<LikelyCount>,
    val topIds: List<String>,
    val unanimous: Boolean,
    val chaos: Boolean,
    val none: Boolean,
    val againId: String?,
    val ballots: List<LikelyBallot>?,
    val deltas: List<LikelyDelta>,
)

@Serializable data class LikelyScore(val playerId: String, val score: Int, val scoreBefore: Int)

@Serializable data class LikelyAwardCard(val index: Int, val id: String, val prompt: String, val award: String, val namedPlayerId: String?)

@Serializable data class LikelyAward(val kind: LikelyAwardKind, val playerIds: List<String>, val value: Int?, val card: LikelyAwardCard?)

/** `game.public` for `likely` (exact key order of `LikelyPublicSchema`). */
@Serializable data class LikelyPub(
    val schema: Int,
    val phase: LikelyPhase,
    val cardIndex: Int,
    val cardCount: Int,
    val deadline: Long?,
    val card: LikelyCard?,
    val newIds: List<String>,
    val votedIds: List<String>,
    val reveal: LikelyReveal?,
    val scores: List<LikelyScore>,
    val awards: List<LikelyAward>,
    val showVoters: Boolean,
    val mode: LikelyMode,
)

/** `room.setup.settings` for `likely` (GAME-LIKELY §9). */
@Serializable data class LikelySetupSettings(val packIds: List<String>, val length: String, val showVoters: Boolean, val mode: LikelyMode)

/** `room.setup.extras` for `likely`: how many playable cards the selected packs hold. */
@Serializable data class LikelyExtras(val gameId: String, val available: Int)

/** One player of the instance (a `scores` line) joined to its room member. */
data class LikelyPlayer(
    val id: String,
    val name: String,
    val color: String,
    val seat: Int,
    val connected: Boolean,
    /** Left the room (or its member is gone): not on the jury arc any more; greyed in AWARDS/RESULTS. */
    val left: Boolean,
    val isHost: Boolean,
    val score: Int,
    val scoreBefore: Int,
    /** In VOTING: has voted (never for whom). */
    val voted: Boolean,
    /** First card of a late joiner: the "New" ribbon. */
    val isNew: Boolean,
)

/** The in-game view the Likely screens draw: [LikelyPub] with every player joined to its member. */
data class LikelyView(
    val n: Int,
    val phase: LikelyPhase,
    val cardIndex: Int,
    val cardCount: Int,
    val deadline: Long?,
    val card: LikelyCard?,
    val reveal: LikelyReveal?,
    /** Every player of the instance in seat order (left ones included, flagged). */
    val players: List<LikelyPlayer>,
    val awards: List<LikelyAward>,
    val showVoters: Boolean,
    val mode: LikelyMode,
    val over: Boolean,
    val contentLocale: String,
) {
    /** Players on the jury arc: everyone who has not left, in seat order. */
    val jury: List<LikelyPlayer> get() = players.filter { !it.left }

    fun player(id: String?): LikelyPlayer? = if (id == null) null else players.firstOrNull { it.id == id }

    /** Secret-vote mode ("anonymous" in code): no ballots, no points, awards only (GAME-LIKELY §6, §8.1). */
    val anonymous: Boolean get() = !showVoters
}

/** The decoded active game (JAMAA-PLATFORM §2.5). */
data class LikelyGameView(override val envelope: GameEnvelope, val view: LikelyView) : GameView {
    override val gameId: String get() = envelope.gameId
}

/** The Likely setup as the TV draws it (HUB-03 summary). */
data class LikelySetupView(val settings: LikelySetupSettings, val extras: LikelyExtras)
