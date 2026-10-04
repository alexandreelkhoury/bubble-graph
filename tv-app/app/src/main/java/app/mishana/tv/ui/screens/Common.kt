package app.mishana.tv.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.keyframes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import app.mishana.tv.R
import app.mishana.tv.i18n.Locales
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.Role

/** UI language of the current configuration: en | fr | ar. */
@Composable
@ReadOnlyComposable
fun uiLanguage(): String = Locales.normalize(LocalConfiguration.current.locales.get(0)?.language)

@Composable
@ReadOnlyComposable
fun localizedTitle(t: LocalizedTitle): String = t.inLanguage(uiLanguage())

fun LocalizedTitle.inLanguage(lang: String): String = when (lang) {
    "fr" -> fr
    "ar" -> ar
    else -> en
}

fun roleLabelRes(role: Role): Int = when (role) {
    Role.CIVILIAN -> R.string.role__civilian
    Role.UNDERCOVER -> R.string.role__undercover
    Role.BLANK -> R.string.role__blank
}

fun langNameRes(tag: String): Int = when (tag) {
    "fr" -> R.string.lang__fr
    "ar" -> R.string.lang__ar
    else -> R.string.lang__en
}

@Composable
@ReadOnlyComposable
fun roleLabel(role: Role): String = stringResource(roleLabelRes(role))

/** Horizontal shake: 3 cycles of ±12 dp in 360 ms (DESIGN §6.2-D); skipped in reduced motion. */
suspend fun Animatable<Float, AnimationVector1D>.shake(amplitudePx: Float) {
    snapTo(0f)
    animateTo(
        0f,
        keyframes {
            durationMillis = 360
            amplitudePx at 30
            -amplitudePx at 90
            amplitudePx at 150
            -amplitudePx at 210
            amplitudePx at 270
            -amplitudePx at 330
        },
    )
}

fun Modifier.shakeOffset(anim: Animatable<Float, AnimationVector1D>): Modifier = graphicsLayer { translationX = anim.value }
