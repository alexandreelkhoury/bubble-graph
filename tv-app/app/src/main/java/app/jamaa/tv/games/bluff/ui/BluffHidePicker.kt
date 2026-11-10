package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.bluff.BluffBoard
import app.jamaa.tv.games.bluff.BluffView
import app.jamaa.tv.games.bluff.HidePicker
import app.jamaa.tv.games.bluff.OptionLetters
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.protocol.GameIntent
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.OverlayCard
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.platform.repeats
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * The host's "Hide an answer" picker (GAME-BLUFF §5.4; pause menu → "Hide an answer"). The cards are shown exactly as
 * on the corkboard (same order, same grid, RTL mirrored) with a visible focus ring; the D-pad moves, OK sends
 * HIDE_OPTION for the focused card, Back closes. Nothing here depends on what a card is (the kind is never known).
 * JAMAA-GAP (G2): the platform pause menu sends only `{type}`; it must open this picker for [BluffTv.pauseAction]
 * `PickOptionToHide` (patch in the G2 lane C report: an overlay from AppRoot whose Back returns to the pause menu).
 * [onSend] gets the HIDE_OPTION intent, [onClose] dismisses.
 */
@Composable
fun BluffHidePicker(view: BluffView, onSend: (GameIntent) -> Unit, onClose: () -> Unit) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val picker = remember(view.options) { HidePicker(view.options.map { it.id }, rtl) } // initial focus: card 0 (A)
    val letters = OptionLetters.shared.of(view)
    var focus by remember(view.options) { mutableIntStateOf(picker.focus) }
    val root = remember { FocusRequester() }
    val type = JamaaTheme.type
    OverlayCard(onBack = onClose, width = 760.dp, default = root) {
        Text(stringResource(R.string.game__bluff__pause__hide_option_pick), style = type.headline, color = JamaaColors.Text)
        Text(pluralStringResource(R.plurals.game__bluff__pause__hides_left, view.hidesLeft, view.hidesLeft), style = type.caption, color = JamaaColors.TextMuted)
        val n = view.options.size
        val cols = BluffBoard.columns(n)
        Column(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .focusRequester(root)
                .focusable()
                .onKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onKeyEvent false
                    when (val k = e.remoteKey()) {
                        RemoteKey.UP, RemoteKey.DOWN, RemoteKey.LEFT, RemoteKey.RIGHT -> {
                            picker.move(k)
                            focus = picker.focus
                            true
                        }
                        RemoteKey.OK -> {
                            if (e.repeats == 0) picker.confirm()?.let { onSend(it); onClose() }
                            true
                        }
                        else -> false
                    }
                },
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (row in 0 until BluffBoard.rows(n)) {
                androidx.compose.runtime.CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        for (col in 0 until cols) {
                            val index = (0 until n).firstOrNull { val c = BluffBoard.cell(it, n, rtl); c.row == row && c.col == col }
                            Box(Modifier.weight(1f)) {
                                if (index != null) {
                                    val focused = index == focus
                                    // Cells are placed by visual column; each card keeps the room's direction, so its
                                    // letter badge sits at the start edge (right in RTL), as on the corkboard.
                                    androidx.compose.runtime.CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                        OptionCard(
                                            view.options[index].text,
                                            Modifier.fillMaxWidth().border(if (focused) 4.dp else 0.dp, if (focused) JamaaColors.Focus else Paper, RoundedCornerShape(14.dp)),
                                            dense = cols == 2,
                                            letter = letters[view.options[index].id] ?: OptionLetters.letterOf(index),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    InitialFocus(root)
}
