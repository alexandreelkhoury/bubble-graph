package app.jamaa.tv.ui.components

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
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

enum class ButtonKind { Primary, Secondary, Danger, Ghost }

/**
 * Pill button (DESIGN §9 `JamaaButton`). [dimmed] renders the "disabled but explains why" state while staying
 * focusable and clickable, e.g. Start with too few players (OK then shakes). A dimmed Primary drops its pink for a
 * neutral surface + secondary text (10:1 rest, 14.6:1 focused) instead of alpha, which measured 1.35:1 / 2.59:1; any
 * other dimmed kind keeps a faded fill but a `textMuted` label (no alpha on text).
 * Secondary and Ghost focus onto the cream fill with ink content and a primary ring (DESIGN §4.6 amendment).
 * [FocusKind.Row] buttons are list rows: 28 dp icon, content start-aligned at 20 dp (or [contentAlign]).
 */
@Composable
fun JamaaButton(
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
    contentAlign: Alignment.Horizontal? = null,
) {
    val shape = JamaaFocus.Pill
    var (container, content, focusedContainer, focusedContent) = when (kind) {
        ButtonKind.Primary -> Quad(JamaaColors.Primary, JamaaColors.OnPrimary, JamaaColors.Primary, JamaaColors.OnPrimary)
        ButtonKind.Secondary -> Quad(JamaaColors.Surface, JamaaColors.Text, JamaaColors.FocusFill, JamaaColors.Ink)
        ButtonKind.Danger -> Quad(Color.Transparent, JamaaColors.Danger, JamaaColors.Danger, JamaaColors.Ink)
        ButtonKind.Ghost -> Quad(JamaaColors.Surface.copy(alpha = 0.6f), JamaaColors.TextSecondary, JamaaColors.FocusFill, JamaaColors.Ink)
    }
    val rest = when (kind) {
        ButtonKind.Danger -> Border(BorderStroke(2.dp, JamaaColors.Danger), shape = shape)
        ButtonKind.Ghost -> Border(BorderStroke(1.dp, JamaaColors.Outline), shape = shape)
        else -> Border.None
    }
    if (dimmed && kind == ButtonKind.Primary) {
        // No alpha on a primary: ink on 40 % pink is unreadable. The pink is gone, so it still reads as unavailable;
        // the focus ring and glow stay at full strength (this is the first focus the host sees on the lobby).
        container = JamaaColors.Surface
        content = JamaaColors.TextSecondary
        focusedContainer = JamaaColors.Elevated
        focusedContent = JamaaColors.Text
    } else if (dimmed) {
        // Dim the fill only; the label goes `textMuted` (alpha on text measured under 3:1). Focused, a dimmed button
        // lifts to `elevated` + `textSecondary`, not cream: the ring and glow stay at full strength.
        container = container.copy(alpha = container.alpha * DIM_REST)
        content = JamaaColors.TextMuted
        focusedContainer = JamaaColors.Elevated
        focusedContent = JamaaColors.TextSecondary
    }
    val isRow = focusKind == FocusKind.Row
    val align = contentAlign ?: if (isRow) Alignment.Start else Alignment.CenterHorizontally
    JamaaFocusSurface(
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
                .align(
                    when (align) {
                        Alignment.Start -> Alignment.CenterStart
                        Alignment.End -> Alignment.CenterEnd
                        else -> Alignment.Center
                    },
                )
                .padding(horizontal = if (isRow) 20.dp else 24.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = if (align == Alignment.CenterHorizontally) Arrangement.Center else Arrangement.Start,
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(if (isRow) 28.dp else 24.dp))
                Spacer(Modifier.width(if (isRow) 14.dp else 10.dp))
            }
            // [reserveText]: an invisible second label that reserves the size of the longer one, so a label swap
            // (e.g. the action pill arming to `tv.pressAgain`) never resizes the button or reflows its row.
            val textAlign = if (align == Alignment.CenterHorizontally) TextAlign.Center else TextAlign.Start
            Box(contentAlignment = if (align == Alignment.CenterHorizontally) Alignment.Center else Alignment.CenterStart) {
                if (reserveText != null) {
                    Text(
                        text = reserveText,
                        style = JamaaTheme.type.label,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = textAlign,
                        modifier = Modifier.alpha(0f).clearAndSetSemantics { },
                    )
                }
                Text(
                    text = text,
                    style = JamaaTheme.type.label,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = textAlign,
                )
            }
        }
    }
}

private data class Quad(val a: Color, val b: Color, val c: Color, val d: Color)

private const val DIM_REST = 0.4f
