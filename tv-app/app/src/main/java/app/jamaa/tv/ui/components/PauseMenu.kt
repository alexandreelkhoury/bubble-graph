package app.jamaa.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
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
 * [childOpen]: a confirm or the rules sheet is open on top of it; the menu then waits, and when it is on top again
 * focus returns to the row that opened the child (Quit → "Keep playing" lands back on Quit, DESIGN §7).
 * With a game's items the menu can hold 8 rows: they scroll inside the card (never cropped), with edge fades.
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
    childOpen: Boolean = false,
) {
    val resume = remember { FocusRequester() }
    val requesters = remember { HashMap<PauseRow, FocusRequester>() }
    val last = remember { arrayOfNulls<PauseRow>(1) }
    fun Modifier.row(r: PauseRow): Modifier = this
        .fillMaxWidth()
        .focusRequester(if (r == PauseRow.Resume) resume else requesters.getOrPut(r) { FocusRequester() })
        .onFocusChanged { if (it.isFocused) last[0] = r }
    CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || childOpen)) {
        OverlayCard(onBack = onResume, width = 440.dp, default = resume, scroll = false) {
            Text(stringResource(R.string.tv__pause_title), style = JamaaTheme.type.headline, color = JamaaColors.Text)
            Spacer(Modifier.height(JamaaSpace.s1))
            Text(stringResource(R.string.tv__pause_note), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
            Spacer(Modifier.height(JamaaSpace.s3))
            val scroll = rememberScrollState()
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .fillMaxWidth()
                    .edgeFade(top = scroll.canScrollBackward, bottom = scroll.canScrollForward, length = 32.dp)
                    .verticalScroll(scroll)
                    // Room for the focused row's ring and glow inside the scroll clip.
                    .padding(vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(JamaaSpace.s2),
            ) {
                val row = FocusKind.Row
                for (r in rows) {
                    when (r) {
                        PauseRow.Resume -> JamaaButton(
                            stringResource(R.string.tv__resume), onResume, Modifier.row(r),
                            kind = ButtonKind.Primary, focusKind = row,
                        )
                        is PauseRow.GameItem -> JamaaButton(
                            keyText(r.item.labelKey),
                            { if (r.enabled) onItem(r.item) },
                            Modifier.row(r),
                            dimmed = !r.enabled,
                            focusKind = row,
                        )
                        PauseRow.Rules -> JamaaButton(stringResource(R.string.rules__open), onRules, Modifier.row(r), icon = JamaaIcons.Info, focusKind = row)
                        PauseRow.Sound -> JamaaButton(
                            stringResource(if (soundOn) R.string.tv__sound_on else R.string.tv__sound_off),
                            onToggleSound,
                            Modifier.row(r),
                            icon = if (soundOn) JamaaIcons.Volume else JamaaIcons.VolumeOff,
                            focusKind = row,
                        )
                        PauseRow.Quit -> JamaaButton(stringResource(R.string.tv__end_game), onQuit, Modifier.row(r), kind = ButtonKind.Danger, icon = JamaaIcons.DoorOut, focusKind = row)
                    }
                }
            }
        }
        InitialFocus(resume, restore = { last[0]?.let { if (it == PauseRow.Resume) resume else requesters[it] } })
    }
}
