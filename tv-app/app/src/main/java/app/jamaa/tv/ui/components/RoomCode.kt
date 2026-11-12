package app.jamaa.tv.ui.components

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.tv.material3.Text
import app.jamaa.tv.ui.screens.LobbyMetrics
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * The room code: always LTR, accent, tracked letters (DESIGN TV-02 / §3.5, DESIGN-JAMAA §2.1 join panel). The size is
 * the largest that fits the box it is given — [LobbyMetrics.CODE_MAX_DP] at most, measured with the real font — so it is
 * never wrapped, clipped or ellipsized, and a short box simply gets a smaller code (no floor that could clip).
 * Centred codes are centred on their ink: Android tracking adds space after the last letter too, which is taken back.
 * [glow]: a soft accent halo drawn as a radial gradient behind the letters (no text shadow: a blurred shadow was cut
 * by the line box and left a hard edge under the code). Display art: the size is in dp, so font scale does not apply.
 */
@Composable
fun RoomCode(code: String, modifier: Modifier = Modifier, dim: Boolean = false, centered: Boolean = false, glow: Boolean = false) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val color = if (dim) JamaaColors.TextMuted else JamaaColors.Accent
    val base = JamaaTheme.type.code.copy(
        letterSpacing = LobbyMetrics.CODE_TRACKING_EM.em,
        lineHeight = CODE_LINE_EM.em,
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None),
    )
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(
            modifier.semantics { contentDescription = code.toCharArray().joinToString(" ") },
            contentAlignment = when {
                centered -> Alignment.Center
                rtl -> Alignment.CenterEnd
                else -> Alignment.CenterStart
            },
        ) {
            val maxW = if (constraints.hasBoundedWidth) constraints.maxWidth else Int.MAX_VALUE
            val maxH = if (constraints.hasBoundedHeight) constraints.maxHeight else Int.MAX_VALUE
            // Largest whole-dp size whose ink (without the trailing tracking) and line both fit.
            val fit = remember(code, maxW, maxH, base, density) {
                var dpSize = LobbyMetrics.CODE_MAX_DP
                var style: TextStyle
                while (true) {
                    style = base.copy(fontSize = with(density) { dpSize.dp.toSp() })
                    val r = measurer.measure(code, style, softWrap = false, maxLines = 1, constraints = Constraints())
                    val tracking = with(density) { (dpSize * LobbyMetrics.CODE_TRACKING_EM).dp.toPx() }
                    val inkW = r.size.width - tracking
                    if ((inkW <= maxW && r.size.height <= maxH) || dpSize <= CODE_FLOOR_DP) break
                    dpSize--
                }
                dpSize
            }
            val style = base.copy(fontSize = with(density) { fit.dp.toSp() })
            // Half the trailing tracking: the ink, not the advance, sits on the centre line.
            val shift = if (centered) (fit * LobbyMetrics.CODE_TRACKING_EM / 2).dp else 0.dp
            Text(
                code,
                style = style,
                color = color,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Visible,
                textAlign = TextAlign.Start,
                modifier = Modifier
                    .offset(x = shift)
                    .then(
                        if (glow) {
                            Modifier.drawBehind {
                                // An ellipse that fades to nothing inside its own bounds: no hard edge, ever.
                                val r = size.width * 0.62f
                                scale(1f, (size.height / size.width * 1.5f).coerceAtMost(1f), Offset(size.width / 2f, size.height / 2f)) {
                                    drawCircle(
                                        Brush.radialGradient(
                                            listOf(JamaaColors.Accent.copy(alpha = 0.22f), Color.Transparent),
                                            center = Offset(size.width / 2f, size.height / 2f),
                                            radius = r,
                                        ),
                                        r,
                                        Offset(size.width / 2f, size.height / 2f),
                                    )
                                }
                            }
                        } else {
                            Modifier
                        },
                    ),
            )
        }
    }
}

/** Line box of the code, in em of its size: centred on the font metrics, with room for the tail of Q (Cairo caps sit 0.73 em above the baseline, Q dips ~0.17 em below). */
private const val CODE_LINE_EM = 1.08

/** The code never steps below this, even in a tiny box (it would rather overflow a few dp than become unreadable). */
private const val CODE_FLOOR_DP = 14
