package app.jamaa.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.TvView
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme

fun phaseNameRes(phase: Phase): Int = when (phase) {
    Phase.LOBBY -> R.string.phase__lobby
    Phase.ROLE_REVEAL -> R.string.phase__role_reveal
    Phase.CLUES -> R.string.phase__clues
    Phase.VOTING -> R.string.phase__voting
    Phase.TIE_BREAK -> R.string.phase__tie_break
    Phase.ELIMINATION -> R.string.phase__elimination
    Phase.MR_WHITE_GUESS -> R.string.phase__mr_white_guess
    Phase.RESULTS -> R.string.phase__results
}

/**
 * In-game top bar (DESIGN §7, y 27–75): "Game {n}" during ROLE_REVEAL, else "Round {n} · <phase>" on the start side;
 * mini room code, alive count and a wifi-off chip (socket degraded) on the end side. It never moves between phases.
 */
@Composable
fun TopBar(
    view: TvView,
    degraded: Boolean,
    modifier: Modifier = Modifier,
    phaseOverride: String? = null,
    aliveOverride: Int? = null,
) {
    val type = JamaaTheme.type
    val start = if (view.phase == Phase.ROLE_REVEAL || view.round == 0) {
        stringResource(R.string.game__label, view.gameNumber)
    } else {
        stringResource(R.string.round__label, view.round) + "  ·  " + (phaseOverride ?: stringResource(phaseNameRes(view.phase)))
    }
    // [aliveOverride]: during the vote reveal the eliminated player still counts (no spoiler before the card flips).
    val alive = aliveOverride ?: view.players.count { it.alive && !it.left }
    Row(
        modifier.fillMaxWidth().height(48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            start,
            style = type.label,
            color = JamaaColors.TextSecondary,
            maxLines = 1,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            if (degraded) {
                Row(
                    Modifier
                        .background(JamaaColors.Danger.copy(alpha = 0.18f), JamaaShapes.pill)
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(JamaaIcons.WifiOff, contentDescription = null, tint = JamaaColors.Danger, modifier = Modifier.size(20.dp))
                }
            }
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Text(view.roomCode, style = type.label.copy(letterSpacing = type.code.letterSpacing), color = JamaaColors.Accent)
            }
            if (view.phase != Phase.RESULTS) {
                Text(
                    pluralStringResource(R.plurals.common__alive_count, alive, alive),
                    style = type.caption,
                    color = JamaaColors.TextMuted,
                )
            }
        }
    }
}
