@file:OptIn(ExperimentalSerializationApi::class)

package app.jamaa.tv.protocol

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mish Ana! view types (SPEC §5, §9.5), shared by the Mish Ana! package and the components it uses. Exact names;
// S2C JSON never omits keys. Since protocol v2 they live inside `game.public` (games/mishana/MishanaProtocol.kt).

@Serializable enum class Phase { LOBBY, ROLE_REVEAL, CLUES, VOTING, TIE_BREAK, ELIMINATION, MR_WHITE_GUESS, RESULTS }
@Serializable enum class Role { CIVILIAN, UNDERCOVER, BLANK }
@Serializable enum class Winner { CIVILIANS, INFILTRATORS, BLANK }
@Serializable enum class DeadlineKind { REVEAL, CLUE, VOTE, ELIMINATION, GUESS, VERDICT }
@Serializable enum class VoteOutcome { ELIMINATED, TIE, RANDOM, NO_ELIMINATION }
@Serializable enum class GuessStatus { PENDING, CORRECT, WRONG, TIMEOUT }
@Serializable enum class HistoryCause { VOTE, RANDOM, KICK, LEAVE, NONE }
@Serializable enum class WinRule { @SerialName("official") OFFICIAL, @SerialName("parity") PARITY }
@Serializable enum class RoleMode { @SerialName("auto") AUTO, @SerialName("custom") CUSTOM }
@Serializable enum class TieBreak { @SerialName("random") RANDOM, @SerialName("none") NONE }

@Serializable data class WordRef(val text: String, val translit: String?)
@Serializable data class RoleCounts(val civilian: Int, val undercover: Int, val blank: Int)
@Serializable data class Points(val civilian: Int, val undercover: Int, val blank: Int)
/** `es` came after en/fr/ar and is optional in pack titles (absent = show `en`). */
@Serializable data class LocalizedTitle(
    val en: String, val fr: String, val ar: String,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val es: String? = null,
)

@Serializable data class Settings(
    val winRule: WinRule,
    val revealRoles: Boolean,
    val roleMode: RoleMode,
    val undercoverCount: Int,
    val blankCount: Int,
    val clueSeconds: Int,
    val voteSeconds: Int,
    val revealSeconds: Int,
    val guessSeconds: Int,
    val tieBreak: TieBreak,
    val blankGuess: Boolean,
    val wordLocale: String,
    val packIds: List<String>,
    val difficulties: List<Int>,
    val familyFilter: Boolean,
    val swapSides: Boolean,
    val points: Points,
)

/**
 * A Mish Ana! player as the screens draw it: the room member (name, colour, seat, connected, host) joined with the
 * game's own player fields (JAMAA-PLATFORM §2.5). Composed on the TV, never on the wire.
 */
@Serializable data class PublicPlayer(
    val id: String,
    val name: String,
    val color: String,
    val seat: Int,
    val connected: Boolean,
    val alive: Boolean,
    val left: Boolean,
    val isHost: Boolean,
    val ready: Boolean,
    val spoke: Boolean,
    val hasVoted: Boolean,
    val revealedRole: Role?,
    val score: Int,
)

@Serializable data class DeadlineView(val kind: DeadlineKind, val at: Long, val durationMs: Long)
@Serializable data class TallyEntry(val targetId: String, val voterIds: List<String>)

@Serializable data class VoteSummary(
    val round: Int,
    val revote: Boolean,
    val tally: List<TallyEntry>,
    val abstainIds: List<String>,
    val outcome: VoteOutcome,
    val eliminatedId: String?,
)

@Serializable data class Eliminated(val playerId: String, val role: Role)
@Serializable data class GuessView(val playerId: String, val status: GuessStatus, val text: String?, val overridden: Boolean)
@Serializable data class PackRef(val id: String, val version: Int, val title: LocalizedTitle)

@Serializable data class ResultView(
    val winner: Winner,
    val winnerIds: List<String>,
    val civilianWord: WordRef,
    val undercoverWord: WordRef,
    val pack: PackRef,
    val pointsAwarded: Map<String, Int>,
    val guesses: List<GuessView>,
)

@Serializable data class HistoryEntry(val round: Int, val eliminatedId: String?, val role: Role?, val cause: HistoryCause)
