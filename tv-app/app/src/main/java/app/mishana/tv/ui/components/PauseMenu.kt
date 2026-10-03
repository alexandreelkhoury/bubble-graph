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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

private enum class PausePage { Menu, Players, ConfirmEnd }

/**
 * TV-12 pause menu (Back during a game or on Results). Local only: "The game keeps running" (`tv.pauseNote`).
 * Items: Resume · Skip turn/timer (HOST_ADVANCE; hidden on Results) · Players… (→ kick) · End game (confirm) · Exit.
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
    var kickTarget by remember { mutableStateOf<PublicPlayer?>(null) }
    when (page) {
        PausePage.Menu -> {
            val resume = remember { FocusRequester() }
            OverlayCard(onBack = onResume, width = 440.dp) {
                Text(stringResource(R.string.tv__pause_title), style = MishTheme.type.headline, color = MishColors.Text)
                Spacer(Modifier.height(20.dp))
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    val full = Modifier.fillMaxWidth()
                    MishButton(stringResource(R.string.tv__resume), onResume, full.focusRequester(resume), kind = ButtonKind.Primary)
                    if (canSkip) {
                        MishButton(stringResource(R.string.tv__skip), { onSkip(); onResume() }, full)
                    }
                    MishButton(stringResource(R.string.tv__players), { page = PausePage.Players }, full, icon = MishIcons.Users)
                    MishButton(stringResource(R.string.tv__end_game), { page = PausePage.ConfirmEnd }, full)
                    MishButton(stringResource(R.string.tv__exit_app), onExit, full, kind = ButtonKind.Danger, icon = MishIcons.DoorOut)
                }
                Spacer(Modifier.height(20.dp))
                Text(stringResource(R.string.tv__pause_note), style = MishTheme.type.caption, color = MishColors.TextMuted)
            }
            LaunchedEffect(Unit) {
                withFrameNanos { }
                runCatching { resume.requestFocus() }
            }
        }
        PausePage.Players -> {
            val target = kickTarget
            if (target != null) {
                MishDialog(
                    title = stringResource(R.string.lobby__kick_confirm, isolate(Names.ellipsize(target.name, 20))),
                    body = null,
                    safeLabel = stringResource(R.string.common__cancel),
                    actionLabel = stringResource(R.string.lobby__kick),
                    onSafe = { kickTarget = null },
                    onAction = {
                        onKick(target)
                        kickTarget = null
                    },
                )
            } else {
                PlayersList(players, onBack = { page = PausePage.Menu }, onPick = { kickTarget = it })
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

/** "Players…": pick someone who left for good, so the game stops skipping their turns. */
@Composable
private fun PlayersList(players: List<PublicPlayer>, onBack: () -> Unit, onPick: (PublicPlayer) -> Unit) {
    val first = remember { FocusRequester() }
    val visible = players.filter { !it.left }
    OverlayCard(onBack = onBack, width = 520.dp) {
        Text(stringResource(R.string.tv__players), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(16.dp))
        LazyColumn(
            Modifier.fillMaxWidth().heightIn(max = 330.dp).focusRestorer(first),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(visible, key = { it.id }) { p ->
                val shape = RoundedCornerShape(18.dp)
                Surface(
                    onClick = { onPick(p) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .then(if (p.id == visible.firstOrNull()?.id) Modifier.focusRequester(first) else Modifier),
                    shape = ClickableSurfaceDefaults.shape(shape = shape),
                    colors = ClickableSurfaceDefaults.colors(
                        containerColor = MishColors.Surface,
                        contentColor = MishColors.Text,
                        focusedContainerColor = MishColors.Elevated,
                        focusedContentColor = MishColors.Text,
                    ),
                    scale = MishFocus.buttonScale(),
                    border = MishFocus.border(shape),
                    glow = MishFocus.glow(),
                ) {
                    Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(p.color, 40.dp, state = AvatarState.of(p))
                        Spacer(Modifier.width(16.dp))
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
                        Spacer(Modifier.width(12.dp))
                        androidx.tv.material3.Icon(MishIcons.UserX, contentDescription = stringResource(R.string.lobby__kick), tint = MishColors.TextMuted, modifier = Modifier.size(22.dp))
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        MishButton(stringResource(R.string.common__back), onBack, icon = MishIcons.ChevronBack)
    }
    LaunchedEffect(Unit) {
        withFrameNanos { }
        runCatching { first.requestFocus() }
    }
}
