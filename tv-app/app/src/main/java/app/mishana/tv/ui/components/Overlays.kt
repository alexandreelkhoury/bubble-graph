package app.mishana.tv.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** True while an overlay owns focus, or while a screen is animating out: screens must not grab focus then. */
val LocalFocusBlocked = compositionLocalOf { false }

/** Requests initial focus once attached (never in the composable body; RESEARCH 02 §3). Re-runs when [key] changes. */
@Composable
fun InitialFocus(requester: FocusRequester, key: Any? = Unit) {
    val blocked = LocalFocusBlocked.current
    LaunchedEffect(key, blocked) {
        if (blocked) return@LaunchedEffect
        withFrameNanos { }
        runCatching { requester.requestFocus() }
    }
}

/**
 * Lost-focus rule (DESIGN §7): when nothing inside this subtree is focused any more (a kicked tile or an expired
 * verdict button left composition), focus returns to [default].
 */
@Composable
fun Modifier.focusFallback(default: FocusRequester): Modifier {
    val blocked by rememberUpdatedState(LocalFocusBlocked.current)
    val scope = rememberCoroutineScope()
    return this.onFocusChanged { st ->
        if (!st.hasFocus && !blocked) {
            scope.launch {
                delay(48)
                if (!blocked) runCatching { default.requestFocus() }
            }
        }
    }
}

/** Traps D-pad focus inside an overlay; Back calls [onBack]. */
@Composable
fun FocusTrap(onBack: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    BackHandler(onBack = onBack)
    Box(
        modifier
            .focusProperties { onExit = { cancelFocusChange() } }
            .focusGroup(),
    ) {
        content()
    }
}

/** Full-screen scrim + centred `elev.3` card (DESIGN §4.5). */
@Composable
fun OverlayCard(
    onBack: () -> Unit,
    width: Dp = 520.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(MishColors.Scrim),
        contentAlignment = Alignment.Center,
    ) {
        FocusTrap(onBack = onBack) {
            val shape = RoundedCornerShape(32.dp)
            Column(
                Modifier
                    .width(width)
                    .shadow(48.dp, shape, ambientColor = Color.Black, spotColor = Color.Black)
                    .background(MishColors.Overlay, shape)
                    .padding(horizontal = 32.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                content = content,
            )
        }
    }
}

/**
 * Confirm dialog (DESIGN TV-14): 520 dp, initial focus on the safe option, Back = the safe option.
 */
@Composable
fun MishDialog(
    title: String,
    body: String?,
    safeLabel: String,
    actionLabel: String,
    onSafe: () -> Unit,
    onAction: () -> Unit,
    actionKind: ButtonKind = ButtonKind.Danger,
) {
    val safe = remember { FocusRequester() }
    OverlayCard(onBack = onSafe) {
        Text(
            title,
            style = MishTheme.type.headline,
            color = MishColors.Text,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        if (body != null) {
            Spacer(Modifier.height(12.dp))
            Text(body, style = MishTheme.type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(28.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
            MishButton(safeLabel, onSafe, Modifier.focusRequester(safe), kind = ButtonKind.Secondary, minWidth = 180.dp)
            MishButton(actionLabel, onAction, kind = actionKind, minWidth = 180.dp)
        }
    }
    LaunchedEffect(Unit) {
        withFrameNanos { }
        runCatching { safe.requestFocus() }
    }
}

/** Indeterminate spinner (an amber arc; static dots in reduced motion). */
@Composable
fun Spinner(size: Dp = 28.dp, color: Color = MishColors.Accent, modifier: Modifier = Modifier) {
    val reduce = MishTheme.reduceMotion
    val angle = if (reduce) {
        0f
    } else {
        val t = rememberInfiniteTransition(label = "spin")
        t.animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "a").value
    }
    Canvas(modifier.size(size).graphicsLayer { rotationZ = angle }) {
        val sw = this.size.minDimension * 0.14f
        drawArc(color.copy(alpha = 0.2f), 0f, 360f, false, topLeft = Offset(sw / 2, sw / 2),
            size = androidx.compose.ui.geometry.Size(this.size.width - sw, this.size.height - sw), style = Stroke(sw))
        drawArc(color, -90f, if (reduce) 360f else 100f, false, topLeft = Offset(sw / 2, sw / 2),
            size = androidx.compose.ui.geometry.Size(this.size.width - sw, this.size.height - sw), style = Stroke(sw, cap = StrokeCap.Round))
    }
}

/** Top status banner (DESIGN §9 `StatusBanner`): connection, "phones asleep". Never focusable. */
@Composable
fun StatusBanner(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, spinner: Boolean = false, trailing: String? = null) {
    val shape = RoundedCornerShape(50)
    Row(
        modifier
            .shadow(24.dp, shape)
            .background(MishColors.Elevated, shape)
            .padding(horizontal = 24.dp, vertical = 10.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (spinner) Spinner(22.dp)
        if (icon != null) Icon(icon, contentDescription = null, tint = MishColors.Danger, modifier = Modifier.size(22.dp))
        Text(text, style = MishTheme.type.body, color = MishColors.Text)
        if (trailing != null) Text(trailing, style = MishTheme.type.caption, color = MishColors.TextMuted)
    }
}

/** One toast (≤ 2 on screen, 3 s each, never focusable). */
class ToastMessage(val id: Long, val text: String, val accent: Color)

class ToastState {
    val items = mutableStateListOf<ToastMessage>()
    private var next = 0L

    fun show(text: String, accent: Color = MishColors.Primary) {
        items.add(ToastMessage(next++, text, accent))
        while (items.size > 2) items.removeAt(0)
    }

    fun dismiss(id: Long) {
        items.removeAll { it.id == id }
    }
}

/** Toast stack at the bottom start (DESIGN §9 `ToastHost`). */
@Composable
fun ToastHost(state: ToastState, modifier: Modifier = Modifier) {
    Column(modifier.widthIn(max = 520.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (t in state.items) {
            androidx.compose.runtime.key(t.id) {
                val visible = remember { androidx.compose.animation.core.MutableTransitionState(false) }
                LaunchedEffect(t.id) {
                    visible.targetState = true
                    delay(3_000)
                    visible.targetState = false
                    delay(MishMotion.Base.toLong() + 40)
                    state.dismiss(t.id)
                }
                AnimatedVisibility(
                    visibleState = visible,
                    enter = fadeIn(tween(MishMotion.Base)) + slideInVertically(tween(MishMotion.Base, easing = MishMotion.Decel)) { it / 2 },
                    exit = fadeOut(tween(MishMotion.Base)) + slideOutVertically(tween(MishMotion.Base, easing = MishMotion.Accel)) { it / 2 },
                ) {
                    val shape = RoundedCornerShape(18.dp)
                    Row(
                        Modifier
                            .shadow(16.dp, shape)
                            .background(MishColors.Elevated, shape)
                            .padding(horizontal = 20.dp, vertical = 10.dp)
                            .semantics { liveRegion = LiveRegionMode.Polite },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(10.dp).background(t.accent, RoundedCornerShape(50)))
                        Spacer(Modifier.width(12.dp))
                        Text(t.text, style = MishTheme.type.body, color = MishColors.Text, maxLines = 2)
                    }
                }
            }
        }
    }
}

/** Centred column helper for full-screen states (Fatal, connection lost). */
@Composable
fun CenterStage(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxSize().padding(horizontal = 96.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        content = content,
    )
}

/** A full-width thin divider in `outline` (decorative). */
@Composable
fun Divider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(MishColors.Outline))
}
