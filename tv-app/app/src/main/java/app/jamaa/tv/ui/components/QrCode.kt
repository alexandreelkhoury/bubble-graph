package app.jamaa.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import app.jamaa.tv.ui.theme.JamaaColors

/**
 * QR tile (SPEC §9.9, DESIGN TV-02, DESIGN-JAMAA §2.1 join panel): a cream square of [panel] dp that the code fills
 * edge to edge except its quiet zone. Modules are whole **pixels** (`floor(panelPx / (matrix + 8))`, [QrMatrix.modulePx]),
 * so every module is crisp and the quiet zone is 4 modules plus the pixel rounding (about 4–5 modules, never the
 * 7–8 modules that whole-dp modules left). Never mirrored in RTL. Error correction M. Corners: 2 modules, so the
 * rounding stays inside the quiet zone.
 */
@Composable
fun QrCode(joinUrl: String, modifier: Modifier = Modifier, panel: Dp = 240.dp, description: String? = null) {
    val content = remember(joinUrl) { QrMatrix.content(joinUrl) }
    val matrix = remember(content) { QrMatrix.encode(content) }
    val density = LocalDensity.current
    val panelPx = with(density) { panel.roundToPx() }
    val modulePx = QrMatrix.modulePx(panelPx, matrix.width).coerceAtLeast(1)
    val corner = with(density) { (modulePx * 2).toDp() }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Box(
            modifier
                .size(panel)
                .background(JamaaColors.Text, RoundedCornerShape(corner))
                .semantics { contentDescription = description ?: joinUrl }
                // Recorded once per size (one path of all dark modules), never re-drawn module by module.
                .drawWithCache {
                    val m = modulePx.toFloat()
                    val codeSize = m * matrix.width
                    // Centred on whole pixels; the leftover (4 modules + the rounding) is the quiet zone.
                    val originX = ((size.width - codeSize) / 2f).toInt().toFloat()
                    val originY = ((size.height - codeSize) / 2f).toInt().toFloat()
                    val modules = Path()
                    for (y in 0 until matrix.height) {
                        var x = 0
                        while (x < matrix.width) {
                            if (!matrix.get(x, y)) {
                                x++
                                continue
                            }
                            // One rect per horizontal run: fewer path ops, and no seams inside a run.
                            var end = x
                            while (end + 1 < matrix.width && matrix.get(end + 1, y)) end++
                            val l = originX + x * m
                            val t = originY + y * m
                            modules.addRect(Rect(l, t, originX + (end + 1) * m, t + m))
                            x = end + 1
                        }
                    }
                    onDrawBehind { drawPath(modules, JamaaColors.Ink) }
                },
        )
    }
}
