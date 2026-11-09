package app.jamaa.tv.games.bluff

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
 * Bluff! on the TV (JAMAA-PLATFORM §2.10, §6.5 G2 lane C). Registered in GameDecoders/GameScreens through the P stubs.
 * The decoder joins `game.public.scores` to `room.members`; the screens live in `games/bluff/ui/`, the pure reveal
 * script and phase moments in [BluffScript] / [BluffMoments] (JVM-tested against lane A's fixtures).
 */
object BluffTv : TvGameModule {
    override val meta: TvGameMeta get() = GameCatalog.BLUFF
    override val implemented: Boolean = true

    override fun decode(env: GameEnvelope, room: RoomPublic): BluffGameView {
        val pub = ProtocolJson.decoder.decodeFromJsonElement(BluffPub.serializer(), env.public)
        return BluffGameView(env, compose(room, pub, env))
    }

    /** VOTING onwards the anonymous option cards exist; before that a frame carrying any is ignored (secrecy guard). */
    private val OPTION_PHASES = setOf(BluffPhase.VOTING, BluffPhase.REVEAL, BluffPhase.SCORES)

    /** The reveal script is drawn in REVEAL and its numbers reused by the SCORES race. */
    private val REVEAL_PHASES = setOf(BluffPhase.REVEAL, BluffPhase.SCORES)

    /**
     * Joins each score line to its member (a line without a member left the room: shown as left). Players are in seat
     * order (the café row never reshuffles). [env] supplies the instance number and `over`.
     */
    fun compose(room: RoomPublic, pub: BluffPub, env: GameEnvelope): BluffView {
        val submitted = pub.submittedIds.toSet()
        val voted = pub.votedIds.toSet()
        val spotOn = pub.spotOnIds.toSet()
        val fresh = pub.newIds.toSet()
        val players = pub.scores.mapIndexed { i, s ->
            val m = room.member(s.playerId)
            BluffPlayer(
                id = s.playerId,
                name = m?.name ?: "",
                color = m?.color ?: Constants.COLORS[i % Constants.COLORS.size].id,
                seat = m?.seat ?: (100 + i),
                connected = m?.connected ?: false,
                left = m == null || m.left,
                isHost = m?.isHost ?: false,
                score = s.score,
                scoreBefore = s.scoreBefore,
                submitted = pub.phase == BluffPhase.WRITING && s.playerId in submitted,
                voted = pub.phase == BluffPhase.VOTING && s.playerId in voted,
                spotOn = s.playerId in spotOn,
                isNew = s.playerId in fresh,
            )
        }.sortedBy { it.seat }
        return BluffView(
            n = env.n,
            phase = pub.phase,
            round = pub.round,
            roundCount = pub.roundCount,
            roundKind = pub.roundKind,
            promptIndex = pub.promptIndex,
            promptCount = pub.promptCount,
            multiplier = pub.multiplier,
            deadline = pub.deadline,
            prompt = pub.prompt,
            options = if (pub.phase in OPTION_PHASES) pub.options else emptyList(),
            voided = pub.voided,
            notice = pub.notice,
            reveal = if (pub.phase in REVEAL_PHASES) pub.reveal else null,
            players = players,
            awards = if (pub.phase == BluffPhase.AWARDS || pub.phase == BluffPhase.RESULTS) pub.awards else emptyList(),
            skipsLeft = pub.skipsLeft,
            hidesLeft = pub.hidesLeft,
            over = env.over,
            contentLocale = room.contentLocale,
        )
    }

    /** Bluff's setup (the Length-row "Big group" hint), or null when the room's setup is another game's (or malformed). */
    fun setupView(room: RoomPublic): BluffSetupView? {
        val setup = room.setup?.takeIf { it.gameId == GameIds.BLUFF } ?: return null
        return try {
            BluffSetupView(
                settings = ProtocolJson.decoder.decodeFromJsonElement(BluffSetupSettings.serializer(), setup.settings),
                extras = ProtocolJson.decoder.decodeFromJsonElement(BluffExtras.serializer(), setup.extras),
            )
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    // ---------------------------------------------------------------- intents (GAME-BLUFF §13.1; the TV is host only)

    private fun intent(type: String, extra: Map<String, Any> = emptyMap()) = GameIntent(
        GameIds.BLUFF,
        buildJsonObject {
            put("type", JsonPrimitive(type))
            for ((k, v) in extra) put(k, if (v is Boolean) JsonPrimitive(v) else JsonPrimitive(v.toString()))
        },
    )

    /** Pause item "Next" (ROUND_INTRO, REVEAL, SCORES, AWARDS; ignored by the server in WRITING and VOTING). */
    fun hostAdvance(): GameIntent = intent("HOST_ADVANCE")

    /** Pause item "End game" (HOLD, confirm). */
    fun endGame(): GameIntent = intent("END_GAME")

    /** Pause item "Skip prompt" (WRITING): the server needs the prompt id (`STALE_PROMPT` guard). */
    fun skipPrompt(promptId: String): GameIntent = intent("SKIP_PROMPT", mapOf("promptId" to promptId))

    /** Pause item "Hide an answer" (VOTING), after the host picked a card in [HidePicker]. */
    fun hideOption(optionId: String): GameIntent = intent("HIDE_OPTION", mapOf("optionId" to optionId))

    /** What a pause item does on the TV (the platform's generic `{type}` intent lacks Bluff's ids, see [pauseAction]). */
    sealed interface PauseAction {
        data class Send(val intent: GameIntent) : PauseAction
        /** "Hide an answer": open the card picker ([HidePicker]); its OK sends [hideOption]. */
        data object PickOptionToHide : PauseAction
        /** Cannot run now (wrong phase, no prompt, nothing left to hide/skip): the item is shown disabled. */
        data object Unavailable : PauseAction
    }

    /**
     * The full action for a pause item of [TvGameMeta.pauseItems] in the current [view]. SKIP_PROMPT needs the prompt
     * id and HIDE_OPTION needs a picked card, which the platform's generic pause path (`{type}` only) cannot send:
     * JAMAA-GAP, the platform must route Bluff's items here (see the G2 lane C report).
     */
    fun pauseAction(intentType: String, view: BluffView): PauseAction = when (intentType) {
        "HOST_ADVANCE" -> if (view.phase in ADVANCE_PHASES) PauseAction.Send(hostAdvance()) else PauseAction.Unavailable
        "END_GAME" -> if (view.phase == BluffPhase.HOLD) PauseAction.Send(endGame()) else PauseAction.Unavailable
        "SKIP_PROMPT" -> view.prompt?.takeIf { view.phase == BluffPhase.WRITING && view.skipsLeft > 0 }
            ?.let { PauseAction.Send(skipPrompt(it.id)) } ?: PauseAction.Unavailable
        "HIDE_OPTION" -> if (view.phase == BluffPhase.VOTING && view.hidesLeft > 0 && view.options.size > 2) PauseAction.PickOptionToHide else PauseAction.Unavailable
        else -> PauseAction.Unavailable
    }

    private val ADVANCE_PHASES = setOf(BluffPhase.ROUND_INTRO, BluffPhase.REVEAL, BluffPhase.SCORES, BluffPhase.AWARDS)
}
