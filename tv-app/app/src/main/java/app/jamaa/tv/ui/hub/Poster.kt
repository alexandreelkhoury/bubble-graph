package app.jamaa.tv.ui.hub

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.mishana.MishanaLogo
import app.jamaa.tv.games.mishana.MishanaLogoVariant
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.ui.theme.worldOf
import app.jamaa.tv.protocol.GameCard
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.FitText
import app.jamaa.tv.ui.components.FocusKind
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PosterArt
import app.jamaa.tv.ui.theme.drawWorldProps
import kotlinx.coroutines.flow.collectLatest

/**
 * A game poster (DESIGN-JAMAA §2.2), 140 × 194 dp, focus scale 1.06 (FocusKind.Tile) with the platform ring: the world
 * stage and its props, three characters on a ground line at ~55 % and a one-line title lockup in a fixed 112 × 48 box.
 * The tagline lives in the hub's info block, not on the poster. Never a lock on a game: a "Pass" chip only when billing
 * is on, the room has no Pass and the game has locked packs. No content in the room's language: dimmed to 50 % with a
 * "No {language} yet" chip (still focusable; OK opens the content-language dialog).
 */
@Composable
fun Poster(card: GameCard, room: RoomPublic, showPass: Boolean, focused: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val meta = GameCatalog.meta(card.id)
    val world = worldOf(meta?.world)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    // Ambient props: the loop's speed eases 0 ↔ 1 over 300 ms, so props slow down and rest where they are when focus
    // leaves (no snap back to phase 0). The phase is read in the draw pass only (no recomposition per frame).
    val amplitude by animateFloatAsState(
        if (focused && !JamaaTheme.reduceMotion) 1f else 0f,
        tween(300, easing = JamaaMotion.Standard),
        label = "posterAmbient",
    )
    val phase = remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        snapshotFlow { amplitude > 0f }.collectLatest { moving ->
            if (!moving) return@collectLatest
            var last = -1L
            while (true) {
                withFrameMillis { t ->
                    if (last >= 0) phase.floatValue = (phase.floatValue + (t - last) * amplitude / PosterArt.AMBIENT_MS) % 1f
                    last = t
                }
            }
        }
    }
    JamaaFocusSurface(
        onClick = onClick,
        // requiredSize: a poster never gets squashed by its row (the scrolling fallback measures it unbounded).
        modifier = modifier.requiredSize(HubModel.POSTER_W_DP.dp, HubModel.POSTER_H_DP.dp),
        shape = JamaaShapes.tile,
        kind = FocusKind.Tile,
        container = world.deep,
        focusedContainer = world.deep,
    ) {
        Box(Modifier.fillMaxSize().alpha(if (card.available) 1f else 0.5f)) {
            Canvas(Modifier.fillMaxSize()) {
                drawRect(Brush.verticalGradient(listOf(world.stageTop, world.deep)))
                drawRect(Brush.radialGradient(listOf(world.glow.copy(alpha = 0.28f), Color.Transparent), center = Offset(size.width / 2f, 0f), radius = size.width * 0.8f))
                drawWorldProps(meta?.world, world, phase.floatValue, rtl)
            }
            // The cast stands on a ground line at ~55 % of the height (bottom of the row at y 107 of 194).
            Row(
                Modifier.align(Alignment.TopCenter).offset(y = POSTER_GROUND - CAST_MIDDLE),
                horizontalArrangement = Arrangement.spacedBy((-6).dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                // One table with web PosterArt; the outer two look at (and point toward) the middle one.
                PosterArt.cast(card.id).forEachIndexed { i, (color, expr) ->
                    Character(
                        color,
                        if (i == 1) CAST_MIDDLE else CAST_SIDE,
                        if (focused) expr else Expression.IDLE,
                        look = Offset(PosterArt.look(i, rtl), 0f),
                    )
                }
            }
            // The title lockup: one line in a fixed box, so every poster's title sits at the same place.
            Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp).size(TITLE_W, TITLE_H), contentAlignment = Alignment.Center) {
                if (card.id == GameIds.MISHANA) {
                    // §2.2 Title: the lockup in the content locale's script.
                    MishanaLogo(TITLE_W, Modifier.fitInside(), variant = if (room.contentLocale == "ar") MishanaLogoVariant.Arabic else MishanaLogoVariant.Latin)
                } else {
                    FitText(
                        meta?.let { keyText(it.titleKey) } ?: card.id,
                        style = JamaaTheme.type.title.copy(lineHeight = 1.2.em),
                        color = world.accentText,
                        maxSize = 26.dp,
                        minSize = 20.dp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        if (showPass && !room.premium && card.lockedPackCount > 0) {
            HubChip(stringResource(R.string.hub__pass_chip), Modifier.align(Alignment.TopEnd).padding(6.dp), icon = JamaaIcons.Gem)
        }
        if (!card.available) {
            // Top-start, under the Pass chip when both show: never over the title.
            val top = if (showPass && !room.premium && card.lockedPackCount > 0) 6.dp + HubChipHeight + 4.dp else 6.dp
            HubChip(
                stringResource(R.string.hub__no_language_yet, languageName(room.contentLocale)),
                Modifier.align(Alignment.TopStart).padding(start = 6.dp, top = top).widthIn(max = HubModel.POSTER_W_DP.dp - 12.dp),
                ink = JamaaColors.Text,
            )
        }
    }
}

private val POSTER_GROUND = 107.dp
private val CAST_SIDE = 40.dp
private val CAST_MIDDLE = 46.dp
private val TITLE_W = 112.dp
private val TITLE_H = 48.dp

internal val HubChipHeight: Dp = 28.dp

/** A 28 dp pill (Overlay fill) for the poster badges and the info block's language chip. Never focusable. */
@Composable
internal fun HubChip(text: String, modifier: Modifier = Modifier, fill: Color = JamaaColors.Overlay, ink: Color = JamaaColors.TextSecondary, icon: ImageVector? = null) {
    Row(
        modifier.height(HubChipHeight).background(fill, JamaaShapes.pill).padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = ink, modifier = Modifier.size(18.dp))
        Text(text, style = JamaaTheme.type.caption.copy(lineHeight = 1.2.em), color = ink, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
    }
}

/** Measures the child at its natural size and scales it down (never up) to fit this node's bounds, centred. */
private fun Modifier.fitInside(): Modifier = layout { measurable, constraints ->
    val p = measurable.measure(Constraints())
    val w = if (constraints.hasBoundedWidth) constraints.maxWidth else p.width
    val h = if (constraints.hasBoundedHeight) constraints.maxHeight else p.height
    val k = minOf(1f, w.toFloat() / p.width.coerceAtLeast(1), h.toFloat() / p.height.coerceAtLeast(1))
    layout(w, h) {
        p.placeWithLayer((w - p.width) / 2, (h - p.height) / 2) {
            scaleX = k
            scaleY = k
        }
    }
}
