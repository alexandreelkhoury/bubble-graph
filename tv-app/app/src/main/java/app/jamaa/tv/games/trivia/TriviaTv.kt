package app.jamaa.tv.games.trivia

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
 * Quiz Night on the TV (JAMAA-PLATFORM §2.12, §6.7 G4 lane C). Registered in GameDecoders/GameScreens through the P
 * stubs. The decoder joins `game.public.scores` to `room.members`; the screens live in `games/trivia/ui/`.
 */
object TriviaTv : TvGameModule {
    override val meta: TvGameMeta get() = GameCatalog.TRIVIA
    override val implemented: Boolean = true

    override fun decode(env: GameEnvelope, room: RoomPublic): TriviaGameView {
        val pub = ProtocolJson.decoder.decodeFromJsonElement(TriviaPub.serializer(), env.public)
        return TriviaGameView(env, compose(room, pub, env))
    }

    /**
     * Joins each score line to its member (a line without a member left the room: shown as left). [env] supplies the
     * instance number and `over`; `doneIds` is not used for "answered" (the game's own `answeredIds` is the source).
     */
    fun compose(room: RoomPublic, pub: TriviaPub, env: GameEnvelope): TriviaView {
        val answered = pub.answeredIds.toSet()
        val waiting = pub.waitingIds.toSet()
        val fresh = pub.newIds.toSet()
        val players = pub.scores.mapIndexed { i, s ->
            val m = room.member(s.playerId)
            TriviaPlayer(
                id = s.playerId,
                name = m?.name ?: "",
                color = m?.color ?: Constants.COLORS[i % Constants.COLORS.size].id,
                seat = m?.seat ?: (100 + i),
                connected = m?.connected ?: false,
                left = s.left || m == null || m.left,
                isHost = m?.isHost ?: false,
                score = s.score,
                scoreBefore = s.scoreBefore,
                rankBefore = s.rankBefore,
                rank = s.rank,
                streak = s.streak,
                bestStreak = s.bestStreak,
                correct = s.correct,
                fastest = s.fastest,
                answered = s.playerId in answered,
                waiting = s.playerId in waiting,
                isNew = s.playerId in fresh,
            )
        }.sortedBy { it.seat }
        return TriviaView(
            n = env.n,
            phase = pub.phase,
            quiz = pub.quiz,
            rerun = pub.rerun,
            index = pub.index,
            total = pub.total,
            isFinal = pub.isFinal,
            deadline = pub.deadline,
            durationMs = pub.durationMs,
            question = pub.question,
            options = if (pub.phase == TriviaPhase.READ) emptyList() else pub.options,
            answeredIds = pub.answeredIds,
            reveal = if (pub.phase == TriviaPhase.REVEAL) pub.reveal else null,
            players = players,
            endedEarly = pub.endedEarly,
            over = env.over,
            contentLocale = room.contentLocale,
        )
    }

    /** Trivia's setup (summary card / shelf), or null when the room's setup is another game's (or malformed). */
    fun setupView(room: RoomPublic): TriviaSetupView? {
        val setup = room.setup?.takeIf { it.gameId == GameIds.TRIVIA } ?: return null
        return try {
            TriviaSetupView(
                settings = ProtocolJson.decoder.decodeFromJsonElement(TriviaSetupSettings.serializer(), setup.settings),
                extras = ProtocolJson.decoder.decodeFromJsonElement(TriviaExtras.serializer(), setup.extras),
                premium = room.premium,
                contentLocale = room.contentLocale,
            )
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    // ---------------------------------------------------------------- intents (GAME-TRIVIA §13.1; the TV is host only)

    private fun intent(type: String, extra: Map<String, JsonPrimitive> = emptyMap()) = GameIntent(
        GameIds.TRIVIA,
        buildJsonObject {
            put("type", JsonPrimitive(type))
            for ((k, v) in extra) put(k, v)
        },
    )

    /** Pause item "Next" (QUIZ_INTRO, REVEAL, LEADERBOARD, FINAL_INTRO). */
    fun hostAdvance(): GameIntent = intent("HOST_ADVANCE")

    /** Pause item "Void this question" (REVEAL, confirm): the server schema requires the question id. */
    fun voidQuestion(questionId: String): GameIntent = intent("VOID_QUESTION", mapOf("questionId" to JsonPrimitive(questionId)))

    /** Pause item "End game" (HOLD, confirm). */
    fun endGame(): GameIntent = intent("END_GAME")

    /**
     * The full intent for a pause item of [TvGameMeta.pauseItems] in the current [view]: VOID_QUESTION needs the
     * question id that the generic `{type}` intent of the platform's pause menu lacks (JAMAA-GAP, see the lane report).
     * Null when the item cannot run now (no question on screen).
     */
    fun pauseIntent(intentType: String, view: TriviaView): GameIntent? = when (intentType) {
        "HOST_ADVANCE" -> hostAdvance()
        "END_GAME" -> endGame()
        "VOID_QUESTION" -> view.question?.id?.let(::voidQuestion)
        else -> null
    }

    /** The `UPDATE_GAME_SETTINGS` patch that picks a quiz family on the shelf. */
    fun quizPatch(familyId: String): JsonObject = JsonObject(mapOf("quizId" to JsonPrimitive(familyId)))
}
