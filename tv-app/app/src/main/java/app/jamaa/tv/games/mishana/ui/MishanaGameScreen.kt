package app.jamaa.tv.games.mishana.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.jamaa.tv.R
import app.jamaa.tv.game.MishanaHost
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.mishana.MishanaGameView
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.ui.components.DeadlineSounds
import app.jamaa.tv.ui.components.LocalFocusBlocked
import app.jamaa.tv.ui.components.ProvideFrameClock
import app.jamaa.tv.ui.components.TopBar
import app.jamaa.tv.ui.screens.BlankGuessScreen
import app.jamaa.tv.ui.screens.CluesScreen
import app.jamaa.tv.ui.screens.EliminationScreen
import app.jamaa.tv.ui.screens.ResultsScreen
import app.jamaa.tv.ui.screens.RoleRevealScreen
import app.jamaa.tv.ui.screens.VotingScreen
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme

/** Which full screen is showing; CLUES and TIE_BREAK share one screen (the tie is an overlay). */
private enum class ScreenKey { RoleReveal, Clues, Voting, Elimination, Guess, Results }

private data class Frame(val key: ScreenKey, val view: MishanaView)

private fun keyFor(v: MishanaView): ScreenKey = when (v.phase) {
    Phase.ROLE_REVEAL, Phase.LOBBY -> ScreenKey.RoleReveal // LOBBY never appears while PLAYING (§2.7)
    Phase.CLUES, Phase.TIE_BREAK -> ScreenKey.Clues
    Phase.VOTING -> ScreenKey.Voting
    Phase.ELIMINATION -> ScreenKey.Elimination
    Phase.MR_WHITE_GUESS -> ScreenKey.Guess
    Phase.RESULTS -> ScreenKey.Results
}

/**
 * Mish Ana! inside the platform (JAMAA-PLATFORM §2.5, §2.7): the existing TV screens, fed from the composed
 * [MishanaView] (game.public joined with room.members). The in-game top bar, the phase transitions and the deadline
 * sounds are the v1 AppRoot's; results end with the platform's three buttons and the cup panel (HUB-05).
 */
@Composable
fun MishanaGameScreen(game: MishanaGameView, args: GameScreenArgs) {
    val view = game.view
    val reduce = JamaaTheme.reduceMotion
    val rise = with(LocalDensity.current) { 24.dp.roundToPx() }
    // TV-07: while the votes are being revealed, the top bar must not give the verdict away.
    var revealing by remember { mutableStateOf(false) }
    LaunchedEffect(view.phase) { if (view.phase != Phase.ELIMINATION) revealing = false }
    val needsHost = MishanaHost.needsHost(view)
    LaunchedEffect(needsHost) { args.onHostDialog(needsHost) }
    DeadlineSounds(view.deadline, args.clockOffsetMs)
    val key = keyFor(view)
    ProvideFrameClock(active = view.deadline != null) {
        Column(Modifier.fillMaxSize()) {
            if (key != ScreenKey.Results) {
                val hideVerdict = revealing && key == ScreenKey.Elimination
                TopBar(
                    view,
                    args.degraded,
                    phaseOverride = if (hideVerdict) stringResource(R.string.vote__votes_in) else null,
                    aliveOverride = if (hideVerdict) view.players.count { (it.alive || it.id == view.eliminated?.playerId) && !it.left } else null,
                )
                Spacer(Modifier.height(JamaaSpace.s3))
            }
            AnimatedContent(
                targetState = Frame(key, view),
                contentKey = { it.key },
                transitionSpec = {
                    if (reduce) {
                        fadeIn(tween(JamaaMotion.Fast)) togetherWith fadeOut(tween(JamaaMotion.Fast))
                    } else {
                        (fadeIn(tween(JamaaMotion.Slow, easing = JamaaMotion.Decel)) + slideInVertically(tween(JamaaMotion.Slow, easing = JamaaMotion.Decel)) { rise }) togetherWith
                            (fadeOut(tween(JamaaMotion.Base, easing = JamaaMotion.Accel)) + scaleOut(tween(JamaaMotion.Base, easing = JamaaMotion.Accel), targetScale = 0.98f))
                    }
                },
                modifier = Modifier.weight(1f),
                label = "mishanaPhase",
            ) { frame ->
                val leaving = transition.targetState != EnterExitState.Visible
                CompositionLocalProvider(LocalFocusBlocked provides (args.overlayOpen || leaving)) {
                    Box(Modifier.fillMaxSize()) {
                        val v = frame.view
                        when (frame.key) {
                            ScreenKey.RoleReveal -> RoleRevealScreen(v, args.clockOffsetMs, args.send)
                            ScreenKey.Clues -> CluesScreen(v, args.clockOffsetMs, args.overlayOpen, args.send)
                            ScreenKey.Voting -> VotingScreen(v, args.clockOffsetMs, args.send)
                            ScreenKey.Elimination -> EliminationScreen(v, args.clockOffsetMs, args.overlayOpen, args.send) { revealing = it }
                            ScreenKey.Guess -> BlankGuessScreen(v, args.clockOffsetMs, args.send)
                            ScreenKey.Results -> ResultsScreen(
                                v,
                                onReplay = args.results.onReplay,
                                onChangeSettings = args.results.onChangeSettings,
                                onOtherGames = args.results.onOtherGames,
                                cupPanel = args.cupPanel,
                                passHook = args.passHook,
                                onRules = args.onRules,
                            )
                        }
                    }
                }
            }
        }
    }
}
