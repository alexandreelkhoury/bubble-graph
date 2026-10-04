package app.mishana.tv.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import app.mishana.tv.ui.screens.LobbyMetrics
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

/**
 * The room code: always LTR, accent, tracked letters (DESIGN TV-02 / §3.5). 72 dp at most, stepping down so the
 * widest code (WWWW ≈ 4.42 em with the tracking) still fits 264 dp in one line — never wrapped, clipped or ellipsized.
 * Display art: the size is in dp, so the system font scale does not change it.
 */
@Composable
fun RoomCode(code: String, modifier: Modifier = Modifier, dim: Boolean = false) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        FitText(
            text = code,
            style = MishTheme.type.code.copy(letterSpacing = LobbyMetrics.CODE_TRACKING_EM.em, lineHeight = 1.0.em),
            color = if (dim) MishColors.TextMuted else MishColors.Accent,
            maxSize = LobbyMetrics.CODE_MAX_DP.dp,
            minSize = LobbyMetrics.CODE_MIN_DP.dp,
            modifier = modifier.semantics { contentDescription = code.toCharArray().joinToString(" ") },
            textAlign = if (rtl) TextAlign.End else TextAlign.Start,
        )
    }
}
