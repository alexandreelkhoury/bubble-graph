package app.mishana.tv.ui.theme

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
fun MishAnaTheme(content: @Composable () -> Unit) {
    val configuration = LocalConfiguration.current
    val context = LocalContext.current
    val arabic = configuration.locales.get(0)?.language == "ar"
    val reduceMotion = remember(configuration) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val type = remember(arabic) { mishTypeScale(arabic) }
    val colors = darkColorScheme(
        primary = MishColors.Primary, onPrimary = MishColors.OnPrimary,
        secondary = MishColors.Accent, onSecondary = MishColors.OnAccent,
        background = MishColors.Bg, onBackground = MishColors.Text,
        surface = MishColors.Surface, onSurface = MishColors.Text,
        surfaceVariant = MishColors.Elevated, onSurfaceVariant = MishColors.TextSecondary,
        error = MishColors.Danger, onError = MishColors.Ink,
        border = MishColors.Focus, scrim = MishColors.Scrim,
    )
    val m3Type = Typography(
        displayLarge = type.displayL, displayMedium = type.displayM, displaySmall = type.displayS,
        headlineLarge = type.headline, headlineMedium = type.headline, headlineSmall = type.title,
        titleLarge = type.title, titleMedium = type.titleS, titleSmall = type.titleS,
        bodyLarge = type.body, bodyMedium = type.body, bodySmall = type.caption,
        labelLarge = type.label, labelMedium = type.caption, labelSmall = type.caption,
    )
    CompositionLocalProvider(
        LocalMishType provides type,
        LocalReduceMotion provides reduceMotion,
        LocalIsArabic provides arabic,
    ) {
        MaterialTheme(colorScheme = colors, typography = m3Type, content = content)
    }
}

/** Shorthand for the type scale. */
object MishTheme {
    val type: MishTypeScale
        @Composable get() = LocalMishType.current
    val reduceMotion: Boolean
        @Composable get() = LocalReduceMotion.current
}
