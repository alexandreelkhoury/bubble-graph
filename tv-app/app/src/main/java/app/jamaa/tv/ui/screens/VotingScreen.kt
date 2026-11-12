package app.jamaa.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.mishana.MishanaLayout
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.games.mishana.ui.StageText
import app.jamaa.tv.games.mishana.ui.stagedEnter
import app.jamaa.tv.games.mishana.ui.noClip
import app.jamaa.tv.games.mishana.voteCandidates
import app.jamaa.tv.i18n.nameList
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.PublicPlayer
import app.jamaa.tv.protocol.TieBreak
import app.jamaa.tv.ui.components.ActionPill
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InGameScaffold
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.PlayerTile
import app.jamaa.tv.ui.components.TimerBar
import app.jamaa.tv.ui.components.TimerChip
import app.jamaa.tv.ui.components.rememberSecondsLeft
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * TV-06 Voting. The title, then the candidates' tiles as big as the stage allows (3–12, [MishanaLayout.voteGrid]),
 * the timer bar, and "x / y voted". The check badge (and a green outline) means "has voted", never for whom; no
 * tallies until the vote closes.
 */
@Composable
fun VotingScreen(view: MishanaView, clockOffsetMs: Long, send: (ClientIntent) -> Unit) {
    val type = JamaaTheme.type
    val pill = remember { FocusRequester() }
    val candidates = view.voteCandidates()
    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            VoteProgress(view, clockOffsetMs, Modifier.weight(1f))
            ActionPill(stringResource(R.string.vote__close), { send(MishanaTv.hostAdvance()) }, pill)
        },
    ) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            StageText(
                stringResource(R.string.vote__title),
                type.displayM,
                JamaaColors.Text,
                Modifier.fillMaxWidth().stagedEnter().semantics { liveRegion = LiveRegionMode.Polite },
                maxLines = 1,
                minScale = 0.7f,
            )
            StageText(
                stringResource(R.string.vote__sub),
                type.title,
                JamaaColors.TextSecondary,
                Modifier.fillMaxWidth().stagedEnter(delayMs = 80),
                maxLines = 1,
                minScale = 0.8f,
            )
            if (view.revote) {
                Spacer(Modifier.height(8.dp))
                StageText(
                    // Who is in the re-vote and what a second tie does (a surprise random pick felt like a bug).
                    stringResource(
                        R.string.vote__revote_between,
                        nameList(candidates.map { Names.ellipsize(it.name, 16) }, or = true, fallbackSeparator = " ${stringResource(R.string.tie__vs)} "),
                        stringResource(if (view.settings.tieBreak == TieBreak.RANDOM) R.string.settings__tie_break_random else R.string.settings__tie_break_none),
                    ),
                    type.label,
                    JamaaColors.Ink,
                    Modifier
                        .widthIn(max = 820.dp)
                        .stagedEnter(delayMs = 160, fromScale = 0.8f)
                        .background(JamaaColors.Accent, JamaaShapes.pill)
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    maxLines = 2,
                    minScale = 0.85f,
                )
            }
            BoxWithConstraints(Modifier.fillMaxWidth().weight(1f).padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                val grid = MishanaLayout.voteGrid(candidates.size, maxWidth.value, maxHeight.value)
                PlayerGrid(candidates, grid) { p, i -> VoteTile(p, grid, i) }
            }
        }
    }
    InitialFocus(pill)
}

/**
 * One candidate: deals in (staggered 40 ms, from 85 %), and "thunks" (1.08× and back, `ease.overshoot`) with a green
 * outline when their vote arrives. Reduced motion: the outline and the check only.
 */
@Composable
private fun VoteTile(p: PublicPlayer, grid: MishanaLayout.Grid, index: Int) {
    val reduce = JamaaTheme.reduceMotion
    val thunk = remember { Animatable(1f) }
    var seen by remember { mutableStateOf(p.hasVoted) }
    LaunchedEffect(p.hasVoted) {
        if (p.hasVoted && !seen && !reduce) {
            thunk.animateTo(1.08f, tween(JamaaMotion.Fast, easing = JamaaMotion.Decel))
            thunk.animateTo(1f, tween(JamaaMotion.Slow, easing = JamaaMotion.Overshoot))
        }
        seen = p.hasVoted
    }
    val outline by animateFloatAsState(if (p.hasVoted) 1f else 0f, tween(JamaaMotion.Base), label = "voted")
    Box(Modifier.stagedEnter(delayMs = 120 + 40 * index, fromScale = 0.85f, rise = 12.dp)) {
        PlayerTile(
            player = p,
            width = grid.tileW.dp,
            height = grid.tileH.dp,
            avatarSize = grid.avatar.dp,
            modifier = Modifier
                .graphicsLayer { scaleX = thunk.value; scaleY = thunk.value }
                .border(BorderStroke(3.dp, JamaaColors.Success.copy(alpha = 0.7f * outline)), JamaaShapes.tile),
            state = AvatarState.of(p, check = p.hasVoted, showHost = false),
        )
    }
}

/**
 * Who is expected to vote: the server counts connected voters, so with every phone asleep it says 0 ("0/0 voted"
 * next to a running timer looks broken); then it is the living players ("0/4 voted").
 */
internal fun expectedVoters(view: MishanaView): Int =
    if (view.votesExpected > 0) view.votesExpected else view.players.count { it.alive && !it.left }

/**
 * The action bar: the linear timer bar (the shape of the time left), "x / y voted" (rolling) or `vote.tenLeft` in the
 * last 10 s, and the 48 dp seconds chip (what the room reads). One row, so the board keeps the stage height.
 */
@Composable
private fun VoteProgress(view: MishanaView, clockOffsetMs: Long, modifier: Modifier) {
    val deadline = view.deadline
    // Changes once (at 10 s), not every frame.
    val tenLeft = deadline != null && rememberSecondsLeft(deadline, clockOffsetMs).value in 1..10
    Row(modifier.padding(horizontal = JamaaSpace.s2), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        if (deadline != null) {
            TimerBar(deadline, clockOffsetMs, Modifier.weight(1f))
            Spacer(Modifier.width(JamaaSpace.s6))
        }
        VoteCount(view, tenLeft)
        if (deadline != null) {
            Spacer(Modifier.width(JamaaSpace.s6))
            TimerChip(deadline, clockOffsetMs, size = 48.dp)
        }
    }
}

@Composable
private fun VoteCount(view: MishanaView, tenLeft: Boolean) {
    Box(contentAlignment = Alignment.Center) {
        AnimatedContent(
            targetState = if (tenLeft) -1 else view.votesCast,
            transitionSpec = {
                ((slideInVertically(tween(JamaaMotion.Base, easing = JamaaMotion.Decel)) { it } + fadeIn()) togetherWith
                    (slideOutVertically(tween(JamaaMotion.Base, easing = JamaaMotion.Accel)) { -it } + fadeOut())).noClip()
            },
            label = "votes",
        ) { cast ->
            if (cast < 0) {
                Text(stringResource(R.string.vote__ten_left), style = JamaaTheme.type.title, color = JamaaColors.Accent, maxLines = 1)
            } else {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text(
                        stringResource(R.string.vote__progress, cast.toString(), expectedVoters(view).toString()),
                        style = JamaaTheme.type.title,
                        color = JamaaColors.Text,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
