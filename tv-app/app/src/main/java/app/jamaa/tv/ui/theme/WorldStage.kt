package app.jamaa.tv.ui.theme

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.graphics.lerp
import app.jamaa.tv.ui.components.fullBleed

/** The generated world palette of a game's world id (WorldColors.kt; unknown → the night market). */
fun worldOf(worldId: String?): WorldColors = Worlds.byId(worldId ?: "")

/**
 * The world stage (DESIGN-JAMAA §1.5, JAMAA-PLATFORM §3.4): `stageTop` → `deep` (60 %), a top glow in `glow` at 16 %
 * and an accent bounce at 12 %. [tint] blends from the hub stage (night market) toward the world: the hub uses 40 %
 * for the focused poster's world, setup and game use 100 %. Colours crossfade over 240 ms (`ease.standard`).
 * Code-drawn only (no bitmaps); the grain tile is left out (JAMAA-GAP: the 128 × 128 grain is optional polish and off
 * in lite/calm motion anyway).
 */
@Composable
fun WorldStage(world: WorldColors, tint: Float = 1f, modifier: Modifier = Modifier) {
    val hub = Worlds.NightMarket
    val spec = tween<Color>(240, easing = JamaaMotion.Standard)
    val top by animateColorAsState(lerp(hub.stageTop, world.stageTop, tint), spec, label = "stageTop")
    val deep by animateColorAsState(lerp(hub.deep, world.deep, tint), spec, label = "deep")
    val glow by animateColorAsState(world.glow.copy(alpha = 0.16f * tint), spec, label = "glow")
    val accent by animateColorAsState(world.accent.copy(alpha = 0.12f * tint), spec, label = "accent")
    Canvas(modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
        drawRect(Brush.verticalGradient(0f to top, 0.6f to deep, 1f to deep))
        drawRect(Brush.radialGradient(listOf(glow, Color.Transparent), center = Offset(size.width / 2f, -size.height * 0.05f), radius = size.width * 0.55f))
        drawRect(Brush.radialGradient(listOf(accent, Color.Transparent), center = Offset(-size.width * 0.1f, size.height * 0.7f), radius = size.width * 0.45f))
    }
}
