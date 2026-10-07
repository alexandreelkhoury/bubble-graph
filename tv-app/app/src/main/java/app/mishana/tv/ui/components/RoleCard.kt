package app.mishana.tv.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.protocol.Role
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme
import app.mishana.tv.ui.theme.PlayerSwatch

fun roleColor(role: Role): Color = when (role) {
    Role.CIVILIAN -> MishColors.Civilian
    Role.UNDERCOVER -> MishColors.Undercover
    Role.BLANK -> MishColors.Blank
}

/** Role emblem silhouettes (DESIGN §5.3): house, domino mask, and the dashed empty card. */
@Composable
fun RoleEmblem(role: Role, size: Dp, color: Color, modifier: Modifier = Modifier) {
    when (role) {
        Role.CIVILIAN -> Icon(RoleEmblems.House, contentDescription = null, tint = color, modifier = modifier.size(size))
        Role.UNDERCOVER -> Icon(RoleEmblems.Mask, contentDescription = null, tint = color, modifier = modifier.size(size))
        Role.BLANK -> Canvas(modifier.size(size)) {
            val u = this.size.minDimension / 48f
            drawRoundRect(
                color = color,
                topLeft = Offset(9f * u, 5f * u),
                size = Size(30f * u, 38f * u),
                cornerRadius = CornerRadius(5f * u, 5f * u),
                style = Stroke(width = 3f * u, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f * u, 5f * u))),
            )
        }
    }
}

/** Card patterns: Undercover = 45° stripes (6 dp, 12 % lighter); Mole (BLANK) = 4 dp dot grid (10 % darker); Civilian = solid. */
@Composable
fun RolePattern(role: Role, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        when (role) {
            Role.CIVILIAN -> Unit
            Role.UNDERCOVER -> {
                val step = 12.dp.toPx()
                val w = 6.dp.toPx()
                val stripe = Color.White.copy(alpha = 0.12f)
                clipRect {
                    var x = -size.height
                    while (x < size.width) {
                        drawLine(stripe, Offset(x, size.height), Offset(x + size.height, 0f), strokeWidth = w)
                        x += step
                    }
                }
            }
            Role.BLANK -> {
                val step = 8.dp.toPx()
                val r = 1.6.dp.toPx()
                val dot = Color.Black.copy(alpha = 0.10f)
                var y = step / 2
                while (y < size.height) {
                    var x = step / 2
                    while (x < size.width) {
                        drawCircle(dot, r, Offset(x, y))
                        x += step
                    }
                    y += step
                }
            }
        }
    }
}

/** Face-up role card: role colour + pattern + emblem + label in ink (DESIGN §6.2-C step 3). */
@Composable
fun RoleCardFace(role: Role, label: String, modifier: Modifier = Modifier, emblemSize: Dp = 120.dp) {
    val shape = MishShapes.card
    Box(modifier.clip(shape).background(roleColor(role), shape)) {
        RolePattern(role, Modifier.fillMaxSize())
        Column(
            Modifier.fillMaxSize().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            RoleEmblem(role, emblemSize, MishColors.Ink)
            Spacer(Modifier.height(16.dp))
            Text(
                text = label,
                style = MishTheme.type.displayM.copy(fontSize = MishTheme.type.headline.fontSize, lineHeight = MishTheme.type.headline.lineHeight),
                color = MishColors.Ink,
                textAlign = TextAlign.Center,
                maxLines = 2,
            )
        }
    }
}

/** Face-down card: the player colour with the shape glyph (DESIGN §6.2-C step 3, back face). */
@Composable
fun RoleCardBack(colorId: String, modifier: Modifier = Modifier) {
    val swatch = PlayerSwatch.byId(colorId)
    val shape = MishShapes.card
    Box(modifier.clip(shape).background(swatch.color, shape), contentAlignment = Alignment.Center) {
        Icon(AvatarGlyphs.of(swatch.shape), contentDescription = null, tint = swatch.glyph, modifier = Modifier.size(150.dp))
    }
}
