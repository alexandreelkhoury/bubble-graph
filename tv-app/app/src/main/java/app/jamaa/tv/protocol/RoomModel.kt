@file:OptIn(ExperimentalSerializationApi::class)

package app.jamaa.tv.protocol

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// Kotlin mirror of the protocol v2 room view (JAMAA-PLATFORM §2.5, shared/src/protocol/v2/views.ts). Exact names and
// key order; S2C JSON never omits keys. Game-specific parts (`setup.settings`, `setup.extras`, `game.public`,
// `game.me`) stay raw JSON here: each game package decodes its own (GameDecoders.kt), so an unknown game never
// breaks the room view.

@Serializable enum class RoomPhase { HUB, SETUP, PLAYING }

/** §2.3 REACTIONS; every reaction is also a character expression (§3.7). Kept as a String on the wire. */
object Reactions {
    val ALL: List<String> = listOf("laugh", "shock", "facepalm", "happy", "sad", "cheer")
}

@Serializable data class MemberReaction(val kind: String, val n: Int)

@Serializable data class MemberPublic(
    val id: String,
    val name: String,
    val color: String,
    val seat: Int,
    val connected: Boolean,
    val left: Boolean,
    val benched: Boolean,
    val isHost: Boolean,
    val reaction: MemberReaction?,
)

/** One hub card per game of `room.games` (GAME_IDS order, only games this TV declared and the Worker enabled). */
@Serializable data class GameCard(
    val id: String,
    val minPlayers: Int,
    val maxPlayers: Int,
    /** Content exists in `contentLocale`. */
    val available: Boolean,
    val lockedPackCount: Int,
    val durationMinutes: List<Int>,
)

/** §2.5 PackInfo v2. `tier` ∈ free | premium | mixed; `pairCount` = the items the game's filters keep. */
@Serializable data class PackInfo(
    val id: String,
    val gameId: String,
    val family: String,
    val locale: String,
    val title: LocalizedTitle,
    val pairCount: Int,
    val ageRating: String,
    val tier: String,
    val stars: Int?,
    val domain: String?,
    val topics: List<String>,
)

/** §2.5 LockedPackInfo v2: metadata only (never items). `productId` = pack_<family>. */
@Serializable data class LockedPackInfo(
    val id: String,
    val gameId: String,
    val family: String,
    val locale: String,
    val title: LocalizedTitle,
    val pairCount: Int,
    val ageRating: String,
    val productId: String,
    val stars: Int?,
    val domain: String?,
    val topics: List<String>,
)

/** SETUP only. `settings` and `extras` are that game's shapes (decoded by its package). */
@Serializable data class RoomSetup(
    val gameId: String,
    val settings: JsonObject,
    val canStart: Boolean,
    val startBlocker: String?,
    val availablePacks: List<PackInfo>,
    val lockedPacks: List<LockedPackInfo>,
    val extras: JsonObject,
)

@Serializable data class CupLast(val gameId: String, val n: Int, val ranking: List<List<String>>, val points: Map<String, Int>)

@Serializable data class CupPublic(val stars: Map<String, Int>, val last: CupLast?)

@Serializable data class RoomPublic(
    val roomCode: String,
    val joinUrl: String,
    val phase: RoomPhase,
    val focusedGameId: String,
    val setupGameId: String?,
    val contentLocale: String,
    val members: List<MemberPublic>,
    val hostPlayerId: String?,
    val games: List<GameCard>,
    val setup: RoomSetup?,
    val cup: CupPublic,
    val premium: Boolean,
    val tvBusy: Boolean,
    val contentLocales: List<String>,
)

/**
 * The active game instance (PLAYING only). `phase`, `doneIds` and `awaitedIds` come from the game's `projectStatus`:
 * the only fields generic platform chrome (rules highlight, characters' done/think) may read.
 */
@Serializable data class GameEnvelope(
    val gameId: String,
    val n: Int,
    val phase: String,
    val doneIds: List<String>,
    val awaitedIds: List<String>,
    val public: JsonObject,
    val me: JsonObject?,
    val over: Boolean,
)

@Serializable data class RoomMe(val id: String, val benched: Boolean)

/** `state.view`. The TV always gets `kind: "tv"` and `me: null`. */
@Serializable data class RoomView(
    val kind: String,
    val room: RoomPublic,
    val game: GameEnvelope?,
    val me: RoomMe?,
)

/** A member by id. */
fun RoomPublic.member(id: String?): MemberPublic? = if (id == null) null else members.firstOrNull { it.id == id }

/** Members who are in the room right now (left ones linger only until the game ends). */
val RoomPublic.present: List<MemberPublic> get() = members.filter { !it.left }

/** "Between games": HUB, SETUP, or a game that reached its outcome (the Store and a silent room re-create are allowed). */
val RoomView.betweenGames: Boolean
    get() = room.phase != RoomPhase.PLAYING || game?.over == true
