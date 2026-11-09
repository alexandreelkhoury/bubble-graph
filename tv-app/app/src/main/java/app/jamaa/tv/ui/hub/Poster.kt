package app.jamaa.tv.ui.hub

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.mishana.MishanaLogo
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.ui.theme.worldOf
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
import app.jamaa.tv.ui.theme.PosterArt
import app.jamaa.tv.ui.theme.drawWorldProps

/**
 * A game poster (DESIGN-JAMAA §2.2), 210 × 290 dp, focus scale 1.08 with the platform ring: the world stage, three
 * characters acting the game, the title lockup and the tagline. Never a lock on a game: a "Pass" chip only when billing
 * is on, the room has no Pass and the game has locked packs. No content in the room's language: dimmed to 50 % with
 * "Not available in {language} yet" (still focusable; OK opens the content-language dialog).
 */
@Composable
fun Poster(card: GameCard, room: RoomPublic, showPass: Boolean, focused: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val meta = GameCatalog.meta(card.id)
    val world = worldOf(meta?.world)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    JamaaFocusSurface(
        onClick = onClick,
        modifier = modifier.size(HubModel.POSTER_W_DP.dp, HubModel.POSTER_H_DP.dp),
        shape = JamaaShapes.tile,
        kind = FocusKind.Tile,
        container = world.deep,
        focusedContainer = world.deep,
    ) {
        Box(Modifier.fillMaxSize().alpha(if (card.available) 1f else 0.5f)) {
            // The world's props; on the focused poster they loop (one infinite transition, ≤ 4 props; still in calm motion).
            val phase = if (focused && !JamaaTheme.reduceMotion) {
                rememberInfiniteTransition(label = "posterAmbient")
                    .animateFloat(0f, 1f, infiniteRepeatable(tween(PosterArt.AMBIENT_MS, easing = LinearEasing)), label = "phase").value
            } else {
                0f
            }
            Canvas(Modifier.fillMaxSize()) {
                drawRect(Brush.verticalGradient(listOf(world.stageTop, world.deep)))
                drawRect(Brush.radialGradient(listOf(world.glow.copy(alpha = 0.28f), Color.Transparent), center = Offset(size.width / 2f, 0f), radius = size.width * 0.8f))
                drawWorldProps(meta?.world, world, phase, rtl)
            }
            Column(Modifier.fillMaxSize().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(Modifier.height(36.dp))
                Row(horizontalArrangement = Arrangement.spacedBy((-6).dp), verticalAlignment = Alignment.Bottom) {
                    // One table with web PosterArt; the outer two look at (and point toward) the middle one.
                    PosterArt.cast(card.id).forEachIndexed { i, (color, expr) ->
                        Character(
                            color,
                            if (i == 1) 60.dp else 52.dp,
                            if (focused) expr else Expression.IDLE,
                            look = Offset(PosterArt.look(i, rtl), 0f),
                        )
                    }
                }
                Spacer(Modifier.weight(1f))
                if (card.id == GameIds.MISHANA) {
                    MishanaLogo(150.dp)
                } else {
                    Text(
                        meta?.let { keyText(it.titleKey) } ?: card.id,
                        style = JamaaTheme.type.title,
                        color = world.accentText,
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
