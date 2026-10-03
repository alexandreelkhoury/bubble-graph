package app.mishana.tv.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import app.mishana.tv.game.Names
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.Role
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import app.mishana.tv.ui.theme.PlayerSwatch

/** Mixes [this] toward its own luminance grey by [amount] (0 = unchanged, 1 = grey). */
fun Color.desaturate(amount: Float): Color {
    val l = 0.2126f * red + 0.7152f * green + 0.0722f * blue
    return lerp(this, Color(l, l, l, alpha), amount.coerceIn(0f, 1f))
}

/** Avatar states (DESIGN §5.2). Away wins over ready. */
data class AvatarState(
    val away: Boolean = false,
    val check: Boolean = false,
    val host: Boolean = false,
    val eliminated: Boolean = false,
    val left: Boolean = false,
    val speaking: Boolean = false,
    val role: Role? = null,
) {
    companion object {
        fun of(p: PublicPlayer, check: Boolean = false, showHost: Boolean = true, speaking: Boolean = false) = AvatarState(
            away = !p.connected && !p.left,
            check = check,
            host = showHost && p.isHost,
            eliminated = !p.alive,
            left = p.left,
            speaking = speaking,
            role = p.revealedRole,
        )
    }
}

/**
 * Geometric avatar: a squircle in the player colour with the paired shape glyph at 62 % (DESIGN §5.2).
 * Corner badges carry a 2 dp `bg` ring so they separate from any tile colour.
 */
@Composable
fun Avatar(
    colorId: String,
    size: Dp,
    modifier: Modifier = Modifier,
    state: AvatarState = AvatarState(),
) {
    val swatch = PlayerSwatch.byId(colorId)
    val reduce = MishTheme.reduceMotion
    val out = state.eliminated || state.left
    val fill = when {
        out -> swatch.color.desaturate(1f)
        state.away -> swatch.color.desaturate(0.8f)
        else -> swatch.color
    }
    val glyph = if (out) swatch.glyph.desaturate(1f) else swatch.glyph
    val bodyAlpha = when {
        out -> 0.45f
        state.away -> 0.6f
        else -> 1f
    }
    val breathe = if (state.speaking && !reduce) {
        val t = rememberInfiniteTransition(label = "breathe")
        t.animateFloat(1f, 1.03f, infiniteRepeatable(tween(800, easing = MishMotion.Standard), RepeatMode.Reverse), label = "b").value
    } else {
        1f
    }
    val shape = RoundedCornerShape(percent = 30)
    val badge = (size * 0.36f).coerceIn(18.dp, 30.dp)
    Box(modifier.size(size)) {
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer { scaleX = breathe; scaleY = breathe }
                .then(
                    if (state.speaking) {
                        Modifier
                            .shadow(18.dp, shape, ambientColor = MishColors.Primary, spotColor = MishColors.Primary)
                            .border(BorderStroke(4.dp, MishColors.Primary), shape)
                    } else {
                        Modifier
                    },
                )
                .alpha(bodyAlpha)
                .background(fill, shape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AvatarGlyphs.of(swatch.shape),
                contentDescription = null,
                tint = glyph,
                modifier = Modifier.size(size * 0.62f),
            )
        }
        // top-start: host crown
        if (state.host && !out) {
            CornerBadge(MishIcons.Crown, MishColors.Accent, MishColors.Ink, badge, Alignment.TopStart)
        }
        // top-end: away > left > check
        when {
            state.left -> CornerBadge(MishIcons.DoorOut, MishColors.TextMuted, MishColors.Ink, badge, Alignment.TopEnd)
            state.away -> CornerBadge(MishIcons.WifiOff, MishColors.Danger, MishColors.Ink, badge, Alignment.TopEnd)
            state.check && !out -> PopBadge(MishIcons.Check, MishColors.Success, MishColors.Ink, badge, Alignment.TopEnd)
        }
        // bottom-end: role emblem once a role is public (eliminated or left)
        val role = state.role
        if (out && role != null) {
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = badge / 3, y = badge / 3)
                    .size(badge * 1.25f)
                    .background(MishColors.Bg, CircleShape)
                    .padding(2.dp)
                    .background(roleColor(role), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                RoleEmblem(role, size = badge * 0.8f, color = MishColors.Ink)
            }
        }
    }
}

@Composable
private fun BoxScope.CornerBadge(
    icon: ImageVector,
    disc: Color,
    ink: Color,
    size: Dp,
    align: Alignment,
    extra: Modifier = Modifier,
) {
    val dx = if (align == Alignment.TopStart) -size / 3 else size / 3
    Box(
        Modifier
            .align(align)
            .offset(x = dx, y = -size / 3)
            .then(extra)
            .size(size)
            .background(MishColors.Bg, CircleShape)
            .padding(2.dp)
            .background(disc, CircleShape)
            .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = ink, modifier = Modifier.size(size * 0.62f))
    }
}

/** Ready/voted check pops in with `ease.overshoot` (static in reduced motion). */
@Composable
private fun BoxScope.PopBadge(icon: ImageVector, disc: Color, ink: Color, size: Dp, align: Alignment) {
    val reduce = MishTheme.reduceMotion
    val scale = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduce) scale.animateTo(1f, tween(MishMotion.Base, easing = MishMotion.Overshoot))
    }
    CornerBadge(icon, disc, ink, size, align, Modifier.graphicsLayer { scaleX = scale.value; scaleY = scale.value })
}

/** Card/tile with avatar + name (DESIGN §9 `PlayerTile`). Focusable only when [onClick] is given (lobby kick, players list). */
@Composable
fun PlayerTile(
    player: PublicPlayer,
    width: Dp,
    height: Dp,
    avatarSize: Dp,
    modifier: Modifier = Modifier,
    state: AvatarState = AvatarState.of(player),
    onClick: (() -> Unit)? = null,
    nameMax: Int = 12,
    contentAlpha: Float = 1f,
    nameOverride: (@Composable () -> Unit)? = null,
) {
    val swatch = PlayerSwatch.byId(player.color)
    val shape = RoundedCornerShape(MishThemeRadius.tile)
    val a11y = buildString {
        append(player.name)
        if (player.isHost) append(", host")
        if (!player.connected) append(", away")
        if (state.check) append(", ready")
    }
    val content: @Composable BoxScope.() -> Unit = {
        Column(
            Modifier
                .fillMaxSize()
                .padding(top = 10.dp, bottom = 6.dp, start = 6.dp, end = 6.dp)
                .alpha(contentAlpha),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Avatar(player.color, avatarSize, state = state)
            if (nameOverride != null) {
                nameOverride()
            } else {
                Text(
                    text = Names.ellipsize(player.name, nameMax),
                    style = if (height < 104.dp) MishTheme.type.titleS else MishTheme.type.title,
                    color = MishColors.Text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
    val ring = if (swatch.needsRingOnElevated) MishColors.Text.copy(alpha = 0.24f) else Color.Transparent
    if (onClick != null) {
        Surface(
            onClick = onClick,
            modifier = modifier.size(width, height).semantics { contentDescription = a11y },
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = MishColors.Surface,
                contentColor = MishColors.Text,
                focusedContainerColor = MishColors.Elevated,
                focusedContentColor = MishColors.Text,
                pressedContainerColor = MishColors.Elevated,
                pressedContentColor = MishColors.Text,
            ),
            scale = MishFocus.tileScale(),
            border = MishFocus.border(shape, rest = androidx.tv.material3.Border(BorderStroke(2.dp, ring), shape = shape)),
            glow = MishFocus.glow(),
            content = content,
        )
    } else {
        Box(
            modifier
                .size(width, height)
                .background(MishColors.Surface, shape)
                .border(BorderStroke(1.dp, MishColors.Text.copy(alpha = 0.06f)), shape)
                .semantics { contentDescription = a11y },
            content = content,
        )
    }
}

/** Radii used by tiles (DESIGN §4.4: tiles and cards use `lg` on TV). */
object MishThemeRadius {
    val tile = 24.dp
}
