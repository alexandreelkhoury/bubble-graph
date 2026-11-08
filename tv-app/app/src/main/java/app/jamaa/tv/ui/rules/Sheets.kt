package app.jamaa.tv.ui.rules

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.ui.platform.LocalConfiguration
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
import app.jamaa.tv.platform.Worlds
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.FocusKind
import app.jamaa.tv.ui.components.FocusTrap
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.hub.gameTitle
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.toColor
import kotlinx.coroutines.launch

/**
 * An end-side sheet (DESIGN-JAMAA §2.4): full height, opaque fill, a 24 dp shadow edge, **no scrim** (what is behind
 * keeps running and stays visible). Slides in from the end edge in 240 ms (`ease.decel`); a 150 ms fade in reduced
 * motion. Focus is trapped inside; Back calls [onBack].
 */
@Composable
fun EndSheet(width: Dp, fill: Color, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val reduce = JamaaTheme.reduceMotion
    val appear = remember { Animatable(0f) }
    LaunchedEffect(Unit) { appear.animateTo(1f, tween(if (reduce) 150 else 240, easing = JamaaMotion.Decel)) }
    val px = with(LocalDensity.current) { width.toPx() }
    val dir = if (androidx.compose.ui.platform.LocalLayoutDirection.current == androidx.compose.ui.unit.LayoutDirection.Rtl) -1f else 1f
    Box(Modifier.fillMaxSize().fullBleed(), contentAlignment = Alignment.CenterEnd) {
        FocusTrap(onBack = onBack) {
            Column(
                Modifier
                    .width(width)
                    .fillMaxHeight()
                    .graphicsLayer {
                        if (reduce) alpha = appear.value else translationX = (1f - appear.value) * px * dir
                    }
                    .shadow(24.dp)
                    .background(fill)
                    .padding(horizontal = 24.dp, vertical = 20.dp),
                content = content,
            )
        }
    }
}

/**
 * HUB-07 ⓘ rules sheet (JAMAA-PLATFORM §3.6): 420 dp on the hub and setup, 360 dp in game; "You are here" sections
 * first (accent bar + label); on the hub it ends with "How JAMAA works". Local: sends nothing, never pauses the game.
 * Up/Down scroll by a third of the screen; Close (initial focus) or Back closes it (to the game when opened from the
 * pause menu — the overlay stack decides).
 */
@Composable
fun RulesSheet(rules: Overlay.Rules, phase: String?, onClose: () -> Unit) {
    val meta = GameCatalog.meta(rules.gameId)
    val world = Worlds.of(meta?.world)
    val fill = if (rules.context == RulesContext.HUB) JamaaColors.Elevated else world.elevated.toColor()
    val close = remember { FocusRequester() }
    val scroll = rememberScrollState()
    val scope = rememberCoroutineScope()
    val third = with(LocalDensity.current) { (LocalConfiguration.current.screenHeightDp / 3).dp.toPx() }
    EndSheet(RulesContent.widthDp(rules.context).dp, fill, onClose) {
        Text(gameTitle(rules.gameId), style = JamaaTheme.type.title, color = world.accentText.toColor(), maxLines = 1)
        Text(stringResource(R.string.rules__title), style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Spacer(Modifier.height(8.dp))
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(scroll)
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    when (e.remoteKey()) {
                        RemoteKey.UP -> { scope.launch { scroll.animateScrollBy(-third) }; true }
                        RemoteKey.DOWN -> { scope.launch { scroll.animateScrollBy(third) }; true }
                        else -> false
                    }
                },
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (meta != null) {
                for (s in RulesContent.sections(meta, phase)) {
                    Row {
                        if (s.youAreHere) Box(Modifier.width(4.dp).height(64.dp).background(world.accent.toColor()))
                        Column(Modifier.padding(start = if (s.youAreHere) 10.dp else 0.dp)) {
                            if (s.youAreHere) Text(stringResource(R.string.rules__you_are_here, keyText(s.spec.titleKey)), style = JamaaTheme.type.caption, color = world.accentText.toColor())
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
        JamaaButton(stringResource(R.string.common__close), onClose, Modifier.fillMaxWidth().focusRequester(close), kind = ButtonKind.Primary, focusKind = FocusKind.Row)
    }
    InitialFocus(close)
}

/** A list sheet of choices (content language, packs): rows on an end sheet, initial focus on [initial]. */
@Composable
fun ChoiceSheet(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    EndSheet(420.dp, JamaaColors.Elevated, onBack) {
        Text(title, style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}
