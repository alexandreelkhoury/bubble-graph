package app.jamaa.tv.games

import app.jamaa.tv.games.bluff.BluffTv
import app.jamaa.tv.games.likely.LikelyTv
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.games.trivia.TriviaTv
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.protocol.TvGame

/**
 * A decoded active game (JAMAA-PLATFORM §2.5). Each game package defines its own implementation; there is no sealed
 * hierarchy across packages (Kotlin requires sealed subclasses in one package and module).
 */
interface GameView {
    val gameId: String
    val envelope: GameEnvelope
}

/** Why a game cannot be drawn: the "Update JAMAA to play this game" card shows instead (never a crash). */
enum class UnsupportedReason { UNKNOWN_GAME, NOT_IMPLEMENTED, DECODE_FAILED }

data class UnsupportedGameView(override val gameId: String, override val envelope: GameEnvelope, val reason: UnsupportedReason) : GameView

/** What a game package registers (one object per game, in `games/<id>/`). */
interface TvGameModule {
    val meta: TvGameMeta

    /** True once this build ships the game's TV screens; only implemented games are declared in the hello. */
    val implemented: Boolean

    /** Decodes `game.public` / `game.me`; may throw on a shape it does not know (the caller falls back). */
    fun decode(env: GameEnvelope, room: RoomPublic): GameView
}

/** gameId → decoder (P creates the four entries; each G lane replaces only its own module object). */
object GameDecoders {
    val modules: Map<String, TvGameModule> = listOf(MishanaTv, BluffTv, LikelyTv, TriviaTv).associateBy { it.meta.id }

    /** §2.5 capability negotiation: the games and per-game view versions this build renders, in registry order. */
    fun supported(): List<TvGame> =
        GameIds.ALL.mapNotNull { id -> modules[id]?.takeIf { it.implemented }?.let { TvGame(id, it.meta.viewVersion) } }

    fun isSupported(gameId: String?): Boolean = modules[gameId]?.implemented == true

    fun decode(env: GameEnvelope, room: RoomPublic): GameView {
        val module = modules[env.gameId] ?: return UnsupportedGameView(env.gameId, env, UnsupportedReason.UNKNOWN_GAME)
        if (!module.implemented) return UnsupportedGameView(env.gameId, env, UnsupportedReason.NOT_IMPLEMENTED)
        return try {
            module.decode(env, room)
        } catch (e: IllegalArgumentException) { // SerializationException extends it
            UnsupportedGameView(env.gameId, env, UnsupportedReason.DECODE_FAILED)
        } catch (e: IllegalStateException) {
            UnsupportedGameView(env.gameId, env, UnsupportedReason.DECODE_FAILED)
        }
    }
}
