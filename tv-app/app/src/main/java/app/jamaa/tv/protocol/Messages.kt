@file:OptIn(ExperimentalSerializationApi::class)

package app.jamaa.tv.protocol

import app.jamaa.tv.Constants
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonObject

// SPEC §6.2/§6.3/§9.5 with the protocol v2 envelope (JAMAA-PLATFORM §2.5). Ping/pong are byte-exact constant strings
// and are never serialised (Constants.PING_FRAME).

@Serializable @JsonClassDiscriminator("t") sealed class ServerMessage
@Serializable @SerialName("welcome") data class WelcomeMsg(val v: Int = Constants.PROTOCOL_VERSION, val playerId: String, val resumeToken: String, val roomCode: String) : ServerMessage()
@Serializable @SerialName("state") data class StateMsg(val v: Int = Constants.PROTOCOL_VERSION, val seq: Long, val serverNow: Long, val view: RoomView) : ServerMessage()
@Serializable @SerialName("error") data class ErrorMsg(val v: Int = Constants.PROTOCOL_VERSION, val code: String, val messageKey: String, val ref: String?) : ServerMessage()
@Serializable @SerialName("pong") data class PongMsg(val v: Int = Constants.PROTOCOL_VERSION) : ServerMessage()

@Serializable @JsonClassDiscriminator("t") sealed class ClientMessage

/** §2.5 capability negotiation: one game this TV build renders, with the `VIEW_VERSION` it implements. */
@Serializable data class TvGame(val id: String, val v: Int)

/** The TV hello: `games` (1–4 unique ids) is required in v2 (GameDecoders.supported()). */
@Serializable @SerialName("hello") data class HelloTv(
    val v: Int = Constants.PROTOCOL_VERSION,
    val role: String = "tv",
    val tvToken: String,
    val games: List<TvGame>,
) : ClientMessage()
@Serializable @SerialName("action") data class ActionMsg(val v: Int = Constants.PROTOCOL_VERSION, val id: String? = null, val a: ClientIntent) : ClientMessage()

/** §2.5 room intents the TV sends (it never sends REACT or LEAVE). In-game intents travel inside [GameIntent]. */
@Serializable @JsonClassDiscriminator("type") sealed class ClientIntent
@Serializable @SerialName("HUB_FOCUS") data class HubFocus(val gameId: String) : ClientIntent()
@Serializable @SerialName("OPEN_GAME") data class OpenGame(val gameId: String) : ClientIntent()
@Serializable @SerialName("CLOSE_GAME") data object CloseGame : ClientIntent()
@Serializable @SerialName("SET_CONTENT_LOCALE") data class SetContentLocale(val locale: String) : ClientIntent()
/** `patch` is that game's settings patch (strict on the server); built by the game's package. */
@Serializable @SerialName("UPDATE_GAME_SETTINGS") data class UpdateGameSettings(val gameId: String, val patch: JsonObject) : ClientIntent()
@Serializable @SerialName("START_GAME") data object StartGame : ClientIntent()
/** `GAME {gameId, i}`: `i` is the game's own intent object (e.g. `{"type":"HOST_ADVANCE"}`). */
@Serializable @SerialName("GAME") data class GameIntent(val gameId: String, val i: JsonObject) : ClientIntent()
@Serializable @SerialName("REPLAY") data object Replay : ClientIntent()
@Serializable @SerialName("BACK_TO_SETUP") data object BackToSetup : ClientIntent()
@Serializable @SerialName("BACK_TO_HUB") data object BackToHub : ClientIntent()
@Serializable @SerialName("ABORT_GAME") data object AbortGame : ClientIntent()
@Serializable @SerialName("KICK") data class Kick(val playerId: String) : ClientIntent()

/**
 * Mish Ana!'s settings as the TV edits them (the v1 `UPDATE_SETTINGS` patch). `wordLocale` is the room's content
 * language in v2: the ViewModel sends it as `SET_CONTENT_LOCALE` and the rest as `UPDATE_GAME_SETTINGS`.
 */
@Serializable data class SettingsPatch(
    val winRule: WinRule? = null,
    val revealRoles: Boolean? = null,
    val roleMode: RoleMode? = null,
    val undercoverCount: Int? = null,
    val blankCount: Int? = null,
    val clueSeconds: Int? = null,
    val voteSeconds: Int? = null,
    val revealSeconds: Int? = null,
    val guessSeconds: Int? = null,
    val tieBreak: TieBreak? = null,
    val blankGuess: Boolean? = null,
    val wordLocale: String? = null,
    val packIds: List<String>? = null,
    val difficulties: List<Int>? = null,
    val familyFilter: Boolean? = null,
    val swapSides: Boolean? = null,
    val points: Points? = null,
)

/** PAYMENTS-SPEC §4.3: `entitlement` is the stored token (omitted when null: the encoder drops nulls). */
@Serializable data class CreateRoomRequest(val locale: String, val entitlement: String? = null)

/** PAYMENTS-SPEC §3.11: `entitlement` ∈ NONE | OK | INVALID (null from a pre-billing server). */
@Serializable data class CreateRoomResponse(
    val code: String,
    val tvToken: String,
    val joinUrl: String,
    val wsPath: String,
    val entitlement: String? = null,
)
