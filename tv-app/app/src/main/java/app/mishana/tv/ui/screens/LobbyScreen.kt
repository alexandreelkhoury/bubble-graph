package app.mishana.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.Constants
import app.mishana.tv.R
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.LocaleController
import app.mishana.tv.i18n.ltr
import app.mishana.tv.net.ServerUrls
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.Kick
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.Start
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.WinRule
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishDialog
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.OverlayCard
import app.mishana.tv.ui.components.PlayerTile
import app.mishana.tv.ui.components.QrCode
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.Wordmark
import app.mishana.tv.ui.components.WordmarkVariant
import app.mishana.tv.ui.components.focusFallback
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.theme.LocalIsArabic
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.launch

/** Which settings category to open (Start on an invalid config jumps to the offending one). */
enum class SettingsCategory { Game, Roles, Timers, Words }

private const val TILE_W = 120
private const val TILE_H = 96

/**
 * TV-02 Lobby (root screen). Back exits the app immediately (handled by AppRoot). Initial focus: Start if `canStart`
 * or the blocker is NOT_ENOUGH_PLAYERS, else Settings. Up from the bottom bar enters the player grid (kick).
 */
@Composable
fun LobbyScreen(
    view: TvView,
    send: (ClientIntent) -> Unit,
    onOpenSettings: (SettingsCategory) -> Unit,
    toasts: ToastState,
) {
    val type = MishTheme.type
    val startFocus = remember { FocusRequester() }
    val settingsFocus = remember { FocusRequester() }
    val gridFocus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()
    val shake = remember { Animatable(0f) }
    val density = LocalDensity.current
    var kickTarget by remember { mutableStateOf<PublicPlayer?>(null) }
    var languageOpen by remember { mutableStateOf(false) }
    val players = view.players.filter { !it.left }.sortedBy { it.seat }
    val full = players.size >= Constants.MAX_PLAYERS
    val defaultFocus = if (view.canStart || view.startBlocker == "NOT_ENOUGH_PLAYERS") startFocus else settingsFocus

    JoinLeaveToasts(players, toasts)

    val blocked = kickTarget != null || languageOpen
    CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || blocked)) {
    Row(Modifier.fillMaxSize().focusFallback(defaultFocus)) {
        // ---- start side: QR, code, host line (never focusable) ----
        Column(Modifier.width(264.dp).fillMaxHeight()) {
            Wordmark(160.dp, variant = WordmarkVariant.Latin)
            Spacer(Modifier.height(14.dp))
            Text(
                stringResource(R.string.lobby__scan_to_join),
                style = type.caption.copy(letterSpacing = if (LocalIsArabic.current) 0.sp else 0.08.em),
                color = MishColors.TextSecondary,
            )
            Spacer(Modifier.height(8.dp))
            AnimatedContent(
                targetState = full,
                transitionSpec = { fadeIn(tween(MishMotion.Slow)) togetherWith fadeOut(tween(MishMotion.Slow)) },
                label = "qrFull",
            ) { isFull ->
                if (!isFull) {
                    QrCode(view.joinUrl, description = stringResource(R.string.lobby__scan_to_join))
                } else {
                    Box(
                        Modifier.size(240.dp).background(MishColors.Surface, RoundedCornerShape(24.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(stringResource(R.string.lobby__full), style = type.headline, color = MishColors.Text, textAlign = TextAlign.Center)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            RoomCodeText(view.roomCode, dim = full)
            Spacer(Modifier.height(6.dp))
            Text(
                stringResource(R.string.lobby__or_visit, ltr(ServerUrls.displayHost(view.joinUrl))),
                style = type.body,
                color = MishColors.TextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(58.dp))
        // ---- end side: summary, grid, bottom bar ----
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    PlayerCounter(players.size)
                    val host = view.players.firstOrNull { it.id == view.hostPlayerId }
                    if (host != null) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(MishIcons.Crown, null, tint = MishColors.Accent, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                stringResource(R.string.lobby__host_is, Names.ellipsize(host.name, 16)),
                                style = type.caption,
                                color = MishColors.TextMuted,
                                maxLines = 1,
                            )
                        }
                    }
                }
                SettingsSummary(view)
            }
            Spacer(Modifier.height(10.dp))
            PlayerGrid(
                players = players,
                modifier = Modifier.focusRestorer(gridFocus),
                firstFocus = gridFocus,
                onKick = { kickTarget = it },
            )
            Spacer(Modifier.weight(1f))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MishButton(
                    stringResource(R.string.lobby__settings),
                    { onOpenSettings(SettingsCategory.Game) },
                    Modifier.focusRequester(settingsFocus),
                    icon = MishIcons.Settings,
                )
                MishButton(
                    stringResource(langNameRes(uiLanguage())),
                    { languageOpen = true },
                    icon = MishIcons.Globe,
                )
                MishButton(
                    text = stringResource(R.string.lobby__start_game),
                    onClick = {
                        when {
                            view.canStart -> send(Start)
                            view.startBlocker == "INVALID_ROLE_CONFIG" -> onOpenSettings(SettingsCategory.Roles)
                            view.startBlocker == "NO_WORDS_AVAILABLE" -> onOpenSettings(SettingsCategory.Words)
                            else -> scope.launch {
                                // NOT_ENOUGH_PLAYERS: a gentle shake (sfx.error hook: sounds are M4).
                                shake.shake(with(density) { 12.dp.toPx() })
                            }
                        }
                    },
                    modifier = Modifier
                        .focusRequester(startFocus)
                        .graphicsLayer { translationX = shake.value },
                    kind = ButtonKind.Primary,
                    icon = MishIcons.Play,
                    dimmed = !view.canStart,
                    minWidth = 200.dp,
                )
            }
        }
    }
    InitialFocus(defaultFocus)
    }

    kickTarget?.let { target ->
        MishDialog(
            title = stringResource(R.string.lobby__kick_confirm, target.name),
            body = stringResource(R.string.lobby__kick_body),
            safeLabel = stringResource(R.string.common__cancel),
            actionLabel = stringResource(R.string.lobby__kick),
            onSafe = { kickTarget = null },
            onAction = {
                send(Kick(target.id))
                kickTarget = null
            },
        )
    }
    if (languageOpen) {
        LanguagePicker(onDismiss = { languageOpen = false })
    }
}

/** The room code: always LTR, accent, 72 sp, letters tracked (DESIGN TV-02 / §3.5). */
@Composable
fun RoomCodeText(code: String, dim: Boolean = false, modifier: Modifier = Modifier) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Text(
            text = code.toCharArray().joinToString(" "),
            style = MishTheme.type.code.copy(fontSize = 72.sp, lineHeight = 80.sp),
            color = if (dim) MishColors.TextMuted else MishColors.Accent,
            modifier = modifier,
            maxLines = 1,
        )
    }
}

/** "Players 5/12" with a rolling count. */
@Composable
private fun PlayerCounter(count: Int) {
    AnimatedContent(
        targetState = count,
        transitionSpec = {
            val up = targetState > initialState
            (slideInVertically(tween(MishMotion.Base, easing = MishMotion.Decel)) { if (up) it else -it } + fadeIn(tween(MishMotion.Base))) togetherWith
                (slideOutVertically(tween(MishMotion.Base, easing = MishMotion.Accel)) { if (up) -it else it } + fadeOut(tween(MishMotion.Base)))
        },
        label = "playerCount",
    ) { n ->
        Text(
            stringResource(R.string.lobby__player_count, n, Constants.MAX_PLAYERS.toString()),
            style = MishTheme.type.label,
            color = MishColors.Text,
        )
    }
}

/** Top-end summary (2 caption lines) + the start blocker line; flashes accent when the settings change. */
@Composable
private fun SettingsSummary(view: TvView) {
    val type = MishTheme.type
    val s = view.settings
    val packs = if (s.packIds.isEmpty()) {
        stringResource(R.string.settings__all_packs)
    } else {
        val titles = s.packIds.mapNotNull { id -> view.availablePacks.firstOrNull { it.id == id } }.map { localizedTitle(it.title) }
        if (titles.isEmpty()) stringResource(R.string.settings__all_packs) else titles.take(2).joinToString(", ") + if (titles.size > 2) " +${titles.size - 2}" else ""
    }
    val line1 = packs + "  ·  " + stringResource(langNameRes(s.wordLocale))
    val rc = view.roleCounts
    val rule = stringResource(if (s.winRule == WinRule.OFFICIAL) R.string.settings__win_rule_official else R.string.settings__win_rule_parity)
    val line2 = if (rc != null) {
        stringResource(R.string.lobby__role_summary, rc.civilian.toString(), rc.undercover.toString(), rc.blank.toString()) + "  ·  " + rule
    } else {
        rule
    }
    var flash by remember { mutableStateOf(false) }
    var first by remember { mutableStateOf(true) }
    LaunchedEffect(s) {
        if (first) {
            first = false
        } else {
            flash = true
            kotlinx.coroutines.delay(600)
            flash = false
        }
    }
    val bg by animateColorAsState(if (flash) MishColors.Accent.copy(alpha = 0.18f) else Color.Transparent, tween(MishMotion.Slow), label = "flash")
    Column(
        Modifier
            .width(330.dp)
            .background(bg, RoundedCornerShape(12.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
        horizontalAlignment = Alignment.End,
    ) {
        Text(line1, style = type.caption, color = MishColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.End)
        Text(line2, style = type.caption, color = MishColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.End)
        val blocker = when (view.startBlocker) {
            "NOT_ENOUGH_PLAYERS" -> {
                val need = (Constants.MIN_PLAYERS - view.players.count { it.connected && !it.left }).coerceAtLeast(1)
                pluralStringResource(R.plurals.lobby__need_players, need, need)
            }
            "INVALID_ROLE_CONFIG" -> stringResource(R.string.lobby__blocker_roles)
            "NO_WORDS_AVAILABLE" -> stringResource(R.string.lobby__blocker_words)
            else -> null
        }
        if (blocker != null) {
            Text(
                blocker,
                style = type.caption,
                color = if (view.startBlocker == "NOT_ENOUGH_PLAYERS") MishColors.Accent else MishColors.Danger,
                maxLines = 1,
                textAlign = TextAlign.End,
            )
        }
    }
}

/** 4 × 3 grid of 120 × 96 tiles; empty slots are dashed, non-focusable, and only the first one pulses. */
@Composable
private fun PlayerGrid(
    players: List<PublicPlayer>,
    modifier: Modifier,
    firstFocus: FocusRequester,
    onKick: (PublicPlayer) -> Unit,
) {
    val known = remember { mutableStateOf(players.map { it.id }.toSet()) }
    val slots = Constants.MAX_PLAYERS
    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        for (row in 0 until 3) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                for (col in 0 until 4) {
                    val i = row * 4 + col
                    val p = players.getOrNull(i)
                    if (p != null) {
                        androidx.compose.runtime.key(p.id) {
                            val isNew = p.id !in known.value
                            JoiningTile(
                                player = p,
                                animate = isNew,
                                onShown = { known.value = known.value + p.id },
                                modifier = if (i == 0) Modifier.focusRequester(firstFocus) else Modifier,
                                onClick = { onKick(p) },
                            )
                        }
                    } else if (i < slots) {
                        EmptySlot(pulse = i == players.size)
                    }
                }
            }
        }
    }
}

/** A lobby tile; a new player's tile drops in with `spring.bouncy`, a ring bursts in their colour, and the name types on. */
@Composable
private fun JoiningTile(
    player: PublicPlayer,
    animate: Boolean,
    onShown: () -> Unit,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val reduce = MishTheme.reduceMotion
    val run = animate && !reduce
    val drop = remember { Animatable(if (run) -48f else 0f) }
    val burst = remember { Animatable(if (run) 0f else 1f) }
    val typed = remember { Animatable(if (run) 0f else 1f) }
    LaunchedEffect(Unit) {
        if (run) {
            launch { drop.animateTo(0f, MishMotion.bouncy()) }
            launch { burst.animateTo(1f, tween(600, easing = MishMotion.Decel)) }
            typed.animateTo(1f, tween((player.name.length * 45).coerceIn(200, 700)))
        }
        onShown()
    }
    val color = app.mishana.tv.ui.theme.PlayerSwatch.byId(player.color).color
    Box(modifier.offset(y = drop.value.dp)) {
        PlayerTile(
            player = player,
            width = TILE_W.dp,
            height = TILE_H.dp,
            avatarSize = 52.dp,
            state = AvatarState.of(player),
            onClick = onClick,
            nameOverride = {
                val arabic = Names.hasArabic(player.name)
                val shown = Names.ellipsize(player.name, 12)
                val text = if (arabic || typed.value >= 1f) shown else shown.take((shown.length * typed.value).toInt().coerceAtLeast(1))
                Text(
                    text = text,
                    style = MishTheme.type.titleS,
                    color = MishColors.Text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().alpha(if (arabic) typed.value else 1f),
                )
            },
        )
        if (burst.value < 1f) {
            Canvas(Modifier.size(TILE_W.dp, TILE_H.dp)) {
                val p = burst.value
                drawRoundRect(
                    color = color.copy(alpha = (1f - p) * 0.9f),
                    topLeft = androidx.compose.ui.geometry.Offset(-p * 14.dp.toPx(), -p * 14.dp.toPx()),
                    size = androidx.compose.ui.geometry.Size(size.width + p * 28.dp.toPx(), size.height + p * 28.dp.toPx()),
                    cornerRadius = CornerRadius(24.dp.toPx() + p * 8.dp.toPx()),
                    style = Stroke(width = 4.dp.toPx() * (1f - p) + 1f),
                )
            }
        }
    }
}

@Composable
private fun EmptySlot(pulse: Boolean) {
    val reduce = MishTheme.reduceMotion
    val a = if (pulse && !reduce) {
        val t = rememberInfiniteTransition(label = "slot")
        t.animateFloat(0.45f, 1f, infiniteRepeatable(tween(1_200, easing = MishMotion.Standard), RepeatMode.Reverse), label = "a").value
    } else if (pulse) {
        1f
    } else {
        0.45f
    }
    Box(Modifier.size(TILE_W.dp, TILE_H.dp).alpha(a), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            drawRoundRect(
                color = MishColors.Outline,
                cornerRadius = CornerRadius(24.dp.toPx()),
                style = Stroke(width = 2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 7.dp.toPx()))),
            )
        }
        Text("+", style = MishTheme.type.headline, color = MishColors.Outline)
    }
}

/** Toasts `lobby.joined` / `lobby.left` by diffing the player list. */
@Composable
private fun JoinLeaveToasts(players: List<PublicPlayer>, toasts: ToastState) {
    val joinedFmt = stringResource(R.string.lobby__joined, "%NAME%")
    val leftFmt = stringResource(R.string.lobby__left, "%NAME%")
    val prev = remember { mutableStateOf<Map<String, PublicPlayer>?>(null) }
    LaunchedEffect(players) {
        val before = prev.value
        val now = players.associateBy { it.id }
        if (before != null) {
            for ((id, p) in now) if (id !in before) toasts.show(joinedFmt.replace("%NAME%", app.mishana.tv.i18n.isolate(p.name)), MishColors.Success)
            for ((id, p) in before) if (id !in now) toasts.show(leftFmt.replace("%NAME%", app.mishana.tv.i18n.isolate(p.name)), MishColors.TextMuted)
        }
        prev.value = now
    }
}

/** The Language list (3 items). Changing it recreates the activity with the new per-app locale. */
@Composable
private fun LanguagePicker(onDismiss: () -> Unit) {
    val current = uiLanguage()
    val first = remember { FocusRequester() }
    OverlayCard(onBack = onDismiss, width = 420.dp) {
        Text(stringResource(R.string.common__language), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(20.dp))
        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            for (tag in LocaleController.SUPPORTED) {
                MishButton(
                    text = stringResource(langNameRes(tag)),
                    onClick = {
                        onDismiss()
                        if (tag != current) LocaleController.set(tag)
                    },
                    modifier = Modifier.fillMaxWidth().then(if (tag == current) Modifier.focusRequester(first) else Modifier),
                    kind = if (tag == current) ButtonKind.Primary else ButtonKind.Secondary,
                    icon = if (tag == current) MishIcons.Check else null,
                )
            }
        }
    }
    InitialFocus(first)
}
