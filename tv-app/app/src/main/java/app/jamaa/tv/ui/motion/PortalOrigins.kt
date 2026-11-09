package app.jamaa.tv.ui.motion

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Rect

/**
 * §3.10 A: where each game's poster sits on the hub (window coordinates, from the carousel's `onGloballyPositioned`).
 * The portal grows its arch out of this rect and the reverse portal shrinks back into it (web `lerpBox(src, COVER, arch)`).
 * Plain memory, written during layout and read while drawing: no recomposition is needed.
 */
class PortalOrigins {
    private val rects = HashMap<String, Rect>()

    fun put(gameId: String, rect: Rect) {
        rects[gameId] = rect
    }

    fun of(gameId: String?): Rect? = gameId?.let { rects[it] }
}

val LocalPortalOrigins = staticCompositionLocalOf { PortalOrigins() }
