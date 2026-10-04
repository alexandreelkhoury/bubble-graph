package app.mishana.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.voteCandidates
import app.mishana.tv.protocol.TvView
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.PlayerTile
import app.mishana.tv.ui.components.TimerBar
import app.mishana.tv.ui.components.rememberSecondsLeft
import app.mishana.tv.ui.components.TimerChip
import app.mishana.tv.ui.components.InGameScaffold
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme

/** TV-06 Voting. The check badge means "has voted", never for whom; no tallies until the vote closes. */
@Composable
fun VotingScreen(view: TvView, clockOffsetMs: Long, send: (ClientIntent) -> Unit) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val candidates = view.voteCandidates()
    val spec = boardSpec(candidates.size)
    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            VoteProgress(view, clockOffsetMs, Modifier.weight(1f))
            ActionPill(stringResource(R.string.vote__close), { send(HostAdvance) }, pill)
        },
    ) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                buildAnnotatedString {
                    append(stringResource(R.string.vote__title))
                    append("  ")
                    withStyle(SpanStyle(color = MishColors.TextSecondary, fontSize = type.title.fontSize)) {
                        append(stringResource(R.string.vote__sub))
                    }
                },
                style = type.displayS,
                color = MishColors.Text,
                textAlign = TextAlign.Center,
                maxLines = 2,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
            if (view.revote) {
                Spacer(Modifier.height(6.dp))
                Text(
                    stringResource(R.string.vote__revote_among),
                    style = type.caption,
                    color = MishColors.Ink,
                    modifier = Modifier.background(MishColors.Accent, MishShapes.pill).padding(horizontal = 14.dp, vertical = 2.dp),
                )
            }
            Spacer(Modifier.weight(1f))
            Column(verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                for (row in candidates.chunked(spec.perRow)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        for (p in row) {
                            PlayerTile(
                                player = p,
                                width = spec.tileW,
                                height = spec.tileH,
                                avatarSize = spec.avatar,
                                state = AvatarState.of(p, check = p.hasVoted, showHost = false),
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.weight(1f))
            val deadline = view.deadline
            if (deadline != null) {
                // The bar shows the shape of the time left; the seconds next to it are what the room reads (TV-06).
                Row(Modifier.fillMaxWidth().padding(horizontal = MishSpace.s2), verticalAlignment = Alignment.CenterVertically) {
                    TimerBar(deadline, clockOffsetMs, Modifier.weight(1f))
                    Spacer(Modifier.width(MishSpace.s4))
                    TimerChip(deadline, clockOffsetMs, size = 48.dp)
                }
            }
        }
    }
    InitialFocus(pill)
}

/** "x / y voted" (rolling), or `vote.tenLeft` in the last 10 s. */
@Composable
private fun VoteProgress(view: TvView, clockOffsetMs: Long, modifier: Modifier) {
    val deadline = view.deadline
    // Changes once (at 10 s), not every frame.
    val tenLeft = deadline != null && rememberSecondsLeft(deadline, clockOffsetMs).value in 1..10
    Row(modifier, horizontalArrangement = Arrangement.Center) {
        AnimatedContent(
            targetState = if (tenLeft) -1 else view.votesCast,
            transitionSpec = {
                (slideInVertically(tween(MishMotion.Base, easing = MishMotion.Decel)) { it } + fadeIn()) togetherWith
                    (slideOutVertically(tween(MishMotion.Base, easing = MishMotion.Accel)) { -it } + fadeOut())
            },
            label = "votes",
        ) { cast ->
            if (cast < 0) {
                Text(stringResource(R.string.vote__ten_left), style = MishTheme.type.title, color = MishColors.Accent)
            } else {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text(
                        stringResource(R.string.vote__progress, cast.toString(), view.votesExpected.toString()),
                        style = MishTheme.type.title,
                        color = MishColors.Text,
                    )
                }
            }
        }
    }
}
