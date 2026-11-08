package app.jamaa.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.protocol.HistoryCause
import app.jamaa.tv.protocol.HistoryEntry
import app.jamaa.tv.protocol.PublicPlayer
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * The game's round history: round · avatar · role emblem · cause icon (vote / dice / user-x / door-out), wrapped.
 * Shown in the pause menu on Results (TV-12), so the scoreboard keeps its 5th row (TV-11).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HistoryStrip(history: List<HistoryEntry>, players: List<PublicPlayer>, modifier: Modifier = Modifier) {
    if (history.isEmpty()) return
    Column(modifier.fillMaxWidth()) {
        Text(stringResource(R.string.history__title), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
        FlowRow(
            Modifier.fillMaxWidth().padding(top = JamaaSpace.s1),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (h in history.take(8)) {
                Row(
                    Modifier.heightIn(min = 32.dp).background(JamaaColors.Surface, JamaaShapes.pill).padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Text(h.round.toString(), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary)
                    }
                    val p = players.firstOrNull { it.id == h.eliminatedId }
                    if (p != null) Avatar(p.color, 22.dp)
                    val role = h.role
                    if (role != null) RoleEmblem(role, 18.dp, roleColor(role))
                    val icon = when (h.cause) {
                        HistoryCause.VOTE -> JamaaIcons.Vote
                        HistoryCause.RANDOM -> JamaaIcons.Dice
                        HistoryCause.KICK -> JamaaIcons.UserX
                        HistoryCause.LEAVE -> JamaaIcons.DoorOut
                        HistoryCause.NONE -> JamaaIcons.X
                    }
                    Icon(icon, contentDescription = null, tint = JamaaColors.TextMuted, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
