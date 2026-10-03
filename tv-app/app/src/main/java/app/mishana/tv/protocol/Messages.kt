@file:OptIn(ExperimentalSerializationApi::class)

package app.mishana.tv.protocol

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

// SPEC §6.2/§6.3/§9.5. Ping/pong are byte-exact constant strings and are never serialised (Constants.PING_FRAME).

@Serializable @JsonClassDiscriminator("t") sealed class ServerMessage
@Serializable @SerialName("welcome") data class WelcomeMsg(val v: Int = 1, val playerId: String, val resumeToken: String, val roomCode: String) : ServerMessage()
@Serializable @SerialName("state") data class StateMsg(val v: Int = 1, val seq: Long, val serverNow: Long, val view: TvView) : ServerMessage()
@Serializable @SerialName("error") data class ErrorMsg(val v: Int = 1, val code: String, val messageKey: String, val ref: String?) : ServerMessage()
@Serializable @SerialName("pong") data class PongMsg(val v: Int = 1) : ServerMessage()

@Serializable @JsonClassDiscriminator("t") sealed class ClientMessage
@Serializable @SerialName("hello") data class HelloTv(val v: Int = 1, val role: String = "tv", val tvToken: String) : ClientMessage()
@Serializable @SerialName("action") data class ActionMsg(val v: Int = 1, val id: String? = null, val a: ClientIntent) : ClientMessage()

@Serializable @JsonClassDiscriminator("type") sealed class ClientIntent
@Serializable @SerialName("UPDATE_SETTINGS") data class UpdateSettings(val patch: SettingsPatch) : ClientIntent()
@Serializable @SerialName("START") data object Start : ClientIntent()
@Serializable @SerialName("HOST_ADVANCE") data object HostAdvance : ClientIntent()
@Serializable @SerialName("HOST_OVERRIDE_GUESS") data class HostOverrideGuess(val accept: Boolean) : ClientIntent()
@Serializable @SerialName("KICK") data class Kick(val playerId: String) : ClientIntent()
@Serializable @SerialName("PLAY_AGAIN") data object PlayAgain : ClientIntent()
@Serializable @SerialName("BACK_TO_LOBBY") data object BackToLobby : ClientIntent()
// TV never sends READY / CLUE_DONE / CAST_VOTE / SUBMIT_GUESS / LEAVE.

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

@Serializable data class CreateRoomRequest(val locale: String)
@Serializable data class CreateRoomResponse(val code: String, val tvToken: String, val joinUrl: String, val wsPath: String)
