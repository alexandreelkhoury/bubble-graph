package app.jamaa.tv.games.bluff

import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.GameView
import app.jamaa.tv.protocol.GameEnvelope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Bluff! (GAME-BLUFF §13.2, shared/src/games/bluff/protocol.ts) as the TV receives it. Field names and order are the
// zod schemas'; BluffDecodeTest decodes every Bluff fixture of shared/fixtures/v2/games/bluff with the strict decoder,
// so a renamed or added key fails the build instead of silently dropping data.
// Secrecy (GAME-BLUFF §8.1, §13.3): the TV projection already carries no truth, author, vote or like before REVEAL. The
// composed [BluffView] adds a second guard: `options` only from VOTING, `reveal` only in REVEAL and SCORES, so no screen
// can draw a secret early even from a malformed frame.

@Serializable enum class BluffPhase { ROUND_INTRO, WRITING, VOTING, REVEAL, SCORES, AWARDS, RESULTS, HOLD }

@Serializable enum class RoundKind {
    @SerialName("saying") SAYING,
    @SerialName("fact") FACT,
    @SerialName("noTruth") NO_TRUTH,
}

@Serializable enum class BluffType {
    @SerialName("proverb_end") PROVERB_END,
    @SerialName("fact_blank") FACT_BLANK,
    @SerialName("word_meaning") WORD_MEANING,
    @SerialName("expression_meaning") EXPRESSION_MEANING,
    @SerialName("no_truth") NO_TRUTH,
}

@Serializable enum class LengthHint {
    @SerialName("short") SHORT,
    @SerialName("few") FEW,
    @SerialName("sentence") SENTENCE,
    @SerialName("free") FREE,
}

@Serializable enum class BluffNotice {
    @SerialName("tooFamous") TOO_FAMOUS,
    @SerialName("voided") VOIDED,
    @SerialName("allKnew") ALL_KNEW,
}

@Serializable enum class OptionKind {
    @SerialName("lie") LIE,
    @SerialName("house") HOUSE,
    @SerialName("truth") TRUTH,
}

@Serializable enum class DeltaReason {
    @SerialName("truth") TRUTH,
    @SerialName("fooled") FOOLED,
    @SerialName("like") LIKE,
    @SerialName("convincing") CONVINCING,
}

@Serializable enum class AwardId {
    @SerialName("bluffOfTheNight") BLUFF_OF_THE_NIGHT,
    @SerialName("lieDetector") LIE_DETECTOR,
    @SerialName("crowdFavourite") CROWD_FAVOURITE,
    @SerialName("hookLineSinker") HOOK_LINE_SINKER,
}

/** The public prompt: `original` is the prompt text in its pack language, `display` the room-language translation. */
@Serializable data class BluffPrompt(
    val id: String,
    val type: BluffType,
    val original: String,
    val translit: String?,
    val display: String?,
    val lengthHint: LengthHint,
    val rerun: Boolean,
)

/** One anonymous option card (VOTING onwards); texts are display-normalised by the server. */
@Serializable data class BluffOption(val id: String, val text: String)

@Serializable data class BluffDelta(val playerId: String, val points: Int, val reason: DeltaReason)

@Serializable data class RevealStep(
    val optionId: String,
    val kind: OptionKind,
    val quick: Boolean,
    val text: String,
    val authorIds: List<String>,
    val helped: Boolean,
    val voteCount: Int,
    /** Empty in the final (anonymous ballots, GAME-BLUFF §6.5). */
    val voterIds: List<String>,
    val likerIds: List<String>,
    val foundEarlyIds: List<String>,
    val spotOnIds: List<String>,
    val top: Boolean,
    val deltas: List<BluffDelta>,
)

@Serializable data class SpotOnDelta(val playerId: String, val points: Int)

@Serializable data class UnpickedLie(
    val optionId: String,
    val text: String,
    val authorIds: List<String>,
    val likerIds: List<String>,
    val deltas: List<BluffDelta>,
)

@Serializable data class RevealTruth(val text: String, val original: String?, val note: String?)

/** The full reveal script data (GAME-BLUFF §12.2), REVEAL onwards. `durationMs` is the server's REVEAL deadline length. */
@Serializable data class BluffReveal(
    val final: Boolean,
    val steps: List<RevealStep>,
    val spotOnDeltas: List<SpotOnDelta>,
    val unpicked: List<UnpickedLie>,
    val truth: RevealTruth?,
    val durationMs: Long,
)

@Serializable data class BluffAward(
    val id: AwardId,
    val playerIds: List<String>,
    val value: Int,
    /** Bluff of the Night: the winning answer, replayed on its card. */
    val text: String?,
    val promptIndex: Int?,
)

@Serializable data class BluffScore(val playerId: String, val score: Int, val scoreBefore: Int)

/** `game.public` for `bluff` (BluffPublicSchema). */
@Serializable data class BluffPub(
    val schema: Int,
    val phase: BluffPhase,
    val round: Int,
    val roundCount: Int,
    val roundKind: RoundKind,
    val promptIndex: Int,
    val promptCount: Int,
    val multiplier: Int,
    val deadline: Long?,
    val prompt: BluffPrompt?,
    val submittedIds: List<String>,
    val spotOnIds: List<String>,
    val options: List<BluffOption>,
    val votedIds: List<String>,
    val voided: Boolean,
    val notice: BluffNotice?,
    val reveal: BluffReveal?,
    val scores: List<BluffScore>,
    val newIds: List<String>,
    val awards: List<BluffAward>,
    val skipsLeft: Int,
    val hidesLeft: Int,
)

/** `game.me` (phones only; the TV always receives null). Decoded so the player fixtures prove the schema mirror. */
@Serializable data class BluffMe(
    val myLie: String?,
    val myLieStatus: String,
    val spotOn: Boolean,
    val help: String?,
    val helpNone: Boolean,
    val myOptionIds: List<String>,
    val myVote: String?,
    val myLikes: List<String>,
    val foundWhileWriting: Boolean,
    val editsLeft: Int,
    val tooCloseCount: Int,
    val waitingForNext: Boolean,
)

// ---------------------------------------------------------------- setup (`room.setup` while SETUP is Bluff's)

/** `room.setup.extras` for `bluff`: `available` = playable prompts now; `bigGroup` = ≥ 8 members (GAME-BLUFF §7). */
@Serializable data class BluffExtras(val gameId: String, val available: Int, val bigGroup: Boolean)

/** `room.setup.settings` for `bluff` (GAME-BLUFF §9). */
@Serializable data class BluffSetupSettings(val packIds: List<String>, val length: String, val pace: String)

data class BluffSetupView(val settings: BluffSetupSettings, val extras: BluffExtras) {
    /** Setup hint keys next to the rows (GAME-BLUFF §7: "Big group: we suggest a Short game" by the Length row). */
    val hintKeys: Map<String, String>
        get() = if (extras.bigGroup && settings.length != "short") mapOf("length" to "game.bluff.setup.bigGroup") else emptyMap()
}

// ---------------------------------------------------------------- the composed view the screens draw

/** One player of the instance: the game's score line joined to its room member (names and colours are the room's). */
data class BluffPlayer(
    val id: String,
    val name: String,
    val color: String,
    val seat: Int,
    val connected: Boolean,
    val left: Boolean,
    val isHost: Boolean,
    val score: Int,
    val scoreBefore: Int,
    /** WRITING: an envelope is in the box (never which text). */
    val submitted: Boolean,
    /** VOTING: holds up a ballot (never which option). */
    val voted: Boolean,
    /** Round 1, VOTING onwards: knew the real ending ("Knew it!" pin). */
    val spotOn: Boolean,
    /** The "New" ribbon for one prompt (late joiner). */
    val isNew: Boolean,
)

/** The in-game Bluff view: [BluffPub] with every score line joined to `room.members`, players in seat order. */
data class BluffView(
    val n: Int,
    val phase: BluffPhase,
    val round: Int,
    val roundCount: Int,
    val roundKind: RoundKind,
    val promptIndex: Int,
    val promptCount: Int,
    val multiplier: Int,
    val deadline: Long?,
    val prompt: BluffPrompt?,
    /** VOTING onwards only (secrecy guard). */
    val options: List<BluffOption>,
    val voided: Boolean,
    val notice: BluffNotice?,
    /** REVEAL and SCORES only (secrecy guard). */
    val reveal: BluffReveal?,
    val players: List<BluffPlayer>,
    val awards: List<BluffAward>,
    val skipsLeft: Int,
    val hidesLeft: Int,
    val over: Boolean,
    val contentLocale: String,
) {
    /** 1-based prompt number for the "3 of 7" counter (clamped: AWARDS reports promptIndex == promptCount). */
    val promptNumber: Int get() = (promptIndex + 1).coerceAtMost(promptCount)
    val isFinal: Boolean get() = roundKind == RoundKind.NO_TRUTH
    fun player(id: String?): BluffPlayer? = if (id == null) null else players.firstOrNull { it.id == id }

    /** Players still in the game (left players keep a frozen, greyed score on the results). */
    val active: List<BluffPlayer> get() = players.filter { !it.left }
    val spotOnPlayers: List<BluffPlayer> get() = players.filter { it.spotOn }
}

/** The decoded active Bluff instance. */
data class BluffGameView(override val envelope: GameEnvelope, val view: BluffView) : GameView {
    override val gameId: String get() = GameIds.BLUFF
}
