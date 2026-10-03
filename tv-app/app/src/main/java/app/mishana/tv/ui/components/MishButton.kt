package app.mishana.tv.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceBorder
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ClickableSurfaceGlow
import androidx.tv.material3.ClickableSurfaceScale
import androidx.tv.material3.Glow
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

/**
 * The one TV focus style (DESIGN §4.6): scale 1.06 (tiles) / 1.04 (buttons, rows), a 3 dp cream ring 2 dp
 * outside the shape, a primary glow at 45 %, and the fill lifting to `elevated`.
 * tv-material 1.1.0 draws `Border.inset` outward (`inset(-border.inset)`), so +2 dp = "offset 2 dp outside".
 */
object MishFocus {
    const val TILE_SCALE = 1.06f
    const val BUTTON_SCALE = 1.04f
    val Pill: Shape = RoundedCornerShape(percent = 50)

    @Composable
    fun border(shape: Shape, ring: Color = MishColors.Focus, rest: Border = Border.None): ClickableSurfaceBorder {
        val focused = Border(BorderStroke(3.dp, ring), inset = 2.dp, shape = shape)
        return ClickableSurfaceDefaults.border(border = rest, focusedBorder = focused, pressedBorder = focused)
    }

    fun glow(color: Color = MishColors.Primary): ClickableSurfaceGlow {
        val g = Glow(elevationColor = color.copy(alpha = 0.45f), elevation = 18.dp)
        return ClickableSurfaceDefaults.glow(focusedGlow = g, pressedGlow = g)
    }

    fun tileScale(): ClickableSurfaceScale = ClickableSurfaceDefaults.scale(focusedScale = TILE_SCALE, pressedScale = 1.02f)
    fun buttonScale(): ClickableSurfaceScale = ClickableSurfaceDefaults.scale(focusedScale = BUTTON_SCALE, pressedScale = 0.98f)
}

enum class ButtonKind { Primary, Secondary, Danger, Ghost }

/**
 * Pill button (DESIGN §9 `MishButton`). [dimmed] renders the "disabled but explains why" state (40 %) while staying
 * focusable and clickable, e.g. Start with too few players (OK then shakes).
 */
@Composable
fun MishButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Secondary,
    icon: ImageVector? = null,
    dimmed: Boolean = false,
    minWidth: Dp = 0.dp,
    onLongClick: (() -> Unit)? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val shape = MishFocus.Pill
    val (container, content, focusedContainer, focusedContent) = when (kind) {
        ButtonKind.Primary -> Quad(MishColors.Primary, MishColors.OnPrimary, MishColors.Primary, MishColors.OnPrimary)
        ButtonKind.Secondary -> Quad(MishColors.Surface, MishColors.Text, MishColors.Elevated, MishColors.Text)
        ButtonKind.Danger -> Quad(Color.Transparent, MishColors.Danger, MishColors.Danger, MishColors.Ink)
        ButtonKind.Ghost -> Quad(MishColors.Surface.copy(alpha = 0.6f), MishColors.Text.copy(alpha = 0.6f), MishColors.Elevated, MishColors.Text)
    }
    val rest = when (kind) {
        ButtonKind.Danger -> Border(BorderStroke(2.dp, MishColors.Danger), shape = shape)
        ButtonKind.Ghost -> Border(BorderStroke(1.dp, MishColors.Outline), shape = shape)
        else -> Border.None
    }
    Surface(
        onClick = onClick,
        onLongClick = onLongClick,
        modifier = modifier
            .defaultMinSize(minWidth = minWidth, minHeight = 48.dp)
            .alpha(if (dimmed) (if (focused) 0.7f else 0.4f) else 1f),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = container,
            contentColor = content,
            focusedContainerColor = focusedContainer,
            focusedContentColor = focusedContent,
            pressedContainerColor = focusedContainer,
            pressedContentColor = focusedContent,
        ),
        scale = MishFocus.buttonScale(),
        border = MishFocus.border(shape, rest = rest),
        glow = MishFocus.glow(),
        interactionSource = interaction,
    ) {
        Row(
            modifier = Modifier
                .align(Alignment.Center)
                .padding(horizontal = 24.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(10.dp))
            }
            Text(
                text = text,
                style = MishTheme.type.label,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
    }
}

private data class Quad(val a: Color, val b: Color, val c: Color, val d: Color)
