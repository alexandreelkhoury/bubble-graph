package app.jamaa.tv.ui.hub

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.ui.res.pluralStringResource
import androidx.tv.material3.Icon
import app.jamaa.tv.games.GameView
import app.jamaa.tv.platform.GameChrome
import app.jamaa.tv.ui.platform.Chip
import app.jamaa.tv.ui.theme.JamaaShapes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.billing.InstallId
import app.jamaa.tv.game.Names
import app.jamaa.tv.i18n.LocaleController
import app.jamaa.tv.i18n.Locales
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.platform.SetupRow
import app.jamaa.tv.protocol.LockedPackInfo
import app.jamaa.tv.protocol.MemberPublic
import app.jamaa.tv.protocol.PackInfo
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.FocusKind
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaDialog
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.OverlayCard
import app.jamaa.tv.ui.rules.ChoiceSheet
import app.jamaa.tv.ui.screens.langNameRes
import app.jamaa.tv.ui.screens.uiLanguage
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

/** "Close JAMAA? The room ends for everyone" (hub Back), initial focus **Stay**. */
@Composable
fun CloseConfirm(onStay: () -> Unit, onClose: () -> Unit) = JamaaDialog(
    title = stringResource(R.string.hub__close_confirm__title),
    body = stringResource(R.string.hub__close_confirm__body),
    safeLabel = stringResource(R.string.hub__close_confirm__stay),
    actionLabel = stringResource(R.string.hub__close_confirm__close),
    onSafe = onStay,
    onAction = onClose,
)

/** Quit game → ABORT_GAME, initial focus "Keep playing". */
@Composable
fun AbortConfirm(onKeep: () -> Unit, onQuit: () -> Unit) = JamaaDialog(
    title = stringResource(R.string.tv__end_game_confirm),
    body = stringResource(R.string.tv__end_game_body),
    safeLabel = stringResource(R.string.tv__keep_playing),
    actionLabel = stringResource(R.string.tv__end_game),
    onSafe = onKeep,
    onAction = onQuit,
)

/** A member on the strip: Kick / Cancel (TV KICK is allowed by the protocol), then the confirm (initial focus Cancel). */
@Composable
fun MemberMenu(member: MemberPublic, onKick: () -> Unit, onCancel: () -> Unit) {
    val cancel = remember { FocusRequester() }
    OverlayCard(onBack = onCancel, width = 420.dp, default = cancel) {
        Character(member.color, 72.dp, app.jamaa.tv.platform.Expression.IDLE)
        Text(isolate(Names.ellipsize(member.name, 20)), style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            JamaaButton(stringResource(R.string.common__cancel), onCancel, Modifier.focusRequester(cancel), minWidth = 160.dp)
            JamaaButton(stringResource(R.string.lobby__kick), onKick, kind = ButtonKind.Danger, icon = JamaaIcons.UserX, minWidth = 160.dp)
        }
    }
    InitialFocus(cancel)
}

@Composable
fun KickConfirm(member: MemberPublic, onCancel: () -> Unit, onKick: () -> Unit) = JamaaDialog(
    title = stringResource(R.string.lobby__kick_confirm, isolate(Names.ellipsize(member.name, 20))),
    body = null,
    safeLabel = stringResource(R.string.common__cancel),
    actionLabel = stringResource(R.string.lobby__kick),
    onSafe = onCancel,
    onAction = onKick,
)

/** "Tonight's cup": the session standings (stars per member). */
@Composable
fun CupSheet(room: RoomPublic, onBack: () -> Unit) {
    val close = remember { FocusRequester() }
    ChoiceSheet(stringResource(R.string.cup__title), onBack) {
        val rows = HubModel.cupTop(room.cup, room.members, n = 12)
        if (rows.isEmpty()) Text(stringResource(R.string.cup__empty), style = JamaaTheme.type.body, color = JamaaColors.TextMuted)
        for ((m, stars) in rows) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Character(m.color, 40.dp, app.jamaa.tv.platform.Expression.IDLE)
                Text(isolate(Names.ellipsize(m.name, 16)), style = JamaaTheme.type.titleS, color = JamaaColors.Text, modifier = Modifier.width(200.dp))
                Text("★ $stars", style = JamaaTheme.type.titleS, color = JamaaColors.Accent)
            }
        }
        Spacer(Modifier.height(12.dp))
        JamaaButton(stringResource(R.string.common__close), onBack, Modifier.fillMaxWidth().focusRequester(close), kind = ButtonKind.Primary, focusKind = FocusKind.Row)
    }
    InitialFocus(close)
}

/**
 * Hub Settings (JAMAA-PLATFORM §3.2): sound, interface language, **Calm animations**, **Show how-to again**, and About
 * (version, install id for admin grants). Device settings only; nothing is sent to the room.
 */
@Composable
fun HubSettingsSheet(
    soundOn: Boolean,
    onToggleSound: () -> Unit,
    calm: Boolean,
    onToggleCalm: () -> Unit,
    onShowHowTo: () -> Unit,
    installId: String?,
    appVersion: String,
    onBack: () -> Unit,
) {
    val first = remember { FocusRequester() }
    var languages by remember { mutableStateOf(false) }
    var howToCleared by remember { mutableStateOf(false) }
    if (languages) {
        ChoiceSheet(stringResource(R.string.common__language), { languages = false }) {
            val current = uiLanguage()
            val focus = remember { FocusRequester() }
            for (tag in Locales.ALL) {
                JamaaButton(
                    stringResource(langNameRes(tag)),
                    { languages = false; if (tag != current) LocaleController.set(tag) },
                    Modifier.fillMaxWidth().then(if (tag == current) Modifier.focusRequester(focus) else Modifier),
                    kind = if (tag == current) ButtonKind.Primary else ButtonKind.Secondary,
                    icon = if (tag == current) JamaaIcons.Check else null,
                    focusKind = FocusKind.Row,
                )
            }
            InitialFocus(focus)
        }
        return
    }
    ChoiceSheet(stringResource(R.string.hub__settings), onBack) {
        val row = FocusKind.Row
        JamaaButton(
            stringResource(if (soundOn) R.string.tv__sound_on else R.string.tv__sound_off), onToggleSound,
            Modifier.fillMaxWidth().focusRequester(first), icon = if (soundOn) JamaaIcons.Volume else JamaaIcons.VolumeOff, focusKind = row,
        )
        JamaaButton(stringResource(R.string.common__language) + " · " + stringResource(langNameRes(uiLanguage())), { languages = true }, Modifier.fillMaxWidth(), icon = JamaaIcons.Globe, focusKind = row)
        JamaaButton(
            stringResource(R.string.settings__calm_motion) + " · " + stringResource(if (calm) R.string.common__on else R.string.common__off),
            onToggleCalm, Modifier.fillMaxWidth(), focusKind = row,
        )
        Text(stringResource(R.string.settings__calm_motion_help), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
        JamaaButton(stringResource(R.string.settings__show_how_to), { onShowHowTo(); howToCleared = true }, Modifier.fillMaxWidth(), icon = JamaaIcons.Refresh, focusKind = row)
        if (howToCleared) Text(stringResource(R.string.settings__show_how_to_done), style = JamaaTheme.type.caption, color = JamaaColors.Success)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.settings__app_version) + "  " + isolate(appVersion), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary)
        if (installId != null) {
            Text(stringResource(R.string.settings__install_id) + "  " + isolate(InstallId.display(installId)), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary)
            Text(stringResource(R.string.settings__install_id_help), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
        }
    }
    InitialFocus(first)
}

/** The content-language dialog (setup "Content: English ▾", a dimmed poster): only languages with content. */
@Composable
fun ContentLanguageSheet(room: RoomPublic, onPick: (String) -> Unit, onBack: () -> Unit) {
    val focus = remember { FocusRequester() }
    ChoiceSheet(stringResource(R.string.setup__content_title), onBack) {
        val langs = room.contentLocales.ifEmpty { Locales.ALL }
        for (tag in langs) {
            val current = tag == room.contentLocale
            JamaaButton(
                stringResource(langNameRes(tag)),
                { onPick(tag) },
                Modifier.fillMaxWidth().then(if (current) Modifier.focusRequester(focus) else Modifier),
                kind = if (current) ButtonKind.Primary else ButtonKind.Secondary,
                icon = if (current) JamaaIcons.Check else null,
                focusKind = FocusKind.Row,
            )
        }
    }
    if (room.contentLocale in room.contentLocales.ifEmpty { Locales.ALL }) InitialFocus(focus)
}

/**
 * The pack picker sheet (DESIGN-JAMAA §2.3.1): the game's playable packs in the content language as toggles (multi)
 * or a pick (single), then the locked ones with "Pass" (OK opens HUB-08) when billing is on.
 */
@Composable
fun PackPickerSheet(
    row: SetupRow.Packs,
    gameId: String,
    selectedIds: List<String>,
    available: List<PackInfo>,
    locked: List<LockedPackInfo>,
    contentLocale: String,
    onChange: (List<String>) -> Unit,
    onLocked: ((LockedPackInfo) -> Unit)?,
    onBack: () -> Unit,
) {
    val first = remember { FocusRequester() }
    val ui = uiLanguage()
    fun title(t: app.jamaa.tv.protocol.LocalizedTitle) = when (ui) { "fr" -> t.fr; "ar" -> t.ar; "es" -> t.es ?: t.en; else -> t.en }
    ChoiceSheet(stringResource(R.string.setup__packs), onBack) {
        val mine = available.filter { it.gameId == gameId && app.jamaa.tv.billing.Products.languageOf(it.locale) == app.jamaa.tv.billing.Products.languageOf(contentLocale) }
        val all = selectedIds.isEmpty()
        mine.forEachIndexed { i, p ->
            val on = all || p.id in selectedIds
            JamaaButton(
                title(p.title) + "  ·  " + p.pairCount,
                {
                    if (row.single) {
                        onChange(listOf(p.family))
                    } else {
                        val base = if (all) mine.map { it.id } else selectedIds
                        val next = if (p.id in base) base - p.id else base + p.id
                        if (next.isNotEmpty()) onChange(next)
                    }
                },
                Modifier.fillMaxWidth().then(if (i == 0) Modifier.focusRequester(first) else Modifier),
                kind = if (on) ButtonKind.Primary else ButtonKind.Secondary,
                icon = if (on) JamaaIcons.Check else null,
                focusKind = FocusKind.Row,
            )
        }
        if (onLocked != null) {
            for (p in locked.filter { it.gameId == gameId }) {
                JamaaButton(
                    title(p.title) + "  ·  " + stringResource(R.string.hub__pass_chip),
                    { onLocked(p) },
                    Modifier.fillMaxWidth(),
                    icon = JamaaIcons.Lock,
                    dimmed = true,
                    focusKind = FocusKind.Row,
                )
            }
        }
    }
    if (available.any { it.gameId == gameId }) InitialFocus(first)
}

/**
 * HUB-05 cup panel under a game's results: "Tonight's cup", the standings (character, name, stars) with the stars this
 * game earned (`cup.last.points`). Not focusable; the results buttons stay the only targets.
 */
@Composable
fun CupPanel(room: RoomPublic, modifier: Modifier = Modifier) {
    val rows = HubModel.cupTop(room.cup, room.members, n = 5)
    val earned = room.cup.last?.points.orEmpty()
    Column(modifier.background(JamaaColors.Surface.copy(alpha = 0.7f), JamaaShapes.tile).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(JamaaIcons.Trophy, contentDescription = null, tint = JamaaColors.Accent, modifier = Modifier.size(20.dp))
            Text(stringResource(R.string.cup__title), style = JamaaTheme.type.titleS, color = JamaaColors.Accent)
        }
        if (rows.isEmpty()) Text(stringResource(R.string.cup__empty), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
        for ((m, stars) in rows) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Character(m.color, 28.dp, app.jamaa.tv.platform.Expression.IDLE)
                Text(isolate(Names.ellipsize(m.name, 12)), style = JamaaTheme.type.label, color = JamaaColors.Text, maxLines = 1, modifier = Modifier.width(140.dp))
                Text("★ $stars", style = JamaaTheme.type.label, color = JamaaColors.Accent)
                val plus = earned[m.id] ?: 0
                if (plus > 0) Text(pluralStringResource(R.plurals.cup__stars_earned, plus, plus), style = JamaaTheme.type.caption, color = JamaaColors.Success)
            }
        }
    }
}

/**
 * A dimmed poster's dialog (HUB-02): "Change the content language?" — "{game} can be played in:" one button per room
 * content language other than the current one, then "Keep {current}" (initial focus, Back). JAMAA-GAP: `GameCard`
 * carries no per-game locale list, so every room content language is offered; picking one the game lacks leaves the
 * poster dimmed.
 */
@Composable
fun SwitchLanguageDialog(room: RoomPublic, gameTitle: String, onPick: (String) -> Unit, onKeep: () -> Unit) {
    val keep = remember { FocusRequester() }
    OverlayCard(onBack = onKeep, default = keep) {
        Text(stringResource(R.string.hub__switch_language__title), style = JamaaTheme.type.headline, color = JamaaColors.Text)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.hub__switch_language__body, isolate(gameTitle)), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary)
        Spacer(Modifier.height(16.dp))
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (tag in room.contentLocales.ifEmpty { Locales.ALL }.filter { it != room.contentLocale }) {
                JamaaButton(stringResource(langNameRes(tag)), { onPick(tag) }, Modifier.fillMaxWidth(), icon = JamaaIcons.Globe, focusKind = FocusKind.Row)
            }
            JamaaButton(
                stringResource(R.string.hub__switch_language__keep, stringResource(langNameRes(room.contentLocale))),
                onKeep,
                Modifier.fillMaxWidth().focusRequester(keep),
                kind = ButtonKind.Primary,
                focusKind = FocusKind.Row,
            )
        }
    }
    InitialFocus(keep)
}

/**
 * HUB-06 discoverability: the low-emphasis, non-focusable "◁ Back: menu & rules" hint at the top bar's end corner during
 * round 1 and for 3 s after each phase change ([GameChrome.backHintVisible]); mirrored in RTL by the auto-mirrored icon.
 */
@Composable
fun BackMenuHint(game: GameView, modifier: Modifier = Modifier) {
    val phase = game.envelope.phase
    val changedAt = remember(game.envelope.n, phase) { System.currentTimeMillis() }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(game.envelope.n, phase) {
        now = System.currentTimeMillis()
        while (now - changedAt < GameChrome.HINT_AFTER_PHASE_MS) {
            kotlinx.coroutines.delay(250)
            now = System.currentTimeMillis()
        }
    }
    val visible = GameChrome.backHintVisible(game, now - changedAt)
    androidx.compose.animation.AnimatedVisibility(visible, modifier, enter = androidx.compose.animation.fadeIn(), exit = androidx.compose.animation.fadeOut()) {
        Chip(stringResource(R.string.hint__back_menu), fill = JamaaColors.Surface.copy(alpha = 0.6f), ink = JamaaColors.TextMuted, icon = JamaaIcons.BackKey)
    }
}
