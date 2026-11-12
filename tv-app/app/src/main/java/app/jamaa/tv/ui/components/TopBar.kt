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
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import androidx.compose.ui.unit.em
import androidx.compose.ui.semantics.contentDescription

/** The in-game top bar's height: the hub's bar height, so the band never changes between hub and game. */
val TOP_BAR_H = 44.dp

/**
 * The room code as a small pill (in-game corners, the top bar): accent letters, tracked, on a dark pill, always LTR.
 * One look everywhere the code is shown small; the big code with its QR is [JoinPanel].
 */
@Composable
fun CodePill(code: String, modifier: Modifier = Modifier) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Text(
            code,
            style = JamaaTheme.type.label.copy(letterSpacing = 0.14.em),
            color = JamaaColors.Accent,
            maxLines = 1,
            modifier = modifier
                .background(JamaaColors.Surface.copy(alpha = 0.72f), JamaaShapes.pill)
                .padding(start = 12.dp, end = 10.dp, top = 2.dp, bottom = 2.dp)
                .semantics { contentDescription = code.toCharArray().joinToString(" ") },
        )
    }
}

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
 * In-game top bar (DESIGN §7, y 27–71, the hub bar's 44 dp): "Game {n}" during ROLE_REVEAL, else "Round {n} · <phase>"
 * on the start side; on the end side a wifi-off chip (socket degraded), the alive count, then the room code on a small
 * pill (so latecomers can find it at a glance). It never moves between phases.
 */
@Composable
fun TopBar(
    view: MishanaView,
    degraded: Boolean,
    modifier: Modifier = Modifier,
    phaseOverride: String? = null,
    aliveOverride: Int? = null,
) {
    val type = JamaaTheme.type
    val start = if (view.phase == Phase.ROLE_REVEAL || view.round == 0) {
        stringResource(R.string.common__game_number, view.gameNumber)
    } else {
        stringResource(R.string.round__label, view.round) + "  ·  " + (phaseOverride ?: stringResource(phaseNameRes(view.phase)))
    }
    // [aliveOverride]: during the vote reveal the eliminated player still counts (no spoiler before the card flips).
    val alive = aliveOverride ?: view.players.count { it.alive && !it.left }
    Row(
        modifier.fillMaxWidth().height(TOP_BAR_H),
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
            if (view.phase != Phase.RESULTS) {
                Text(
                    pluralStringResource(R.plurals.common__alive_count, alive, alive),
                    style = type.caption,
                    color = JamaaColors.TextMuted,
                    maxLines = 1,
                )
            }
            CodePill(view.roomCode)
        }
    }
}
