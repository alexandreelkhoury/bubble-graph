package app.mishana.tv.ui.components

import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * One line of display text that never wraps, clips a character or ellipsizes: the font size steps down from
 * [maxSize] to [minSize] (1 dp steps) until it fits the width it is given. Sizes are dp, so the system font scale
 * does not apply — this is for display art people copy by eye (the room code, the join host).
 * Give [style] an em-based lineHeight so the line box follows the chosen size.
 */
@Composable
fun FitText(
    text: String,
    style: TextStyle,
    color: Color,
    maxSize: Dp,
    minSize: Dp,
    modifier: Modifier = Modifier,
    textAlign: TextAlign = TextAlign.Start,
) {
    val density = LocalDensity.current
    val autoSize = with(density) { TextAutoSize.StepBased(minFontSize = minSize.toSp(), maxFontSize = maxSize.toSp(), stepSize = 1.dp.toSp()) }
    BasicText(
        text = text,
        modifier = modifier,
        style = style.copy(color = color, textAlign = textAlign),
        overflow = TextOverflow.Clip,
        softWrap = false,
        maxLines = 1,
        autoSize = autoSize,
    )
}
