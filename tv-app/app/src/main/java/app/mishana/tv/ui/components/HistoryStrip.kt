package app.mishana.tv.ui.components

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
import app.mishana.tv.R
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.HistoryEntry
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme

/**
 * The game's round history: round · avatar · role emblem · cause icon (vote / dice / user-x / door-out), wrapped.
 * Shown in the pause menu on Results (TV-12), so the scoreboard keeps its 5th row (TV-11).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HistoryStrip(history: List<HistoryEntry>, players: List<PublicPlayer>, modifier: Modifier = Modifier) {
    if (history.isEmpty()) return
    Column(modifier.fillMaxWidth()) {
        Text(stringResource(R.string.history__title), style = MishTheme.type.caption, color = MishColors.TextMuted)
        FlowRow(
            Modifier.fillMaxWidth().padding(top = MishSpace.s1),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (h in history.take(8)) {
                Row(
                    Modifier.heightIn(min = 32.dp).background(MishColors.Surface, MishShapes.pill).padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Text(h.round.toString(), style = MishTheme.type.caption, color = MishColors.TextSecondary)
                    }
                    val p = players.firstOrNull { it.id == h.eliminatedId }
                    if (p != null) Avatar(p.color, 22.dp)
                    val role = h.role
                    if (role != null) RoleEmblem(role, 18.dp, roleColor(role))
                    val icon = when (h.cause) {
                        HistoryCause.VOTE -> MishIcons.Vote
                        HistoryCause.RANDOM -> MishIcons.Dice
                        HistoryCause.KICK -> MishIcons.UserX
                        HistoryCause.LEAVE -> MishIcons.DoorOut
                        HistoryCause.NONE -> MishIcons.X
                    }
                    Icon(icon, contentDescription = null, tint = MishColors.TextMuted, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
