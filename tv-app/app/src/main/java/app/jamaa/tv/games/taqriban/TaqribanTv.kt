package app.jamaa.tv.games.taqriban

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
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Taqriban! on the TV (GAME-TAQRIBAN), registered in GameDecoders / GameScreens. The decoder joins `game.public.scores`
 * to `room.members`; the screens live in `games/taqriban/ui/`. Host actions are pause-menu items only.
 */
object TaqribanTv : TvGameModule {
    override val meta: TvGameMeta get() = GameCatalog.TAQRIBAN
    override val implemented: Boolean = true

    override fun decode(env: GameEnvelope, room: RoomPublic): TaqribanGameView {
        val pub = ProtocolJson.decoder.decodeFromJsonElement(TaqPub.serializer(), env.public)
        return TaqribanGameView(env, compose(room, pub, env))
    }

    fun compose(room: RoomPublic, pub: TaqPub, env: GameEnvelope): TaqView {
        val guessed = pub.answeredIds.toSet()
        val waiting = pub.waitingIds.toSet()
        val players = pub.scores.mapIndexed { i, s ->
            val m = room.member(s.playerId)
            TaqPlayer(
                id = s.playerId,
                name = m?.name ?: "",
                color = m?.color ?: Constants.COLORS[i % Constants.COLORS.size].id,
                seat = m?.seat ?: (100 + i),
                connected = (m?.connected ?: false) && !s.left,
                left = s.left || m == null || m.left,
                waiting = s.playerId in waiting,
                guessed = pub.phase == TaqPhase.QUESTION && s.playerId in guessed,
                score = s,
            )
        }.sortedBy { it.seat }
        return TaqView(
            n = env.n, phase = pub.phase, index = pub.index, total = pub.total, isFinal = pub.isFinal,
            deadline = pub.deadline, durationMs = pub.durationMs, question = pub.question,
            // Defensive: a reveal is only drawn in REVEAL (§8.1), whatever arrives.
            reveal = pub.reveal?.takeIf { pub.phase == TaqPhase.REVEAL },
            players = players, endedEarly = pub.endedEarly, over = env.over,
        )
    }

    private fun intent(type: String, extra: Map<String, JsonPrimitive> = emptyMap()) = GameIntent(
        GameIds.TAQRIBAN,
        buildJsonObject {
            put("type", JsonPrimitive(type))
            for ((k, v) in extra) put(k, v)
        },
    )

    fun hostAdvance(): GameIntent = intent("HOST_ADVANCE")

    /** Pause item "Skip question" (QUESTION, confirm); the id makes a stale menu harmless (STALE_QUESTION). */
    fun skipQuestion(questionId: String?): GameIntent =
        intent("SKIP_QUESTION", questionId?.let { mapOf("questionId" to JsonPrimitive(it)) } ?: emptyMap())

    fun endGame(): GameIntent = intent("END_GAME")
}
