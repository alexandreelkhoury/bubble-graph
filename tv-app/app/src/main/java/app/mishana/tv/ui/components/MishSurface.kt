package app.mishana.tv.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceBorder
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ClickableSurfaceGlow
import androidx.tv.material3.ClickableSurfaceScale
import androidx.tv.material3.Glow
import androidx.tv.material3.Surface
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishShapes

/**
 * The one TV focus style (DESIGN §4.6): scale 1.06 (tiles) / 1.04 (buttons, rows), a 3 dp cream ring 2 dp
 * outside the shape, a primary glow at 45 %, and the fill lifting to `elevated`.
 * tv-material 1.1.0 draws `Border.inset` outward (`inset(-border.inset)`), so +2 dp = "offset 2 dp outside".
 */
object MishFocus {
    const val TILE_SCALE = 1.06f
    const val BUTTON_SCALE = 1.04f
    val Pill: Shape = MishShapes.pill

    /** Room a focused row needs inside a clipping list: half of the 4 % scale of a ~600 dp row (12 dp) + the 5 dp ring. */
    val ListPadH = 18.dp
    val ListPadV = 8.dp

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

/** Which focus scale a [MishFocusSurface] uses: tiles 1.06, buttons and rows 1.04. */
enum class FocusKind { Tile, Button }

/**
 * Every focusable surface of the TV app (DESIGN §13.2: one focus helper, so the style cannot drift): tv-material
 * Surface with the [MishFocus] scale, ring and glow, and the same colours focused AND pressed (tv-material would
 * otherwise derive the pressed content colour from the theme and dim labels on every OK).
 * A pointer (air-mouse) hovering it moves focus onto it, so the ring follows the cursor and OK acts on what is under it.
 */
@Composable
fun MishFocusSurface(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    shape: Shape = MishShapes.row,
    kind: FocusKind = FocusKind.Button,
    container: Color = MishColors.Surface,
    content: Color = MishColors.Text,
    focusedContainer: Color = MishColors.Elevated,
    focusedContent: Color = MishColors.Text,
    rest: Border = Border.None,
    onLongClick: (() -> Unit)? = null,
    interactionSource: MutableInteractionSource? = null,
    body: @Composable BoxScope.() -> Unit,
) {
    val sounds = LocalSounds.current
    Surface(
        onClick = onClick,
        onLongClick = onLongClick,
        modifier = modifier.onFocusChanged { if (it.isFocused) sounds.focusMoved() }.focusOnHover(),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = container,
            contentColor = content,
            focusedContainerColor = focusedContainer,
            focusedContentColor = focusedContent,
            pressedContainerColor = focusedContainer,
            pressedContentColor = focusedContent,
        ),
        scale = if (kind == FocusKind.Tile) MishFocus.tileScale() else MishFocus.buttonScale(),
        border = MishFocus.border(shape, rest = rest),
        glow = MishFocus.glow(),
        interactionSource = interactionSource ?: remember { MutableInteractionSource() },
        content = body,
    )
}

/** Pointer hover → focus (the D-pad path is unaffected). The requester targets the focusable that follows it. */
@Composable
fun Modifier.focusOnHover(): Modifier {
    val requester = remember { FocusRequester() }
    return this
        .focusRequester(requester)
        .pointerInput(requester) {
            awaitPointerEventScope {
                while (true) {
                    if (awaitPointerEvent().type == PointerEventType.Enter) requester.tryFocus()
                }
            }
        }
}
