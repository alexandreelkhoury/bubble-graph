package app.jamaa.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.PauseItemSpec
import app.jamaa.tv.platform.PauseRow
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * HUB-06 pause menu (JAMAA-PLATFORM §3.2; Back in game). Rows come from [app.jamaa.tv.platform.PauseMenuModel]:
 * **Resume** (initial focus), the game's own host items in declared order (enabled only in their phases), **Rules ⓘ**,
 * Sound on/off, **Quit game** (confirm, initial focus "Keep playing", handled by AppRoot). Local: "The game keeps
 * running" (no pause in the protocol). In game this is the only place host actions live.
 */
@Composable
fun PauseMenu(
    rows: List<PauseRow>,
    onResume: () -> Unit,
    onItem: (PauseItemSpec) -> Unit,
    onRules: () -> Unit,
    soundOn: Boolean,
    onToggleSound: () -> Unit,
    onQuit: () -> Unit,
) {
    val resume = remember { FocusRequester() }
    OverlayCard(onBack = onResume, width = 440.dp, default = resume) {
        Text(stringResource(R.string.tv__pause_title), style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Text(stringResource(R.string.tv__pause_note), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
        Spacer(Modifier.height(JamaaSpace.s5))
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(JamaaSpace.s3)) {
            val row = FocusKind.Row
            for (r in rows) {
                when (r) {
                    PauseRow.Resume -> JamaaButton(
                        stringResource(R.string.tv__resume), onResume, Modifier.fillMaxWidth().focusRequester(resume),
                        kind = ButtonKind.Primary, focusKind = row,
                    )
                    is PauseRow.GameItem -> JamaaButton(
                        keyText(r.item.labelKey),
                        { if (r.enabled) onItem(r.item) },
                        Modifier.fillMaxWidth(),
                        dimmed = !r.enabled,
                        focusKind = row,
                    )
                    PauseRow.Rules -> JamaaButton(stringResource(R.string.rules__open), onRules, Modifier.fillMaxWidth(), icon = JamaaIcons.Info, focusKind = row)
                    PauseRow.Sound -> JamaaButton(
                        stringResource(if (soundOn) R.string.tv__sound_on else R.string.tv__sound_off),
                        onToggleSound,
                        Modifier.fillMaxWidth(),
                        icon = if (soundOn) JamaaIcons.Volume else JamaaIcons.VolumeOff,
                        focusKind = row,
                    )
                    PauseRow.Quit -> JamaaButton(stringResource(R.string.tv__end_game), onQuit, Modifier.fillMaxWidth(), kind = ButtonKind.Danger, icon = JamaaIcons.DoorOut, focusKind = row)
                }
            }
        }
    }
    InitialFocus(resume)
}
