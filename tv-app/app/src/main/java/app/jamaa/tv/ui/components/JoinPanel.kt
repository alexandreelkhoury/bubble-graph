package app.jamaa.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.tv.material3.Text
import app.jamaa.tv.net.ServerUrls
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * DESIGN-JAMAA §2.1 "join panel": the one way the TV shows how to join, everywhere a QR appears (hub ticket, setup
 * gang pane, first-time intro). A column [width] wide: an optional [header] ("Join on your phone"), the QR tile filling
 * the whole width ([QrCode]: crisp pixel modules, quiet zone 4 modules), the room code as big as the width allows
 * ([RoomCode], [codeHeight] tall) and the address line `host/CODE` ([JoinAddress]). [qrScale] shrinks the tile only
 * (by layer, toward the code, so nothing reflows). Never focusable, never mirrored.
 */
@Composable
fun JoinPanel(
    joinUrl: String,
    roomCode: String,
    width: Dp,
    modifier: Modifier = Modifier,
    header: String? = null,
    codeHeight: Dp = 52.dp,
    address: Boolean = true,
    qrScale: Float = 1f,
    glow: Boolean = true,
) {
    Column(modifier.width(width), horizontalAlignment = Alignment.CenterHorizontally) {
        if (header != null) {
            Text(
                header,
                style = JamaaTheme.type.body,
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
            )
        }
        QrCode(
            joinUrl,
            Modifier.graphicsLayer {
                scaleX = qrScale
                scaleY = qrScale
                transformOrigin = TransformOrigin(0.5f, 1f)
            },
            panel = width,
        )
        RoomCode(roomCode, Modifier.fillMaxWidth().padding(top = 8.dp).height(codeHeight), centered = true, glow = glow)
        if (address) JoinAddress(joinUrl, roomCode, Modifier.fillMaxWidth().padding(top = 2.dp))
    }
}

/**
 * The address line under the code: `play.jamaa.app/KXQP` (host muted, `/KXQP` accent), always one line and LTR. Sized
 * by measuring with the real font: [maxSize] down to [minSize]; when even that does not fit, the host alone (down to
 * [JoinPanelMetrics.HOST_FLOOR_DP]). Never ellipsized, never clipped.
 */
@Composable
fun JoinAddress(joinUrl: String, roomCode: String, modifier: Modifier = Modifier, maxSize: Dp = 18.dp, minSize: Dp = 12.dp) {
    val host = ServerUrls.displayHost(joinUrl)
    val full: AnnotatedString = buildAnnotatedString {
        append(host)
        withStyle(SpanStyle(color = JamaaColors.Accent, fontWeight = FontWeight.Bold)) { append("/$roomCode") }
    }
    val hostOnly = AnnotatedString(host)
    val base = JamaaTheme.type.caption.copy(lineHeight = 1.25.em, letterSpacing = 0.em, fontWeight = FontWeight.SemiBold)
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
            val maxW = if (constraints.hasBoundedWidth) constraints.maxWidth else Int.MAX_VALUE
            val (text, size) = remember(full, maxW, base, density) {
                fun fits(t: AnnotatedString, s: Int) =
                    measurer.measure(t, base.copy(fontSize = with(density) { s.dp.toSp() }), softWrap = false, maxLines = 1, constraints = Constraints()).size.width <= maxW
                (maxSize.value.toInt() downTo minSize.value.toInt()).firstOrNull { fits(full, it) }?.let { full to it }
                    ?: ((maxSize.value.toInt() downTo JoinPanelMetrics.HOST_FLOOR_DP).firstOrNull { fits(hostOnly, it) } ?: JoinPanelMetrics.HOST_FLOOR_DP).let { hostOnly to it }
            }
            Text(
                text,
                style = base.copy(fontSize = with(density) { size.dp.toSp() }),
                color = JamaaColors.TextMuted,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Visible,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Join panel sizes (DESIGN-JAMAA §2.1), plain ints so JVM tests can check them. */
object JoinPanelMetrics {
    /** The host alone never steps below this. */
    const val HOST_FLOOR_DP = 10

    /** The hub ticket: card width, inner padding, the QR tile (= the inner width). */
    const val HUB_TICKET_W_DP = 216
    const val HUB_TICKET_PAD_DP = 8
    const val HUB_QR_DP = HUB_TICKET_W_DP - 2 * HUB_TICKET_PAD_DP
}

/** The hub's ticket card: the join panel on `surface`, [JoinPanelMetrics.HUB_TICKET_PAD_DP] all round. */
@Composable
fun JoinTicketCard(
    joinUrl: String,
    roomCode: String,
    header: String,
    modifier: Modifier = Modifier,
    qrScale: Float = 1f,
    fill: Color = JamaaColors.Surface,
) {
    Column(
        modifier
            .width(JoinPanelMetrics.HUB_TICKET_W_DP.dp)
            .background(fill, JamaaShapes.tile)
            .padding(JoinPanelMetrics.HUB_TICKET_PAD_DP.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        JoinPanel(joinUrl, roomCode, JoinPanelMetrics.HUB_QR_DP.dp, header = header, codeHeight = 50.dp, qrScale = qrScale)
    }
}
