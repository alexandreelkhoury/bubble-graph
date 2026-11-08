package app.jamaa.tv.ui.screens

import app.jamaa.tv.game.Names
import app.jamaa.tv.protocol.TieBreak
import androidx.compose.ui.text.style.TextOverflow
import app.jamaa.tv.i18n.nameList
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
import app.jamaa.tv.R
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.HostAdvance
import app.jamaa.tv.protocol.voteCandidates
import app.jamaa.tv.protocol.TvView
import app.jamaa.tv.ui.components.ActionPill
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.PlayerTile
import app.jamaa.tv.ui.components.TimerBar
import app.jamaa.tv.ui.components.rememberSecondsLeft
import app.jamaa.tv.ui.components.TimerChip
import app.jamaa.tv.ui.components.InGameScaffold
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme

/** TV-06 Voting. The check badge means "has voted", never for whom; no tallies until the vote closes. */
@Composable
fun VotingScreen(view: TvView, clockOffsetMs: Long, send: (ClientIntent) -> Unit) {
    val type = JamaaTheme.type
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
                    withStyle(SpanStyle(color = JamaaColors.TextSecondary, fontSize = type.title.fontSize)) {
                        append(stringResource(R.string.vote__sub))
                    }
                },
                style = type.displayS,
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
                maxLines = 2,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
            if (view.revote) {
                Spacer(Modifier.height(6.dp))
                Text(
                    // Who is in the re-vote and what a second tie does (a surprise random pick felt like a bug).
                    stringResource(
                        R.string.vote__revote_between,
                        nameList(candidates.map { Names.ellipsize(it.name, 16) }, or = true, fallbackSeparator = " ${stringResource(R.string.tie__vs)} "),
                        stringResource(if (view.settings.tieBreak == TieBreak.RANDOM) R.string.settings__tie_break_random else R.string.settings__tie_break_none),
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = type.caption,
                    color = JamaaColors.Ink,
                    modifier = Modifier.background(JamaaColors.Accent, JamaaShapes.pill).padding(horizontal = 14.dp, vertical = 2.dp),
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
                Row(Modifier.fillMaxWidth().padding(horizontal = JamaaSpace.s2), verticalAlignment = Alignment.CenterVertically) {
                    TimerBar(deadline, clockOffsetMs, Modifier.weight(1f))
                    Spacer(Modifier.width(JamaaSpace.s4))
                    TimerChip(deadline, clockOffsetMs, size = 48.dp)
                }
            }
        }
    }
    InitialFocus(pill)
}

/**
 * Who is expected to vote: the server counts connected voters, so with every phone asleep it says 0 ("0/0 voted"
 * next to a running timer looks broken); then it is the living players ("0/4 voted").
 */
internal fun expectedVoters(view: TvView): Int =
    if (view.votesExpected > 0) view.votesExpected else view.players.count { it.alive && !it.left }

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
                (slideInVertically(tween(JamaaMotion.Base, easing = JamaaMotion.Decel)) { it } + fadeIn()) togetherWith
                    (slideOutVertically(tween(JamaaMotion.Base, easing = JamaaMotion.Accel)) { -it } + fadeOut())
            },
            label = "votes",
        ) { cast ->
            if (cast < 0) {
                Text(stringResource(R.string.vote__ten_left), style = JamaaTheme.type.title, color = JamaaColors.Accent)
            } else {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text(
                        stringResource(R.string.vote__progress, cast.toString(), expectedVoters(view).toString()),
                        style = JamaaTheme.type.title,
                        color = JamaaColors.Text,
                    )
                }
            }
        }
    }
}
