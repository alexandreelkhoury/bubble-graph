package app.jamaa.tv.ui.rules

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.platform.Overlay
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.RulesContent
import app.jamaa.tv.platform.RulesContext
import app.jamaa.tv.ui.theme.worldOf
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.FocusKind
import app.jamaa.tv.ui.components.FocusTrap
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.KeyHint
import app.jamaa.tv.ui.components.LocalOverlayVisible
import app.jamaa.tv.ui.components.OVERLAY_EXIT_MS
import app.jamaa.tv.ui.components.blockPointer
import app.jamaa.tv.ui.components.edgeFade
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.hub.gameTitle
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme
import kotlinx.coroutines.launch

/**
 * An end-side sheet (DESIGN-JAMAA §2.4): full height, opaque fill bleeding to the screen edge, a 24 dp shadow edge.
 * In game there is **no scrim** (what is behind keeps running and stays visible); on the hub and setup [scrim] dims
 * the screen behind to 35 % `bg` so the sheet reads as the one thing in focus. Slides in from the end edge in 240 ms
 * (`ease.decel`) and out in 180 ms (`ease.accel`) while [app.jamaa.tv.ui.components.KeepWhileExiting] keeps it
 * composed; a fade in reduced motion. Content sits inside the TV safe area (start 24, end 48, top 35, bottom 27 dp;
 * logical sides, so RTL mirrors). Focus is trapped inside; Back calls [onBack].
 */
@Composable
fun EndSheet(width: Dp, fill: Color, onBack: () -> Unit, scrim: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val reduce = JamaaTheme.reduceMotion
    val visible = LocalOverlayVisible.current
    val appear = remember { Animatable(0f) }
    LaunchedEffect(visible) {
        if (visible) {
            appear.animateTo(1f, tween(if (reduce) 150 else 240, easing = JamaaMotion.Decel))
        } else {
            appear.animateTo(0f, tween(if (reduce) 150 else OVERLAY_EXIT_MS, easing = JamaaMotion.Accel))
        }
    }
    val px = with(LocalDensity.current) { width.toPx() }
    val dir = if (androidx.compose.ui.platform.LocalLayoutDirection.current == androidx.compose.ui.unit.LayoutDirection.Rtl) -1f else 1f
    Box(Modifier.fillMaxSize().fullBleed(), contentAlignment = Alignment.CenterEnd) {
        if (scrim) {
            Box(Modifier.fillMaxSize().graphicsLayer { alpha = appear.value }.background(JamaaColors.Bg.copy(alpha = SHEET_SCRIM)).blockPointer())
        }
        FocusTrap(onBack = onBack) {
            Column(
                Modifier
                    .width(width)
                    .fillMaxHeight()
                    .graphicsLayer {
                        if (reduce) {
                            alpha = appear.value
                        } else {
                            translationX = (1f - appear.value) * px * dir
                            alpha = if (visible) 1f else appear.value
                        }
                    }
                    .shadow(24.dp)
                    .background(fill)
                    .padding(start = 24.dp, end = JamaaSpace.SafeH, top = JamaaSpace.SafeV + 8.dp, bottom = JamaaSpace.SafeV),
                content = content,
            )
        }
    }
}

private const val SHEET_SCRIM = 0.35f

/** Inner padding of a sheet's scrolling list: room for the focused row's 1.02 scale and 5 dp ring, which the scroll clips. */
private val LIST_PAD_V = 10.dp

/**
 * HUB-07 ⓘ rules sheet (JAMAA-PLATFORM §3.6): 420 dp on the hub and setup, 360 dp in game; "You are here" sections
 * first (accent bar + label); on the hub it ends with "How JAMAA works". Local: sends nothing, never pauses the game.
 * Close (initial focus) or Back closes it (to the game when opened from the pause menu — the overlay stack decides).
 * Up/Down scroll the text by a third of its viewport: the handler sits on Close, where the keys arrive (the text column
 * has nothing focusable). Fades at the scrolling edges and a "↕ Scroll" hint say there is more.
 */
@Composable
fun RulesSheet(rules: Overlay.Rules, phase: String?, onClose: () -> Unit) {
    val meta = GameCatalog.meta(rules.gameId)
    val world = worldOf(meta?.world)
    val fill = if (rules.context == RulesContext.HUB) JamaaColors.Elevated else world.elevated
    val close = remember { FocusRequester() }
    val scroll = rememberScrollState()
    val scope = rememberCoroutineScope()
    val scrollable = scroll.maxValue > 0
    EndSheet(RulesContent.widthDp(rules.context).dp, fill, onClose, scrim = rules.context != RulesContext.GAME) {
        Text(gameTitle(rules.gameId), style = JamaaTheme.type.title, color = world.accentText, maxLines = 1)
        Text(stringResource(R.string.rules__title), style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Spacer(Modifier.height(8.dp))
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .edgeFade(top = scroll.canScrollBackward, bottom = scroll.canScrollForward)
                .verticalScroll(scroll),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (meta != null) {
                for (s in RulesContent.sections(meta, phase)) {
                    // The accent bar spans the section's own height (one or three lines), never a fixed 64 dp.
                    Row(Modifier.height(IntrinsicSize.Min)) {
                        if (s.youAreHere) Box(Modifier.width(4.dp).fillMaxHeight().background(world.accent))
                        Column(Modifier.padding(start = if (s.youAreHere) 10.dp else 0.dp)) {
                            if (s.youAreHere) Text(stringResource(R.string.rules__you_are_here, keyText(s.spec.titleKey)), style = JamaaTheme.type.caption, color = world.accentText)
                            Text(keyText(s.spec.titleKey), style = JamaaTheme.type.title, color = JamaaColors.Text)
                            Text(keyText(s.spec.bodyKey), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary)
                        }
                    }
                }
                if (meta.ruleSections.isEmpty()) {
                    // JAMAA-GAP: G2–G4 rule sections arrive with their G milestones; the how-to cards stand in.
                    for (k in meta.howToKeys) Text(keyText(k), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary)
                }
            }
            if (RulesContent.showsHowJamaaWorks(rules.context)) {
                Text(stringResource(R.string.hub__how_jamaa__title), style = JamaaTheme.type.title, color = JamaaColors.Accent)
                for (k in RulesContent.HOW_JAMAA_WORKS) Text("• " + keyText(k), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary)
            }
            if (rules.context == RulesContext.GAME) Text(stringResource(R.string.rules__keeps_running), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
        }
        Spacer(Modifier.height(8.dp))
        // Reserved even when the text fits (alpha 0), so Close never moves when the text grows.
        KeyHint(
            stringResource(R.string.hint__scroll),
            Modifier.align(Alignment.CenterHorizontally).graphicsLayer { alpha = if (scrollable) 1f else 0f },
            icon = JamaaIcons.UpDown,
        )
        Spacer(Modifier.height(8.dp))
        JamaaButton(
            stringResource(R.string.common__close),
            onClose,
            Modifier
                .fillMaxWidth()
                .focusRequester(close)
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    val step = scroll.viewportSize / 3f
                    when (e.remoteKey()) {
                        RemoteKey.UP -> { scope.launch { scroll.animateScrollBy(-step, tween(200, easing = JamaaMotion.Standard)) }; true }
                        RemoteKey.DOWN -> { scope.launch { scroll.animateScrollBy(step, tween(200, easing = JamaaMotion.Standard)) }; true }
                        else -> false
                    }
                },
            kind = ButtonKind.Primary,
            focusKind = FocusKind.Row,
            contentAlign = Alignment.CenterHorizontally,
        )
    }
    InitialFocus(close)
}

/**
 * A list sheet of choices (content language, packs, hub settings): rows on an end sheet with the hub/setup scrim. The
 * list scrolls with inner padding, so the focused first row's ring and glow are never cut by the scroll clip.
 */
@Composable
fun ChoiceSheet(title: String, onBack: () -> Unit, scrim: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    EndSheet(420.dp, JamaaColors.Elevated, onBack, scrim = scrim) {
        Text(title, style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Spacer(Modifier.height(2.dp))
        ChoiceList(Modifier.weight(1f), content)
    }
}

/** The scrolling body of a [ChoiceSheet]: 12 dp between rows, 10 dp inner padding top and bottom, edge fades. */
@Composable
fun ChoiceList(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val scroll = rememberScrollState()
    Column(
        modifier
            .fillMaxWidth()
            .edgeFade(top = scroll.canScrollBackward, bottom = scroll.canScrollForward, length = 24.dp)
            .verticalScroll(scroll)
            .padding(vertical = LIST_PAD_V),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}
