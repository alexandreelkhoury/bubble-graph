package app.jamaa.tv.games.likely

import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameView
import app.jamaa.tv.games.TvGameMeta
import app.jamaa.tv.games.TvGameModule
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.games.UnsupportedReason
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.RoomPublic

/**
 * STUB created in milestone P (JAMAA-PLATFORM §6.1). The G3 lane C replaces this object with the real decoder of
 * `game.public` / `game.me` (GAME-LIKELY §13) and sets [implemented] once its screens exist (games/likely/**). Until then the
 * hello does not declare "likely", so the server never offers it to this TV.
 */
object LikelyTv : TvGameModule {
    override val meta: TvGameMeta get() = GameCatalog.LIKELY
    override val implemented: Boolean = false
    override fun decode(env: GameEnvelope, room: RoomPublic): GameView = UnsupportedGameView(env.gameId, env, UnsupportedReason.NOT_IMPLEMENTED)
}
