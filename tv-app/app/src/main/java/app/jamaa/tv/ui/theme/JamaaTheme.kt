package app.jamaa.tv.ui.theme

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Typography
import androidx.tv.material3.darkColorScheme

/** Maps DESIGN tokens into tv-material so stock components inherit them (DESIGN §13.2). */
@Composable
fun JamaaTheme(content: @Composable () -> Unit) {
    val configuration = LocalConfiguration.current
    val context = LocalContext.current
    val arabic = configuration.locales.get(0)?.language == "ar"
    val reduceMotion = remember(configuration) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val type = remember(arabic) { jamaaTypeScale(arabic) }
    val colors = darkColorScheme(
        primary = JamaaColors.Primary, onPrimary = JamaaColors.OnPrimary,
        secondary = JamaaColors.Accent, onSecondary = JamaaColors.OnAccent,
        background = JamaaColors.Bg, onBackground = JamaaColors.Text,
        surface = JamaaColors.Surface, onSurface = JamaaColors.Text,
        surfaceVariant = JamaaColors.Elevated, onSurfaceVariant = JamaaColors.TextSecondary,
        error = JamaaColors.Danger, onError = JamaaColors.Ink,
        border = JamaaColors.Focus, scrim = JamaaColors.Scrim,
    )
    val m3Type = Typography(
        displayLarge = type.displayL, displayMedium = type.displayM, displaySmall = type.displayS,
        headlineLarge = type.headline, headlineMedium = type.headline, headlineSmall = type.title,
        titleLarge = type.title, titleMedium = type.titleS, titleSmall = type.titleS,
        bodyLarge = type.body, bodyMedium = type.body, bodySmall = type.caption,
        labelLarge = type.label, labelMedium = type.caption, labelSmall = type.caption,
    )
    CompositionLocalProvider(
        LocalJamaaType provides type,
        LocalReduceMotion provides reduceMotion,
        LocalIsArabic provides arabic,
    ) {
        MaterialTheme(colorScheme = colors, typography = m3Type, content = content)
    }
}

/** Shorthand for the type scale. */
object JamaaTheme {
    val type: JamaaTypeScale
        @Composable get() = LocalJamaaType.current
    val reduceMotion: Boolean
        @Composable get() = LocalReduceMotion.current
}
