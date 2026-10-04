package app.mishana.tv.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.spring
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.dp

/** DESIGN §6.1. */
object MishMotion {
    const val Fast = 150
    const val Base = 240
    const val Slow = 400
    const val Dramatic = 800
    val Standard = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    val Decel = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
    val Accel = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)
    val Overshoot = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)
    fun <T> bouncy(): SpringSpec<T> = spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMediumLow)
}

/** DESIGN §4.1 (dp). */
object MishSpace {
    val s1 = 4.dp
    val s2 = 8.dp
    val s3 = 12.dp
    val s4 = 16.dp
    val s5 = 20.dp
    val s6 = 24.dp
    val s7 = 32.dp
    val s8 = 40.dp
    val s9 = 48.dp
    val s10 = 64.dp
    val s11 = 80.dp
    val s12 = 96.dp
    val SafeH = 48.dp
    val SafeV = 27.dp
}

/** DESIGN §4.4. */
object MishRadius {
    val xs = 6.dp
    val sm = 10.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
}

/** DESIGN §4.4 shapes on the radius scale: rows/chips `md`, tiles/panels `lg`, cards/overlays `xl`, pills. */
object MishShapes {
    val xs = RoundedCornerShape(MishRadius.xs)
    val sm = RoundedCornerShape(MishRadius.sm)
    val row = RoundedCornerShape(MishRadius.md)
    val tile = RoundedCornerShape(MishRadius.lg)
    val card = RoundedCornerShape(MishRadius.xl)
    val pill = RoundedCornerShape(percent = 50)
}

/** `Settings.Global.ANIMATOR_DURATION_SCALE == 0f` (DESIGN §6.3). Animations branch on it. */
val LocalReduceMotion = staticCompositionLocalOf { false }

/** True when the UI language is Arabic (typography and bidi choices). */
val LocalIsArabic = staticCompositionLocalOf { false }
