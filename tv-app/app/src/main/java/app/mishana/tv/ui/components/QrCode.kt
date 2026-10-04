package app.mishana.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishShapes

/**
 * QR panel (SPEC §9.9, DESIGN TV-02): a cream 240 dp panel; ink modules drawn on a Canvas, inset by
 * `4 × module` (the quiet zone is inside the panel). Never mirrored in RTL. Error correction M.
 */
@Composable
fun QrCode(joinUrl: String, modifier: Modifier = Modifier, panel: Dp = 240.dp, description: String? = null) {
    val content = remember(joinUrl) { QrMatrix.content(joinUrl) }
    val matrix = remember(content) { QrMatrix.encode(content) }
    val moduleDp = QrMatrix.moduleDp(panel.value.toInt(), matrix.width).coerceAtLeast(1)
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Box(
            modifier
                .size(panel)
                .background(MishColors.Text, MishShapes.tile)
                .semantics { contentDescription = description ?: joinUrl },
        ) {
            // Recorded once per size (one path of all dark modules), never re-drawn module by module.
            Box(
                Modifier.size(panel).drawWithCache {
                    val m = moduleDp.dp.toPx()
                    val codeSize = m * matrix.width
                    // Centre the code; the leftover (≥ 4 modules per side) is the quiet zone.
                    val origin = (size.width - codeSize) / 2f
                    val cell = m + 0.5f // slight overlap avoids hairline seams between modules
                    val modules = Path()
                    for (y in 0 until matrix.height) {
                        for (x in 0 until matrix.width) {
                            if (matrix.get(x, y)) {
                                val l = origin + x * m
                                val t = origin + y * m
                                modules.addRect(Rect(l, t, l + cell, t + cell))
                            }
                        }
                    }
                    onDrawBehind { drawPath(modules, MishColors.Ink) }
                },
            )
        }
    }
}
