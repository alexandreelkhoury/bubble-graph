package app.mishana.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.GuessStatus
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.HostOverrideGuess
import app.mishana.tv.protocol.TvView
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.Confetti
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishDialog
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.TimerBar
import app.mishana.tv.ui.components.TimerRing
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

/**
 * TV-10 Blank guess (MR_WHITE_GUESS). The guessed text is never shown before RESULTS (SPEC §5.4): the Blank reads it
 * aloud and the host overrides from what was heard. The room light drops (AppRoot darkens the background).
 */
@Composable
fun BlankGuessScreen(view: TvView, clockOffsetMs: Long, send: (ClientIntent) -> Unit) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val guess = view.guess
    val guesser = view.player(guess?.playerId)
    val status = guess?.status ?: GuessStatus.PENDING
    val reduce = MishTheme.reduceMotion
    val density = LocalDensity.current
    var confirm by remember { mutableStateOf(false) }

    // Verdict effects: a single 25 % white flash (no strobe) + confetti for CORRECT; a shake for WRONG.
    val flash = remember { Animatable(0f) }
    val shake = remember { Animatable(0f) }
    LaunchedEffect(status) {
        when (status) {
            GuessStatus.CORRECT -> if (!reduce) {
                flash.animateTo(0.25f, tween(100))
                flash.animateTo(0f, tween(400))
            }
            GuessStatus.WRONG -> if (!reduce) shake.shake(with(density) { 12.dp.toPx() })
            else -> Unit
        }
    }

    CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || confirm)) {
        InGameScaffold(
            defaultFocus = pill,
            actionBar = {
                val deadline = view.deadline
                if (status != GuessStatus.PENDING && deadline != null) {
                    Box(Modifier.weight(1f)) { TimerBar(deadline, clockOffsetMs, height = 6.dp) }
                } else {
                    Spacer(Modifier.weight(1f))
                }
                if (status != GuessStatus.PENDING && guess?.overridden == false && status != GuessStatus.TIMEOUT) {
                    MishButton(
                        text = stringResource(if (status == GuessStatus.WRONG) R.string.guess__accept else R.string.guess__reject),
                        onClick = { confirm = true },
                        kind = ButtonKind.Secondary,
                        icon = if (status == GuessStatus.WRONG) MishIcons.Check else MishIcons.X,
                    )
                }
                ActionPill(
                    stringResource(if (status == GuessStatus.PENDING) R.string.guess__skip else R.string.common__continue),
                    { send(HostAdvance) },
                    pill,
                )
            },
        ) {
            Box(Modifier.fillMaxSize()) {
                Column(
                    Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    // One soft spotlight (radial, 340 dp) on the Blank, who wears a dashed paper ring.
                    Box(Modifier.size(240.dp).shakeOffset(shake), contentAlignment = Alignment.Center) {
                        Canvas(Modifier.requiredSize(340.dp).clearAndSetSemantics {}) {
                            drawCircle(
                                Brush.radialGradient(
                                    colors = listOf(MishColors.Blank.copy(alpha = 0.16f), Color.Transparent),
                                    center = center,
                                    radius = size.minDimension / 2f,
                                ),
                            )
                        }
                        val deadline = view.deadline
                        if (status == GuessStatus.PENDING && deadline != null) {
                            TimerRing(deadline, clockOffsetMs, 220.dp, 8.dp, showNumber = false)
                        }
                        Canvas(Modifier.size(176.dp).clearAndSetSemantics {}) {
                            drawCircle(
                                color = MishColors.Blank,
                                style = Stroke(width = 3.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 8.dp.toPx()))),
                            )
                        }
                        if (guesser != null) {
                            Avatar(guesser.color, 128.dp, state = AvatarState(away = !guesser.connected))
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    AnimatedContent(
                        targetState = status,
                        transitionSpec = { fadeIn(tween(240)) togetherWith fadeOut(tween(150)) },
                        label = "verdict",
                    ) { st ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                            when (st) {
                                GuessStatus.PENDING -> {
                                    Text(stringResource(R.string.guess__title), style = type.displayS, color = MishColors.Text, textAlign = TextAlign.Center)
                                    Text(
                                        stringResource(R.string.guess__guessing, isolate(Names.ellipsize(guesser?.name.orEmpty(), 20))),
                                        style = type.body,
                                        color = MishColors.TextSecondary,
                                        textAlign = TextAlign.Center,
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Text(stringResource(R.string.guess__silence), style = type.caption, color = MishColors.TextMuted)
                                }
                                GuessStatus.CORRECT -> VerdictLine(R.string.guess__correct, MishColors.Success, MishIcons.Check)
                                GuessStatus.WRONG -> VerdictLine(R.string.guess__wrong, MishColors.Danger, MishIcons.X)
                                GuessStatus.TIMEOUT -> VerdictLine(R.string.guess__timeout, MishColors.TextSecondary, MishIcons.Timer)
                            }
                            if (guess?.overridden == true) {
                                Text(stringResource(R.string.guess__overridden), style = type.caption, color = MishColors.Accent)
                            }
                        }
                    }
                }
                if (status == GuessStatus.CORRECT) {
                    Confetti(seed = view.round)
                }
                if (flash.value > 0f) {
                    Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = flash.value)))
                }
            }
        }
        InitialFocus(pill, key = status)
    }

    if (confirm && guess != null) {
        val accept = guess.status == GuessStatus.WRONG
        MishDialog(
            title = if (accept) {
                stringResource(R.string.guess__accept_confirm, isolate(guesser?.name.orEmpty()))
            } else {
                stringResource(R.string.guess__reject_confirm)
            },
            body = null,
            safeLabel = stringResource(R.string.common__cancel),
            actionLabel = stringResource(if (accept) R.string.guess__accept else R.string.guess__reject),
            onSafe = { confirm = false },
            onAction = {
                send(HostOverrideGuess(accept = accept))
                confirm = false
            },
            actionKind = ButtonKind.Primary,
        )
    }
    // The verdict buttons leave composition when the deadline ends; the dialog must not outlive its button.
    LaunchedEffect(status, guess?.overridden) { if (status == GuessStatus.PENDING || guess?.overridden == true) confirm = false }
}

@Composable
private fun VerdictLine(textRes: Int, color: Color, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(44.dp))
        Spacer(Modifier.width(14.dp))
        Text(
            stringResource(textRes),
            style = MishTheme.type.displayS,
            color = MishColors.Text,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 720.dp),
        )
    }
}
