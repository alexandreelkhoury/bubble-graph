package app.mishana.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.mishana.tv.game.Names
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

/**
 * Shared in-game layout: the stage fills the space under the top bar; the bottom action bar (54 dp) holds the
 * action pill at the end. Focus falls back to [defaultFocus] whenever it is lost.
 */
@Composable
fun InGameScaffold(
    defaultFocus: FocusRequester,
    modifier: Modifier = Modifier,
    actionBar: @Composable RowScope.() -> Unit,
    stage: @Composable () -> Unit,
) {
    Column(modifier.fillMaxSize().focusFallback(defaultFocus)) {
        Box(Modifier.fillMaxWidth().weight(1f)) { stage() }
        Row(
            Modifier.fillMaxWidth().defaultMinSize(minHeight = 54.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End),
            content = actionBar,
        )
    }
}

/** A row of mini avatars with names (TV-04, TV-05 strip). */
@Composable
fun AvatarRow(players: List<PublicPlayer>, size: Dp, state: (PublicPlayer) -> AvatarState, nameMax: Int = 8) {
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.Top) {
        for (p in players) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(size + 40.dp)) {
                Avatar(p.color, size, state = state(p))
                Spacer(Modifier.height(6.dp))
                Text(
                    Names.ellipsize(p.name, nameMax),
                    style = MishTheme.type.titleS,
                    color = if (p.connected) MishColors.Text else MishColors.TextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
