package app.mishana.tv.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

enum class ButtonKind { Primary, Secondary, Danger, Ghost }

/**
 * Pill button (DESIGN §9 `MishButton`). [dimmed] renders the "disabled but explains why" state while staying
 * focusable and clickable, e.g. Start with too few players (OK then shakes). A dimmed Primary drops its pink for a
 * neutral surface + secondary text (10:1 rest, 14.6:1 focused) instead of alpha, which measured 1.35:1 / 2.59:1.
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
    reserveText: String? = null,
    focusKind: FocusKind = FocusKind.Button,
) {
    val shape = MishFocus.Pill
    var (container, content, focusedContainer, focusedContent) = when (kind) {
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
    if (dimmed && kind == ButtonKind.Primary) {
        // No alpha on a primary: ink on 40 % pink is unreadable. The pink is gone, so it still reads as unavailable;
        // the focus ring and glow stay at full strength (this is the first focus the host sees on the lobby).
        container = MishColors.Surface
        content = MishColors.TextSecondary
        focusedContainer = MishColors.Elevated
        focusedContent = MishColors.Text
    } else if (dimmed) {
        // Dim the fill and label only: the focus ring and glow stay at full strength (the first focus users see on
        // the lobby is this dimmed Start, so it must be the clearest one).
        container = container.copy(alpha = container.alpha * DIM_REST)
        content = content.copy(alpha = content.alpha * DIM_REST)
        focusedContainer = focusedContainer.copy(alpha = focusedContainer.alpha * DIM_FOCUSED)
        focusedContent = focusedContent.copy(alpha = focusedContent.alpha * DIM_FOCUSED)
    }
    MishFocusSurface(
        onClick = onClick,
        onLongClick = onLongClick,
        modifier = modifier.defaultMinSize(minWidth = minWidth, minHeight = 48.dp),
        shape = shape,
        kind = focusKind,
        container = container,
        content = content,
        focusedContainer = focusedContainer,
        focusedContent = focusedContent,
        rest = rest,
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
            // [reserveText]: an invisible second label that reserves the size of the longer one, so a label swap
            // (e.g. the action pill arming to `tv.pressAgain`) never resizes the button or reflows its row.
            Box(contentAlignment = Alignment.Center) {
                if (reserveText != null) {
                    Text(
                        text = reserveText,
                        style = MishTheme.type.label,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.alpha(0f).clearAndSetSemantics { },
                    )
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
}

private data class Quad(val a: Color, val b: Color, val c: Color, val d: Color)

private const val DIM_REST = 0.4f
private const val DIM_FOCUSED = 0.7f
