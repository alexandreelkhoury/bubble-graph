package app.jamaa.tv.games.likely

import app.jamaa.tv.Constants
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.TvGameMeta
import app.jamaa.tv.games.TvGameModule
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.GameIntent
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.protocol.member
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * "Most Likely" on the TV (JAMAA-PLATFORM §2.11, §6.6 G3 lane C), registered through the P stubs (GameDecoders,
 * GameScreens). The decoder joins `game.public.scores` to `room.members`; the screens live in `games/likely/ui/`.
 * The TV only ever draws its own projection: before REVEAL it has no vote, in secret-vote mode it never has a ballot.
 */
object LikelyTv : TvGameModule {
    override val meta: TvGameMeta get() = GameCatalog.LIKELY
    override val implemented: Boolean = true

    override fun decode(env: GameEnvelope, room: RoomPublic): LikelyGameView {
        val pub = ProtocolJson.decoder.decodeFromJsonElement(LikelyPub.serializer(), env.public)
        return LikelyGameView(env, compose(room, pub, env))
    }

    /** Joins each score line to its member, in seat order (a line without a member left the room: shown as left). */
    fun compose(room: RoomPublic, pub: LikelyPub, env: GameEnvelope): LikelyView {
        val voted = pub.votedIds.toSet()
        val fresh = pub.newIds.toSet()
        val players = pub.scores.mapIndexed { i, s ->
            val m = room.member(s.playerId)
            LikelyPlayer(
                id = s.playerId,
                name = m?.name ?: "",
                color = m?.color ?: Constants.COLORS[i % Constants.COLORS.size].id,
                seat = m?.seat ?: (100 + i),
                connected = m?.connected ?: false,
                left = m == null || m.left,
                isHost = m?.isHost ?: false,
                score = s.score,
                scoreBefore = s.scoreBefore,
                voted = pub.phase == LikelyPhase.VOTING && s.playerId in voted,
                isNew = s.playerId in fresh,
            )
        }.sortedBy { it.seat }
        return LikelyView(
            n = env.n,
            phase = pub.phase,
            cardIndex = pub.cardIndex,
            cardCount = pub.cardCount,
            deadline = pub.deadline,
            card = pub.card,
            // Defensive: a reveal is only drawn in REVEAL, and ballots only in public mode (§8.1), whatever arrives.
            reveal = pub.reveal?.takeIf { pub.phase == LikelyPhase.REVEAL }?.let { if (pub.showVoters) it else it.copy(ballots = null, deltas = emptyList()) },
            players = players,
            awards = if (pub.phase == LikelyPhase.AWARDS || pub.phase == LikelyPhase.RESULTS) pub.awards else emptyList(),
            showVoters = pub.showVoters,
            mode = pub.mode,
            over = env.over,
            contentLocale = room.contentLocale,
        )
    }

    /** Likely's setup, or null when the room's setup is another game's (or malformed). */
    fun setupView(room: RoomPublic): LikelySetupView? {
        val setup = room.setup?.takeIf { it.gameId == GameIds.LIKELY } ?: return null
        return try {
            LikelySetupView(
                settings = ProtocolJson.decoder.decodeFromJsonElement(LikelySetupSettings.serializer(), setup.settings),
                extras = ProtocolJson.decoder.decodeFromJsonElement(LikelyExtras.serializer(), setup.extras),
            )
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    // ---------------------------------------------------------------- intents (GAME-LIKELY §13.1; the TV is host only)

    private fun intent(type: String, extra: Map<String, JsonPrimitive> = emptyMap()) = GameIntent(
        GameIds.LIKELY,
        buildJsonObject {
            put("type", JsonPrimitive(type))
            for ((k, v) in extra) put(k, v)
        },
    )

    /** Pause item "Next" (CARD, REVEAL, AWARDS): expires the phase inline; ignored by the server in VOTING. */
    fun hostAdvance(): GameIntent = intent("HOST_ADVANCE")

    /** Pause item "Skip card" (CARD, VOTING): the server's strict schema requires the card id (stale ones are refused). */
    fun skipCard(cardId: String): GameIntent = intent("SKIP_CARD", mapOf("cardId" to JsonPrimitive(cardId)))

    /** Pause item "End game" (HOLD, confirm). */
    fun endGame(): GameIntent = intent("END_GAME")

    /**
     * The full intent for a pause item of [TvGameMeta.pauseItems] in the current [view]. SKIP_CARD needs the card id
     * that the platform pause menu's generic `{type}` intent lacks (JAMAA-GAP, see the lane report). Null when the item
     * cannot run now (no card on screen, or a phase the item does not list).
     */
    fun pauseIntent(intentType: String, view: LikelyView): GameIntent? = when (intentType) {
        "HOST_ADVANCE" -> hostAdvance().takeIf { view.phase in ADVANCE_PHASES }
        "SKIP_CARD" -> view.card?.id?.takeIf { view.phase == LikelyPhase.CARD || view.phase == LikelyPhase.VOTING }?.let(::skipCard)
        "END_GAME" -> endGame().takeIf { view.phase == LikelyPhase.HOLD }
        else -> null
    }

    private val ADVANCE_PHASES = setOf(LikelyPhase.CARD, LikelyPhase.REVEAL, LikelyPhase.AWARDS)

    /** `UPDATE_GAME_SETTINGS` patches the TV setup sends (GAME-LIKELY §9). Spicy is compiled out (§9.1, see SpicyGate). */
    fun lengthPatch(length: String): JsonObject = JsonObject(mapOf("length" to JsonPrimitive(length)))

    fun showVotersPatch(show: Boolean): JsonObject = JsonObject(mapOf("showVoters" to JsonPrimitive(show)))
}
