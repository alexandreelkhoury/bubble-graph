package app.jamaa.tv.games.mishana

import app.jamaa.tv.Constants
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.GameView
import app.jamaa.tv.games.TvGameMeta
import app.jamaa.tv.games.TvGameModule
import app.jamaa.tv.protocol.DeadlineView
import app.jamaa.tv.protocol.Eliminated
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.GameIntent
import app.jamaa.tv.protocol.GuessView
import app.jamaa.tv.protocol.HistoryEntry
import app.jamaa.tv.protocol.LockedPackInfo
import app.jamaa.tv.protocol.PackInfo
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.Points
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.PublicPlayer
import app.jamaa.tv.protocol.ResultView
import app.jamaa.tv.protocol.Role
import app.jamaa.tv.protocol.RoleCounts
import app.jamaa.tv.protocol.RoleMode
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.protocol.RoomSetup
import app.jamaa.tv.protocol.Settings
import app.jamaa.tv.protocol.SettingsPatch
import app.jamaa.tv.protocol.StartBlocker
import app.jamaa.tv.protocol.TieBreak
import app.jamaa.tv.protocol.VoteSummary
import app.jamaa.tv.protocol.WinRule
import app.jamaa.tv.protocol.member
import app.jamaa.tv.protocol.startBlockerOf
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject

// Mish Ana! inside the platform (JAMAA-PLATFORM §2.5 "Mish Ana! Pub and Me", §2.7). `Pub` is today's PublicView minus
// the room-level keys; names, colours, seats, `connected` and `isHost` come from `room.members`.

/** The game's own player fields (§2.5). */
@Serializable data class MishanaPlayerState(
    val id: String,
    val alive: Boolean,
    val left: Boolean,
    val ready: Boolean,
    val spoke: Boolean,
    val hasVoted: Boolean,
    val revealedRole: Role?,
    val score: Int,
)

/** `game.public` for `mishana` (exact key order of the fixtures). `settings` keeps `wordLocale` in game. */
@Serializable data class MishanaPub(
    val phase: Phase,
    val gameNumber: Int,
    val round: Int,
    val settings: Settings,
    val players: List<MishanaPlayerState>,
    val roleCounts: RoleCounts?,
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
)

/** `room.setup.settings` for `mishana`: the engine settings minus `wordLocale` (the room's `contentLocale`). */
@Serializable data class MishanaSetupSettings(
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
    val packIds: List<String>,
    val difficulties: List<Int>,
    val familyFilter: Boolean,
    val swapSides: Boolean,
    val points: Points,
) {
    /** The engine-shaped settings the Mish Ana! screens and the settings draft work on. */
    fun withLocale(locale: String): Settings = Settings(
        winRule, revealRoles, roleMode, undercoverCount, blankCount, clueSeconds, voteSeconds, revealSeconds, guessSeconds,
        tieBreak, blankGuess, locale, packIds, difficulties, familyFilter, swapSides, points,
    )
}

/** `room.setup.extras` for `mishana`. */
@Serializable data class MishanaExtras(val gameId: String, val roleCounts: RoleCounts, val poolExhausted: Boolean)

/**
 * The in-game Mish Ana! view the screens draw: [MishanaPub] with each player joined to its room member. Field names
 * are the v1 TvView's, so the screens ported by a change of data source only (§2.5).
 */
@Serializable data class MishanaView(
    val roomCode: String,
    val joinUrl: String,
    val phase: Phase,
    val gameNumber: Int,
    val round: Int,
    val settings: Settings,
    val players: List<PublicPlayer>,
    val hostPlayerId: String?,
    val roleCounts: RoleCounts?,
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
    /** The envelope's `over` (the instance reached its outcome). */
    val over: Boolean = false,
)

/** The decoded active Mish Ana! instance. */
data class MishanaGameView(override val envelope: GameEnvelope, val view: MishanaView) : GameView {
    override val gameId: String get() = GameIds.MISHANA
}

/**
 * Mish Ana! during SETUP, shaped like the v1 lobby view the Advanced settings screen reads (same field names), so it
 * ports by a change of data source. `settings.wordLocale` = the room's `contentLocale`.
 */
data class MishanaSetupView(
    val settings: Settings,
    val roleCounts: RoleCounts?,
    val players: List<PublicPlayer>,
    val hostPlayerId: String?,
    val canStart: Boolean,
    val startBlocker: String?,
    val availablePacks: List<PackInfo>,
    val lockedPacks: List<LockedPackInfo>,
    val premium: Boolean,
    val poolExhausted: Boolean,
    /** = `room.contentLocales` (the v1 `wordLocales`). */
    val wordLocales: List<String>,
)

val MishanaSetupView.blocker: StartBlocker? get() = startBlockerOf(startBlocker)

/** "No words / no content": the v1 engine code and the platform code (§2.2) read the same on the TV. */
val MishanaSetupView.noContent: Boolean
    get() = blocker == StartBlocker.NO_WORDS_AVAILABLE || blocker == StartBlocker.NO_CONTENT_AVAILABLE

fun MishanaView.player(id: String?): PublicPlayer? = if (id == null) null else players.firstOrNull { it.id == id }

/** Vote candidates: the tied players in a re-vote, else every alive player. */
fun MishanaView.voteCandidates(): List<PublicPlayer> =
    if (revote && tieCandidates.isNotEmpty()) tieCandidates.mapNotNull { player(it) } else players.filter { it.alive && !it.left }

object MishanaTv : TvGameModule {
    override val meta: TvGameMeta get() = GameCatalog.MISHANA
    override val implemented: Boolean = true

    override fun decode(env: GameEnvelope, room: RoomPublic): MishanaGameView {
        val pub = ProtocolJson.decoder.decodeFromJsonElement(MishanaPub.serializer(), env.public)
        return MishanaGameView(env, compose(room, pub, env.over, env.n))
    }

    /**
     * Joins the game's players to the room members (a player with no member left the room: shown as left).
     * `gameNumber` becomes the envelope's instance number [n]: every REPLAY starts a fresh engine whose own counter
     * restarts at 1, while the screens key their per-game state (and "Game n") on it.
     */
    fun compose(room: RoomPublic, pub: MishanaPub, over: Boolean, n: Int = pub.gameNumber): MishanaView {
        val players = pub.players.mapIndexed { i, p ->
            val m = room.member(p.id)
            PublicPlayer(
                id = p.id,
                name = m?.name ?: "",
                color = m?.color ?: Constants.COLORS[i % Constants.COLORS.size].id,
                seat = m?.seat ?: i,
                connected = m?.connected ?: false,
                alive = p.alive,
                left = p.left || m == null || m.left,
                isHost = m?.isHost ?: false,
                ready = p.ready,
                spoke = p.spoke,
                hasVoted = p.hasVoted,
                revealedRole = p.revealedRole,
                score = p.score,
            )
        }.sortedBy { it.seat }
        return MishanaView(
            roomCode = room.roomCode, joinUrl = room.joinUrl, phase = pub.phase, gameNumber = n, round = pub.round,
            settings = pub.settings, players = players, hostPlayerId = room.hostPlayerId, roleCounts = pub.roleCounts,
            speakingOrder = pub.speakingOrder, currentSpeakerId = pub.currentSpeakerId, revote = pub.revote,
            tieCandidates = pub.tieCandidates, deadline = pub.deadline, votesCast = pub.votesCast, votesExpected = pub.votesExpected,
            lastVote = pub.lastVote, eliminated = pub.eliminated, guess = pub.guess, result = pub.result, history = pub.history,
            over = over,
        )
    }

    /** The Mish Ana! setup, or null when the room's setup is another game's (or malformed). */
    fun setupView(room: RoomPublic): MishanaSetupView? {
        val setup = room.setup?.takeIf { it.gameId == GameIds.MISHANA } ?: return null
        return try {
            val s = ProtocolJson.decoder.decodeFromJsonElement(MishanaSetupSettings.serializer(), setup.settings)
            val extras = ProtocolJson.decoder.decodeFromJsonElement(MishanaExtras.serializer(), setup.extras)
            MishanaSetupView(
                settings = s.withLocale(room.contentLocale),
                roleCounts = extras.roleCounts,
                players = room.members.filter { !it.left }.map { m ->
                    PublicPlayer(m.id, m.name, m.color, m.seat, m.connected, alive = true, left = false, isHost = m.isHost,
                        ready = false, spoke = false, hasVoted = false, revealedRole = null, score = 0)
                },
                hostPlayerId = room.hostPlayerId,
                canStart = setup.canStart,
                startBlocker = setup.startBlocker,
                availablePacks = setup.availablePacks.filter { it.gameId == GameIds.MISHANA },
                lockedPacks = setup.lockedPacks.filter { it.gameId == GameIds.MISHANA },
                premium = room.premium,
                poolExhausted = extras.poolExhausted,
                wordLocales = room.contentLocales,
            )
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    /** `extras.poolExhausted` of a Mish Ana! setup (BillingNotices reads it here, §2.5). */
    fun poolExhausted(setup: RoomSetup?): Boolean {
        if (setup?.gameId != GameIds.MISHANA) return false
        return (setup.extras["poolExhausted"] as? JsonPrimitive)?.content == "true"
    }

    // ---------------------------------------------------------------- intents (§2.5: GAME {gameId:"mishana", i})

    private fun intent(type: String, extra: Map<String, JsonPrimitive> = emptyMap()) = GameIntent(
        GameIds.MISHANA,
        buildJsonObject {
            put("type", JsonPrimitive(type))
            for ((k, v) in extra) put(k, v)
        },
    )

    /** Host "Skip" (pause menu item `skip`). */
    fun hostAdvance(): GameIntent = intent("HOST_ADVANCE")

    fun hostOverrideGuess(accept: Boolean): GameIntent = intent("HOST_OVERRIDE_GUESS", mapOf("accept" to JsonPrimitive(accept)))

    /** The `UPDATE_GAME_SETTINGS` patch: the non-null fields of [p] minus `wordLocale` (null when nothing remains). */
    fun wirePatch(p: SettingsPatch): JsonObject? {
        val all = ProtocolJson.encoder.encodeToJsonElement(SettingsPatch.serializer(), p).jsonObject
        val rest = JsonObject(all.filterKeys { it != "wordLocale" })
        return rest.takeIf { it.isNotEmpty() }
    }
}
