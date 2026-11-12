package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Text that is never cropped (owner feedback: "the sentence was cropped"): it takes the largest size from [maxSp] down
 * to [minSp] (1 sp steps) at which it fits the space it is given in at most [maxLines] lines, wrapping first. Only at
 * [minSp] does an ellipsis appear (a 60-grapheme lie at 14 sp on a 34 dp card, the worst case of 13 options).
 * The line height follows the chosen size (em): 1.2 for Latin, 1.55 when the text carries Arabic script, so a shrunk
 * Arabic prompt keeps its diacritics clear of the next line. Direction follows the content (an Arabic lie in an EN
 * room). The parent must bound the height (weight, fixed size or `heightIn`) for the size to step down on height.
 */
@Composable
internal fun AutoText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    maxSp: Float = style.fontSize.value,
    minSp: Float = 14f,
    maxLines: Int = Int.MAX_VALUE,
    textAlign: TextAlign = TextAlign.Center,
    strike: Boolean = false,
) {
    val arabic = remember(text) { hasArabic(text) }
    val top = maxOf(maxSp, minSp)
    BasicText(
        text = text,
        modifier = modifier,
        style = style.copy(
            color = color,
            textAlign = textAlign,
            lineHeight = if (arabic) 1.55.em else 1.2.em,
            textDirection = TextDirection.Content,
            textDecoration = if (strike) TextDecoration.LineThrough else null,
        ),
        overflow = TextOverflow.Ellipsis,
        softWrap = maxLines > 1,
        maxLines = maxLines,
        autoSize = TextAutoSize.StepBased(minFontSize = minSp.sp, maxFontSize = top.sp, stepSize = 1.sp),
    )
}

internal fun hasArabic(s: String): Boolean = s.any { it in '؀'..'ۿ' || it in 'ݐ'..'ݿ' || it in 'ﭐ'..'﷿' || it in 'ﹰ'..'﻿' }
