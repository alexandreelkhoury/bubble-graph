package app.mishana.tv.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.mishana.tv.R

/** Cairo static instances (OFL), DESIGN §3.1. */
val Cairo = FontFamily(
    Font(R.font.cairo_regular, FontWeight.Normal),
    Font(R.font.cairo_semibold, FontWeight.SemiBold),
    Font(R.font.cairo_bold, FontWeight.Bold),
    Font(R.font.cairo_black, FontWeight.Black),
)

@Immutable
data class MishTypeScale(
    val code: TextStyle,
    val displayL: TextStyle,
    val displayM: TextStyle,
    val displayS: TextStyle,
    val headline: TextStyle,
    val title: TextStyle,
    val titleS: TextStyle,
    val body: TextStyle,
    val label: TextStyle,
    val caption: TextStyle,
    val timer: TextStyle,
)

// Cairo's digits are already tabular (every figure advances 554/1000 em in Black, 559 in SemiBold), and the
// font has no `tnum` feature, so no fontFeatureSettings are needed for timers (DESIGN §3.1 [verify] resolved).
private fun style(size: Int, lh: Int, weight: FontWeight, tracking: TextUnit = 0.em) = TextStyle(
    fontFamily = Cairo,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = lh.sp,
    letterSpacing = tracking,
    lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None),
)

/** Latin/Arabic variants per DESIGN §3.2. Arabic: taller lines, zero tracking, ×1.08 on display sizes. */
fun mishTypeScale(arabic: Boolean): MishTypeScale {
    fun t(latin: Double) = if (arabic) 0.em else latin.em
    fun d(size: Int) = if (arabic) (size * 1.08).toInt() else size
    return MishTypeScale(
        code = style(88, 96, FontWeight.Black, 0.08.em), // always Latin
        displayL = style(d(72), if (arabic) 96 else 80, FontWeight.Black, t(-0.01)),
        displayM = style(d(56), if (arabic) 80 else 64, FontWeight.Black, t(-0.01)),
        displayS = style(44, if (arabic) 64 else 52, FontWeight.Bold),
        headline = style(34, if (arabic) 52 else 42, FontWeight.Bold),
        title = style(26, if (arabic) 40 else 32, FontWeight.Bold),
        titleS = style(22, if (arabic) 34 else 28, FontWeight.SemiBold),
        body = style(20, if (arabic) 34 else 28, FontWeight.SemiBold),
        label = style(20, if (arabic) 30 else 24, FontWeight.Bold, t(0.02)),
        caption = style(20, if (arabic) 30 else 26, FontWeight.SemiBold, t(0.01)),
        timer = style(40, 44, FontWeight.Black),
    )
}

val LocalMishType = staticCompositionLocalOf { mishTypeScale(arabic = false) }
