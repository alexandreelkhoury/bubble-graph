package app.jamaa.tv.games.trivia.ui

import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import app.jamaa.tv.games.trivia.TriviaLayout

// Text and block fitting for the Quiz Night stage: nothing is ever cropped at the top or bottom, and question, answer
// and name text shrink step by step before they wrap, and wrap before they ellipsize.

/**
 * The style with its line height turned into em, so an auto-sized line box follows the chosen font size (a fixed
 * 42 sp line height kept a shrunken question on one line, then ellipsized it). The theme's Latin/Arabic ratio is kept,
 * so Arabic keeps its taller lines (DESIGN §3.2).
 */
internal fun TextStyle.emLines(): TextStyle {
    if (!lineHeight.isSpecified || !fontSize.isSpecified || fontSize.value <= 0f) return this
    if (lineHeight.isEm) return this
    return copy(lineHeight = (lineHeight.value / fontSize.value).em)
}

/**
 * Text that steps its size down from [max] to [min] until it fits the box it is given (width and height), across up
 * to [maxLines] lines; an ellipsis is the last resort past [min]. Its own direction (`TextDirection.Content`).
 */
@Composable
internal fun FitLines(
    text: String,
    style: TextStyle,
    color: Color,
    max: TextUnit,
    min: TextUnit,
    maxLines: Int,
    modifier: Modifier = Modifier,
    align: TextAlign = TextAlign.Start,
) {
    BasicText(
        text,
        modifier = modifier,
        style = style.copy(color = color, textAlign = align, textDirection = TextDirection.Content).emLines(),
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        autoSize = TextAutoSize.StepBased(minFontSize = min, maxFontSize = max, stepSize = 1.sp),
    )
}

/**
 * Measures the block at its natural height and, when that is taller than the room it is given, scales it down as a
 * whole around its centre ([TriviaLayout.fitScale]) instead of letting the parent crop it. The width constraint is
 * kept, so text wraps as usual; the scale is a layer (no extra layout pass while animating).
 */
internal fun Modifier.fitInside(alsoWidth: Boolean = false): Modifier = this.layout { measurable, constraints ->
    val p = measurable.measure(
        constraints.copy(minWidth = 0, minHeight = 0, maxHeight = Constraints.Infinity, maxWidth = if (alsoWidth) Constraints.Infinity else constraints.maxWidth),
    )
    val h = if (constraints.hasBoundedHeight) minOf(p.height, constraints.maxHeight).coerceAtLeast(constraints.minHeight) else p.height
    val w = p.width.coerceIn(constraints.minWidth, constraints.maxWidth)
    val sw = if (alsoWidth) TriviaLayout.fitScale(p.width.toFloat(), w.toFloat()) else 1f
    val s = minOf(sw, TriviaLayout.fitScale(p.height.toFloat(), h.toFloat()))
    layout(w, h) {
        p.placeWithLayer((w - p.width) / 2, (h - p.height) / 2) {
            scaleX = s
            scaleY = s
            transformOrigin = TransformOrigin.Center
        }
    }
}

/** True when the first strong character of [text] is right-to-left (Arabic, Hebrew…): tile text then hugs the end. */
internal fun startsRtl(text: String): Boolean {
    for (c in text) {
        when (Character.getDirectionality(c)) {
            Character.DIRECTIONALITY_RIGHT_TO_LEFT, Character.DIRECTIONALITY_RIGHT_TO_LEFT_ARABIC -> return true
            Character.DIRECTIONALITY_LEFT_TO_RIGHT -> return false
        }
    }
    return false
}
