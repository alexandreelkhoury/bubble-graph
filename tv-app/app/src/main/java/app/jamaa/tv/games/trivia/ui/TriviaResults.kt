package app.jamaa.tv.games.trivia.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.trivia.TriviaBoard
import app.jamaa.tv.games.trivia.TriviaInput
import app.jamaa.tv.games.trivia.TriviaPlayer
import app.jamaa.tv.games.trivia.TriviaView
import app.jamaa.tv.i18n.nameList
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.Confetti
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.components.focusFallback
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * TR-TV-06 (GAME-TRIVIA §12.5, HUB-05): characters jump onto the podium steps 3-2-1, the winner lifts the trophy,
 * confetti, the stats cards drop in one by one; then Tonight's cup and the three platform buttons (REPLAY,
 * BACK_TO_SETUP, BACK_TO_HUB). OK during the podium only completes it; the buttons act once it is over and the 400 ms
 * input guard passed, so OK mashed through the podium never triggers REPLAY (platform §3.10 E).
 */
@Composable
internal fun TriviaResults(view: TriviaView, clock: PhaseClock, args: GameScreenArgs) {
    val playAgain = remember { FocusRequester() }
    val sounds = LocalSounds.current
    fun act(action: () -> Unit) {
        val now = System.currentTimeMillis()
        if (TriviaInput.okCompletes(clock.t(), clock.moment, clock.completed.value)) {
            clock.complete(now)
            sounds.stopAll()
            return
        }
        val at = TriviaInput.interactiveAt(clock.startedAtLocal, clock.moment, clock.completedAtLocal)
        if (TriviaInput.buttonsReady(now, at)) action()
    }
    val podium = TriviaBoard.podium(view)
    val stats = TriviaBoard.stats(view)
    Column(Modifier.fillMaxSize().focusFallback(playAgain)) {
        Row(Modifier.fillMaxWidth().height(44.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(keyText("game.trivia.results.title"), style = JamaaTheme.type.headline, color = Studio.accentText, modifier = Modifier.weight(1f))
            RoundIconButton(JamaaIcons.Info, stringResource(R.string.rules__open), args.onRules, size = 36.dp)
        }
        Row(Modifier.fillMaxWidth().weight(1f)) {
            Box(Modifier.weight(1f).fillMaxHeight()) {
                PodiumSteps(podium, view, clock, Modifier.align(Alignment.BottomCenter))
                val burst by remember(clock) { derivedStateOf { clock.t() >= 1_400L } }
                if (burst && podium.isNotEmpty()) Confetti(Modifier.fillMaxSize(), durationMs = 1_400, seed = view.n)
            }
            Column(Modifier.width(280.dp).fillMaxHeight().padding(start = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically)) {
                stats.forEachIndexed { i, s -> StatCard(view, s, Modifier.layerAppear(lift = -24f) { clock.p("stats", i) }) }
            }
        }
        args.cupPanel()
        args.passHook?.let {
            Text(it, style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
        Row(
            Modifier.fillMaxWidth().height(58.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            JamaaButton(
                stringResource(R.string.results__play_again),
                { act(args.results.onReplay) },
                Modifier.focusRequester(playAgain),
                kind = ButtonKind.Primary,
                icon = JamaaIcons.Refresh,
                minWidth = 220.dp,
            )
            JamaaButton(stringResource(R.string.results__change_settings), { act(args.results.onChangeSettings) }, icon = JamaaIcons.Settings)
            JamaaButton(stringResource(R.string.cup__other_games), { act(args.results.onOtherGames) }, icon = JamaaIcons.Users)
        }
    }
    InitialFocus(playAgain, key = "trivia-results:${view.n}")
}

/** Steps in visual order 2-1-3; tied players share a step. Characters jump on 3 → 2 → 1. */
@Composable
private fun PodiumSteps(podium: List<List<TriviaPlayer>>, view: TriviaView, clock: PhaseClock, modifier: Modifier) {
    val heights = listOf(120.dp, 88.dp, 64.dp)
    val visual = listOf(1, 0, 2).filter { it < podium.size }
    Row(modifier.padding(bottom = 4.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (place in visual) {
            val group = podium[place]
            val jump = podium.size - 1 - place // 3rd jumps first
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
                    for (p in group) {
                        Box(
                            Modifier.graphicsLayer {
                                val t = clock.p("jump", jump)
                                transformOrigin = TransformOrigin(0.5f, 1f)
                                alpha = if (t > 0f) 1f else 0f
                                translationY = (1f - t) * 140.dp.toPx() - kotlin.math.sin(Math.PI * t.coerceIn(0f, 1f)).toFloat() * 40.dp.toPx()
                            },
                            contentAlignment = Alignment.TopCenter,
                        ) {
                            Character(p.color, 72.dp, TriviaBoard.expression(view, p))
                            if (place == 0) {
                                Icon(
                                    JamaaIcons.Trophy,
                                    contentDescription = null,
                                    tint = JamaaColors.Accent,
                                    modifier = Modifier.size(34.dp).graphicsLayer {
                                        val t = clock.p("trophy")
                                        alpha = t.coerceIn(0f, 1f)
                                        translationY = -30.dp.toPx() - (1f - t) * 30.dp.toPx()
                                        scaleX = 0.5f + 0.5f * t
                                        scaleY = 0.5f + 0.5f * t
                                    },
                                )
                            }
                        }
                    }
                }
                PodiumBlock(place + 1, group, heights[place], Modifier.graphicsLayer {
                    val s = clock.p("steps")
                    transformOrigin = TransformOrigin(0.5f, 1f)
                    scaleY = s.coerceIn(0f, 1.1f)
                })
            }
        }
    }
}

@Composable
private fun PodiumBlock(place: Int, group: List<TriviaPlayer>, height: Dp, modifier: Modifier) {
    val width = (130 + 56 * (group.size - 1)).dp
    Column(
        modifier
            .width(width)
            .height(height)
            .background(Brush.verticalGradient(listOf(Studio.elevated, Studio.surface)), RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("$place", style = JamaaTheme.type.headline, color = if (place == 1) JamaaColors.Accent else JamaaColors.Text)
        Text(
            group.joinToString(" · ") { Names.ellipsize(it.name, 9) },
            style = JamaaTheme.type.caption,
            color = JamaaColors.TextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            keyText("game.trivia.results.points", group.first().score.toString()),
            style = JamaaTheme.type.label,
            color = JamaaColors.Text,
            maxLines = 1,
        )
        if (group.size > 1) Text(keyText("game.trivia.results.shared"), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1)
    }
}

@Composable
private fun StatCard(view: TriviaView, s: TriviaBoard.Stat, modifier: Modifier) {
    val names = nameList(s.playerIds.mapNotNull { view.player(it)?.name })
    val text = when (s.kind) {
        TriviaBoard.StatKind.FASTEST -> keyText("game.trivia.results.fastestCount", names, s.value)
        TriviaBoard.StatKind.STREAK -> keyText("game.trivia.results.longestStreak", names, s.value)
        TriviaBoard.StatKind.CORRECT -> keyText("game.trivia.results.mostCorrect", names, s.value)
    }
    Row(
        modifier.fillMaxWidth().background(Studio.surface, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val icon = when (s.kind) {
            TriviaBoard.StatKind.FASTEST -> app.jamaa.tv.ui.components.AvatarGlyphs.of(app.jamaa.tv.AvatarShape.Bolt)
            TriviaBoard.StatKind.STREAK -> null
            TriviaBoard.StatKind.CORRECT -> JamaaIcons.Check
        }
        if (icon != null) Icon(icon, contentDescription = null, tint = Lemon, modifier = Modifier.size(22.dp)) else FlameOverlay(1, 22.dp)
        Spacer(Modifier.width(10.dp))
        Text(text, style = JamaaTheme.type.label, color = JamaaColors.Text, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}
