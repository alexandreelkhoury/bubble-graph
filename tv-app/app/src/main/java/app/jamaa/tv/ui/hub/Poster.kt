package app.jamaa.tv.ui.hub

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.mishana.MishanaLogo
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.platform.Worlds
import app.jamaa.tv.protocol.GameCard
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.FocusKind
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.platform.Chip
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.toColor

/**
 * A game poster (DESIGN-JAMAA §2.2), 210 × 290 dp, focus scale 1.08 with the platform ring: the world stage, three
 * characters acting the game, the title lockup and the tagline. Never a lock on a game: a "Pass" chip only when billing
 * is on, the room has no Pass and the game has locked packs. No content in the room's language: dimmed to 50 % with
 * "Not available in {language} yet" (still focusable; OK opens the content-language dialog).
 */
@Composable
fun Poster(card: GameCard, room: RoomPublic, showPass: Boolean, focused: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val meta = GameCatalog.meta(card.id)
    val world = Worlds.of(meta?.world)
    JamaaFocusSurface(
        onClick = onClick,
        modifier = modifier.size(HubModel.POSTER_W_DP.dp, HubModel.POSTER_H_DP.dp),
        shape = JamaaShapes.tile,
        kind = FocusKind.Tile,
        container = world.deep.toColor(),
        focusedContainer = world.deep.toColor(),
    ) {
        Box(Modifier.fillMaxSize().alpha(if (card.available) 1f else 0.5f)) {
            Canvas(Modifier.fillMaxSize()) {
                drawRect(Brush.verticalGradient(listOf(world.stageTop.toColor(), world.deep.toColor())))
                drawRect(Brush.radialGradient(listOf(world.glow.toColor().copy(alpha = 0.28f), Color.Transparent), center = Offset(size.width / 2f, 0f), radius = size.width * 0.8f))
                drawCircle(world.accent.toColor().copy(alpha = 0.18f), size.width * 0.32f, Offset(size.width * 0.5f, size.height * 0.42f))
            }
            Column(Modifier.fillMaxSize().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(Modifier.height(36.dp))
                Row(horizontalArrangement = Arrangement.spacedBy((-6).dp), verticalAlignment = Alignment.Bottom) {
                    val cast = posterCast(card.id)
                    for ((color, expr) in cast) Character(color, 52.dp, if (focused) expr else Expression.IDLE)
                }
                Spacer(Modifier.weight(1f))
                if (card.id == GameIds.MISHANA) {
                    MishanaLogo(150.dp)
                } else {
                    Text(
                        meta?.let { keyText(it.titleKey) } ?: card.id,
                        style = JamaaTheme.type.title,
                        color = world.accentText.toColor(),
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                    )
                }
                Spacer(Modifier.height(6.dp))
                meta?.let {
                    Text(keyText(it.taglineKey), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center, maxLines = 2)
                }
            }
        }
        if (showPass && !room.premium && card.lockedPackCount > 0) {
            Chip(stringResource(R.string.hub__pass_chip), Modifier.align(Alignment.TopEnd).padding(8.dp), fill = JamaaColors.Overlay, icon = JamaaIcons.Gem)
        }
        if (!card.available) {
            Text(
                stringResource(R.string.hub__not_available, languageName(room.contentLocale)),
                style = JamaaTheme.type.caption,
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(JamaaColors.Scrim).padding(6.dp),
            )
        }
    }
}

/** DESIGN-JAMAA §2.2: three characters acting the game (public, decorative; never a player's state). */
private fun posterCast(gameId: String): List<Pair<String, Expression>> = when (gameId) {
    GameIds.MISHANA -> listOf("azure" to Expression.POINT, "lemon" to Expression.SHOCK, "jade" to Expression.POINT)
    GameIds.BLUFF -> listOf("tangerine" to Expression.THINK, "grape" to Expression.SMUG, "aqua" to Expression.THINK)
    GameIds.LIKELY -> listOf("rose" to Expression.POINT, "mint" to Expression.SHY, "sand" to Expression.POINT)
    GameIds.TRIVIA -> listOf("coral" to Expression.THINK, "lilac" to Expression.CHEER, "plum" to Expression.THINK)
    else -> listOf("coral" to Expression.IDLE, "azure" to Expression.IDLE, "lemon" to Expression.IDLE)
}
