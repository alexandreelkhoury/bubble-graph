package app.mishana.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme

private enum class PausePage { Menu, Players, ConfirmEnd }

private enum class MenuItem { Resume, Skip, Players, EndGame, Exit }

/**
 * TV-12 pause menu (Back during a game or on Results). Local only: "The game keeps running" (`tv.pauseNote`).
 * Items: Resume · Skip turn/timer (HOST_ADVANCE; hidden on Results) · Players… (→ kick) · End game (confirm) · Exit.
 * Coming back from a sub-page or a confirm puts focus on the item that opened it (DESIGN §7).
 */
@Composable
fun PauseMenu(
    players: List<PublicPlayer>,
    canSkip: Boolean,
    onResume: () -> Unit,
    onSkip: () -> Unit,
    onKick: (PublicPlayer) -> Unit,
    onEndGame: () -> Unit,
    onExit: () -> Unit,
) {
    var page by remember { mutableStateOf(PausePage.Menu) }
    var lastItem by remember { mutableStateOf(MenuItem.Resume) }
    val itemFocus = remember { MenuItem.entries.associateWith { FocusRequester() } }
    // Players page: the row last picked (focus returns there, or to its neighbour once that player is gone).
    var pickedIndex by remember { mutableIntStateOf(0) }
    var kickTarget by remember { mutableStateOf<PublicPlayer?>(null) }
    // The confirm closes by itself when the picked player leaves meanwhile (it would have nothing to act on).
    val activeTarget = kickTarget?.takeIf { k -> players.any { it.id == k.id && !it.left } }

    fun open(item: MenuItem, next: PausePage) {
        lastItem = item
        page = next
    }

    when (page) {
        PausePage.Menu -> {
            val resume = itemFocus.getValue(MenuItem.Resume)
            OverlayCard(onBack = onResume, width = 440.dp, default = resume) {
                Text(stringResource(R.string.tv__pause_title), style = MishTheme.type.headline, color = MishColors.Text)
                Spacer(Modifier.height(MishSpace.s5))
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(MishSpace.s3)) {
                    fun Modifier.item(i: MenuItem) = fillMaxWidth().focusRequester(itemFocus.getValue(i))
                    MishButton(stringResource(R.string.tv__resume), onResume, Modifier.item(MenuItem.Resume), kind = ButtonKind.Primary)
                    if (canSkip) {
                        MishButton(stringResource(R.string.tv__skip), { onSkip(); onResume() }, Modifier.item(MenuItem.Skip))
                    }
                    MishButton(stringResource(R.string.tv__players), { open(MenuItem.Players, PausePage.Players) }, Modifier.item(MenuItem.Players), icon = MishIcons.Users)
                    MishButton(stringResource(R.string.tv__end_game), { open(MenuItem.EndGame, PausePage.ConfirmEnd) }, Modifier.item(MenuItem.EndGame))
                    MishButton(stringResource(R.string.tv__exit_app), onExit, Modifier.item(MenuItem.Exit), kind = ButtonKind.Danger, icon = MishIcons.DoorOut)
                }
                Spacer(Modifier.height(MishSpace.s5))
                Text(stringResource(R.string.tv__pause_note), style = MishTheme.type.caption, color = MishColors.TextMuted)
            }
            InitialFocus(itemFocus.getValue(lastItem), key = page)
        }
        PausePage.Players -> {
            val t = activeTarget
            if (t != null) {
                MishDialog(
                    title = stringResource(R.string.lobby__kick_confirm, isolate(Names.ellipsize(t.name, 20))),
                    body = null,
                    safeLabel = stringResource(R.string.common__cancel),
                    actionLabel = stringResource(R.string.lobby__kick),
                    onSafe = { kickTarget = null },
                    onAction = {
                        onKick(t)
                        kickTarget = null
                    },
                )
            } else {
                PlayersList(
                    players,
                    focusIndex = pickedIndex,
                    onBack = { page = PausePage.Menu },
                    onPick = { i, p ->
                        pickedIndex = i
                        kickTarget = p
                    },
                )
            }
        }
        PausePage.ConfirmEnd -> MishDialog(
            title = stringResource(R.string.tv__end_game_confirm),
            body = stringResource(R.string.tv__end_game_body),
            safeLabel = stringResource(R.string.tv__keep_playing),
            actionLabel = stringResource(R.string.tv__end_game),
            onSafe = { page = PausePage.Menu },
            onAction = {
                onEndGame()
                onResume()
            },
        )
    }
}

/**
 * "Players…": pick someone who left for good, so the game stops skipping their turns. Focus starts on row
 * [focusIndex] (the one picked last; its neighbour when that player is gone).
 */
@Composable
private fun PlayersList(players: List<PublicPlayer>, focusIndex: Int, onBack: () -> Unit, onPick: (Int, PublicPlayer) -> Unit) {
    val visible = players.filter { !it.left }
    val rowFocus = remember { mutableMapOf<String, FocusRequester>() }
    val back = remember { FocusRequester() }
    val start = visible.getOrNull(focusIndex.coerceAtMost(visible.lastIndex))?.let { p -> rowFocus.getOrPut(p.id) { FocusRequester() } } ?: back
    OverlayCard(onBack = onBack, width = 520.dp, default = back) {
        Text(stringResource(R.string.tv__players), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(MishSpace.s3))
        LazyColumn(
            Modifier.fillMaxWidth().heightIn(max = 346.dp).focusRestorer(start),
            contentPadding = PaddingValues(horizontal = MishFocus.ListPadH, vertical = MishFocus.ListPadV),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            itemsIndexed(visible, key = { _, p -> p.id }) { i, p ->
                MishFocusSurface(
                    onClick = { onPick(i, p) },
                    modifier = Modifier.fillMaxWidth().focusRequester(rowFocus.getOrPut(p.id) { FocusRequester() }),
                    shape = MishShapes.row,
                ) {
                    Row(Modifier.padding(horizontal = MishSpace.s4, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(p.color, 40.dp, state = AvatarState.of(p))
                        Spacer(Modifier.width(MishSpace.s4))
                        Text(
                            Names.ellipsize(p.name, 20),
                            style = MishTheme.type.titleS,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        if (!p.connected) {
                            Text(stringResource(R.string.common__away), style = MishTheme.type.caption, color = MishColors.Danger)
                        }
                        Spacer(Modifier.width(MishSpace.s3))
                        Icon(MishIcons.UserX, contentDescription = stringResource(R.string.lobby__kick), tint = MishColors.TextMuted, modifier = Modifier.size(22.dp))
                    }
                }
            }
        }
        Spacer(Modifier.height(MishSpace.s2))
        MishButton(stringResource(R.string.common__back), onBack, Modifier.focusRequester(back), icon = MishIcons.ChevronBack)
    }
    InitialFocus(start)
}
