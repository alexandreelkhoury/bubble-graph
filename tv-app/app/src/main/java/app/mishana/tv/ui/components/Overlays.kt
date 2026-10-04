package app.mishana.tv.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Constraints
import kotlin.math.roundToInt
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
import androidx.compose.ui.input.pointer.pointerInput
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** True while an overlay owns focus, or while a screen is animating out: screens must not grab focus then. */
val LocalFocusBlocked = compositionLocalOf { false }

/** requestFocus() that never throws (a requester whose node left composition is simply skipped). */
fun FocusRequester.tryFocus(): Boolean = runCatching { requestFocus() }.getOrDefault(false)

/**
 * Requests initial focus once attached (never in the composable body; RESEARCH 02 §3), and only once per [key]:
 * it waits while [LocalFocusBlocked] is set, then focuses [requester].
 * When the block lifts LATER (a dialog, sub-panel, pause menu or connection overlay closed), focus goes back to
 * [restore] (what the user was on when the overlay opened; DESIGN §7) and only falls back to [requester] when that
 * target is gone or not given. In-game screens pass no [restore]: their single action pill is the target.
 */
@Composable
fun InitialFocus(requester: FocusRequester, key: Any? = Unit, restore: (() -> FocusRequester?)? = null) {
    val blocked = LocalFocusBlocked.current
    val initialDone = remember(key) { booleanArrayOf(false) }
    val restoreTarget by rememberUpdatedState(restore)
    LaunchedEffect(key, blocked) {
        if (blocked) return@LaunchedEffect
        withFrameNanos { }
        if (!initialDone[0]) {
            initialDone[0] = true
            requester.tryFocus()
            return@LaunchedEffect
        }
        val target = restoreTarget?.invoke()
        if (target == null || !target.tryFocus()) requester.tryFocus()
    }
}

/**
 * Lets a full-screen scrim, wash or overlay escape the safe-area padding of its parents (DESIGN §4.2: backgrounds,
 * glows and scrims bleed to the screen edges; only content stays inside the safe area). The node keeps its own
 * layout size, but its content is measured at the window size and placed at the window origin.
 * Put it on the OUTERMOST node of an animated overlay (e.g. the AnimatedVisibility modifier): an alpha layer below it
 * would otherwise clip the bled area to the original bounds while it fades.
 */
@Composable
fun Modifier.fullBleed(): Modifier {
    val window = LocalWindowInfo.current
    return this.layout { measurable, constraints ->
        val size = window.containerSize
        val w = if (size.width > 0) size.width else constraints.maxWidth
        val h = if (size.height > 0) size.height else constraints.maxHeight
        val placeable = measurable.measure(Constraints.fixed(w, h))
        val ownW = if (constraints.hasBoundedWidth) constraints.maxWidth else w
        val ownH = if (constraints.hasBoundedHeight) constraints.maxHeight else h
        layout(ownW, ownH) {
            val origin = coordinates?.positionInRoot() ?: Offset.Zero
            // place(), not placeRelative(): the window origin is the same in LTR and RTL.
            placeable.place(-origin.x.roundToInt(), -origin.y.roundToInt())
        }
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
    val hasFocus = remember { booleanArrayOf(false) }
    return this.onFocusChanged { st ->
        hasFocus[0] = st.hasFocus
        if (!st.hasFocus && !blocked) {
            scope.launch {
                delay(48)
                // Re-check: focus may have come back (or moved in) meanwhile, e.g. an initial focus request.
                if (!hasFocus[0] && !blocked) default.tryFocus()
            }
        }
    }
}

/**
 * Makes a subtree unreachable by D-pad while [blocked] (an overlay owns focus): focus search can never enter it,
 * even after the overlay's focused item left composition and focus fell back to the root.
 */
fun Modifier.inertWhen(blocked: Boolean): Modifier =
    this.focusProperties { onEnter = { if (blocked) cancelFocusChange() } }.focusGroup()

/** Swallows every pointer event (air-mouse clicks and hovers) so nothing under a scrim can be clicked through. */
fun Modifier.blockPointer(): Modifier = this.pointerInput(Unit) {
    awaitPointerEventScope {
        while (true) awaitPointerEvent().changes.forEach { it.consume() }
    }
}

/**
 * Traps D-pad focus inside an overlay; Back calls [onBack]. When the focused item leaves composition (a row whose
 * player left, a menu item that no longer applies), focus returns to [default] instead of falling to the root.
 */
@Composable
fun FocusTrap(onBack: () -> Unit, modifier: Modifier = Modifier, default: FocusRequester? = null, content: @Composable () -> Unit) {
    BackHandler(onBack = onBack)
    Box(
        modifier
            .then(if (default != null) Modifier.focusFallback(default) else Modifier)
            .focusProperties { onExit = { cancelFocusChange() } }
            .focusGroup(),
    ) {
        content()
    }
}

/** Full-screen scrim + centred `elev.3` card (DESIGN §4.5). The scrim swallows pointer clicks aimed under it. */
@Composable
fun OverlayCard(
    onBack: () -> Unit,
    width: Dp = 520.dp,
    default: FocusRequester? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .fullBleed()
            .background(MishColors.Scrim)
            .blockPointer(),
        contentAlignment = Alignment.Center,
    ) {
        FocusTrap(onBack = onBack, default = default) {
            val shape = MishShapes.card
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
    OverlayCard(onBack = onSafe, default = safe) {
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
    InitialFocus(safe)
}

/** Indeterminate spinner (an amber arc; a full static ring in reduced motion). The angle is read in the layer only. */
@Composable
fun Spinner(modifier: Modifier = Modifier, size: Dp = 28.dp, color: Color = MishColors.Accent) {
    val reduce = MishTheme.reduceMotion
    val angle = if (reduce) {
        null
    } else {
        rememberInfiniteTransition(label = "spin").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "a")
    }
    Canvas(modifier.size(size).graphicsLayer { rotationZ = angle?.value ?: 0f }) {
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
    val shape = MishShapes.pill
    Row(
        modifier
            .shadow(24.dp, shape)
            .background(MishColors.Elevated, shape)
            .padding(horizontal = 24.dp, vertical = 10.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (spinner) Spinner(size = 22.dp)
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

    /** > 0 while a screen draws its own [ToastHost] in its own zone (the Lobby); the root host then stays hidden. */
    var screenHosts by mutableIntStateOf(0)

    fun show(text: String, accent: Color = MishColors.Primary) {
        items.add(ToastMessage(next++, text, accent))
        while (items.size > 2) items.removeAt(0)
    }

    fun dismiss(id: Long) {
        items.removeAll { it.id == id }
    }
}

/** Toast stack (DESIGN §9 `ToastHost`); shows the newest [maxItems] (≤ 2). */
@Composable
fun ToastHost(state: ToastState, modifier: Modifier = Modifier, maxWidth: Dp = 520.dp, maxItems: Int = 2) {
    Column(modifier.widthIn(max = maxWidth), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (t in state.items.takeLast(maxItems)) {
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
                    val shape = MishShapes.row
                    Row(
                        Modifier
                            .shadow(16.dp, shape)
                            .background(MishColors.Elevated, shape)
                            .padding(horizontal = 20.dp, vertical = 10.dp)
                            .semantics { liveRegion = LiveRegionMode.Polite },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(10.dp).background(t.accent, MishShapes.pill))
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

/**
 * Full-screen status layout (TV-13b connection lost, TV-13e/g fatal): a 96 dp icon, a displayS title, an optional
 * body, and one primary action that takes initial focus.
 */
@Composable
fun StatusStage(
    icon: ImageVector,
    tint: Color,
    title: String,
    body: String?,
    actionLabel: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
    actionIcon: ImageVector = MishIcons.Refresh,
) {
    val action = remember { FocusRequester() }
    CenterStage(modifier) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(96.dp))
        Spacer(Modifier.height(MishSpace.s5))
        Text(
            title,
            style = MishTheme.type.displayS,
            color = MishColors.Text,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        if (body != null) {
            Spacer(Modifier.height(MishSpace.s2))
            Text(body, style = MishTheme.type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(MishSpace.s7))
        MishButton(actionLabel, onAction, Modifier.focusRequester(action), kind = ButtonKind.Primary, icon = actionIcon, minWidth = 240.dp)
    }
    InitialFocus(action)
}

/** A full-width thin divider in `outline` (decorative). */
@Composable
fun Divider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(MishColors.Outline))
}
