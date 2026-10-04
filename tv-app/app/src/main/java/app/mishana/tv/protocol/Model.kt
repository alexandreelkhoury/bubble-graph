package app.mishana.tv.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Kotlin mirror of shared/src/protocol views (SPEC §5, §9.5). Exact names; S2C JSON never omits keys.

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
@Serializable data class LocalizedTitle(val en: String, val fr: String, val ar: String)

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
/** PAYMENTS-SPEC §3.11: `tier` ("free" | "premium") is the final key. Default only for a pre-billing server. */
@Serializable data class PackInfo(val id: String, val locale: String, val title: LocalizedTitle, val pairCount: Int, val ageRating: String, val tier: String = "free")

/** PAYMENTS-SPEC §3.11: a pack this room may not play. Metadata only: never words, never pair ids. */
@Serializable data class LockedPackInfo(
    val id: String,
    val locale: String,
    val title: LocalizedTitle,
    val pairCount: Int,
    val ageRating: String,
    val productId: String,
)

@Serializable data class TvView(
    val kind: String, // always "tv"
    val roomCode: String,
    val joinUrl: String,
    val phase: Phase,
    val gameNumber: Int,
    val round: Int,
    val settings: Settings,
    val players: List<PublicPlayer>,
    val hostPlayerId: String?,
    val roleCounts: RoleCounts?,
    val canStart: Boolean,
    val startBlocker: String?,
    val speakingOrder: List<String>,
    val currentSpeakerId: String?,
    val revote: Boolean,
    val tieCandidates: List<String>,
    val deadline: DeadlineView?,
    val votesCast: Int,
    val votesExpected: Int,
    val lastVote: VoteSummary?,
    val eliminated: Eliminated?,
    val guess: GuessView?,
    val result: ResultView?,
    val history: List<HistoryEntry>,
    val availablePacks: List<PackInfo>,
    // PAYMENTS-SPEC §3.11, appended after availablePacks in this order. Defaults only so a pre-billing server's
    // view still decodes in production (free, nothing locked); fixtures always carry every key.
    val premium: Boolean = false,
    val lockedPacks: List<LockedPackInfo> = emptyList(),
    val tvBusy: Boolean = false,
    val poolExhausted: Boolean = false,
)
