package app.mishana.tv.ui.screens

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.clearAndSetSemantics
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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import app.mishana.tv.ui.components.MishFocusSurface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
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
import app.mishana.tv.billing.StoreEntry
import app.mishana.tv.billing.StoreOrigin
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.LocaleController
import app.mishana.tv.i18n.Locales
import app.mishana.tv.i18n.isolate
import app.mishana.tv.net.ServerUrls
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.Kick
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.Start
import app.mishana.tv.protocol.StartBlocker
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.blocker
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
import app.mishana.tv.ui.components.ToastHost
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.FitText
import app.mishana.tv.ui.components.Wordmark
import app.mishana.tv.ui.components.WordmarkVariant
import app.mishana.tv.ui.components.focusFallback
import app.mishana.tv.ui.components.inertWhen
import app.mishana.tv.ui.components.RoomCode
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.theme.LocalIsArabic
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishRadius
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishTheme
import app.mishana.tv.ui.theme.mishTypeScale
import kotlinx.coroutines.launch

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
    /** PAYMENTS-SPEC §4.4 entry point 1; null when billing is off (no Premium button). */
    onOpenStore: ((StoreEntry) -> Unit)? = null,
) {
    val type = MishTheme.type
    val startFocus = remember { FocusRequester() }
    val settingsFocus = remember { FocusRequester() }
    val gridFocus = remember { FocusRequester() }
    val languageFocus = remember { FocusRequester() }
    val premiumFocus = remember { FocusRequester() }
    val tileFocus = remember { mutableMapOf<String, FocusRequester>() }
    val scope = rememberCoroutineScope()
    val shake = remember { Animatable(0f) }
    val density = LocalDensity.current
    var kickTarget by remember { mutableStateOf<PublicPlayer?>(null) }
    var languageOpen by remember { mutableStateOf(false) }
    val players = view.players.filter { !it.left }.sortedBy { it.seat }
    val full = players.size >= Constants.MAX_PLAYERS
    val blocker = view.blocker
    val defaultFocus = if (view.canStart || blocker == StartBlocker.NOT_ENOUGH_PLAYERS) startFocus else settingsFocus
    // The kick confirm closes by itself when that player leaves meanwhile (KICK would only come back as an error).
    val activeKick = kickTarget?.takeIf { k -> players.any { it.id == k.id } }

    // The lobby shows its toasts in its own slot (the header's host line), never over the code, QR or grid.
    DisposableEffect(toasts) {
        toasts.screenHosts++
        onDispose { toasts.screenHosts-- }
    }

    // Where focus goes back to when the kick dialog / language list (or a connection overlay) closes (DESIGN §7).
    var restoreTarget by remember { mutableStateOf<(() -> FocusRequester?)?>(null) }

    val blocked = activeKick != null || languageOpen
    CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || blocked)) {
        Row(Modifier.fillMaxSize().inertWhen(blocked).focusFallback(defaultFocus)) {
            // ---- start side: the wordmark, then one join "ticket" (caption, QR, code, host line); never focusable ----
            // Height budget (486 dp): 58 wordmark (196 dp) + 12 + ticket [12 + caption 26 (Arabic 30) + 6 + 200 QR + 8
            // + 64 code + 2 + host block ~74 + 12] = ~474. The code and host shrink to fit the ticket's inner width.
            Column(Modifier.width(LobbyMetrics.START_COLUMN_DP.dp).fillMaxHeight()) {
                Wordmark(LobbyMetrics.WORDMARK_DP.dp, variant = WordmarkVariant.Latin)
                Spacer(Modifier.height(12.dp))
                JoinTicket(view, full, Modifier.fillMaxWidth().weight(1f, fill = false))
            }
            Spacer(Modifier.width(58.dp))
            // ---- end side: summary (+ the lobby toast slot), grid, bottom bar ----
            Column(Modifier.fillMaxSize()) {
                // Settings as chips (scan in 1 s), top end; the role split only once 3 players are in (DESIGN TV-02).
                SettingsChips(view, players.size, premiumChip = view.premium && onOpenStore != null, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = 54.dp), verticalAlignment = Alignment.CenterVertically) {
                    PlayerCounter(players.size)
                    Spacer(Modifier.width(16.dp))
                    // One fixed-height slot, end side: a toast swapping in never moves the grid. Priority: the toast
                    // (3 s), then why Start is dimmed, then the host line.
                    Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                        val host = view.players.firstOrNull { it.id == view.hostPlayerId }
                        val blockerText = blockerText(view)
                        when {
                            // SPEC-GAP: DESIGN TV-02 puts the toast zone "bottom start, above the host line", which
                            // covers the room code; over the end column it would cover the grid's last row. One toast
                            // at a time takes this slot for its 3 s instead.
                            toasts.items.isNotEmpty() -> ToastHost(toasts, maxItems = 1)
                            blockerText != null -> Text(
                                blockerText,
                                style = type.label,
                                color = if (view.blocker == StartBlocker.NOT_ENOUGH_PLAYERS) MishColors.Accent else MishColors.Danger,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = TextAlign.End,
                            )
                            host != null -> Row(verticalAlignment = Alignment.CenterVertically) {
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
                }
                Spacer(Modifier.height(8.dp))
                PlayerGrid(
                    players = players,
                    modifier = Modifier.focusRestorer(gridFocus),
                    entryFocus = gridFocus,
                    tileFocus = tileFocus,
                    onKick = { p ->
                        restoreTarget = {
                            // The kicked tile if it is still there (Cancel), else the grid's last row, else Start.
                            tileFocus[p.id] ?: if (tileFocus.isNotEmpty()) gridFocus else null
                        }
                        kickTarget = p
                    },
                )
                Spacer(Modifier.weight(1f))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(LobbyMetrics.BAR_GAP_DP.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // §4.4: Premium · Settings · Language · Start. A fixed label, never swapped for premium status (the
                    // summary chip shows that). Back from the Store returns focus here.
                    if (onOpenStore != null) {
                        val open = {
                            restoreTarget = { premiumFocus }
                            onOpenStore(StoreEntry(focusProductId = null, origin = StoreOrigin.LOBBY_BUTTON))
                        }
                        if (LobbyMetrics.barVariant(uiLanguage()).premiumIconOnly) {
                            IconOnlyButton(stringResource(R.string.lobby__premium), MishIcons.Gem, open, Modifier.focusRequester(premiumFocus), tint = MishColors.Accent)
                        } else {
                            MishButton(stringResource(R.string.lobby__premium), open, Modifier.focusRequester(premiumFocus), icon = MishIcons.Gem)
                        }
                    }
                    MishButton(
                        stringResource(R.string.lobby__settings),
                        { onOpenSettings(SettingsCategory.Game) },
                        Modifier.focusRequester(settingsFocus),
                        icon = MishIcons.Settings,
                    )
                    val openLanguage = {
                        restoreTarget = { languageFocus }
                        languageOpen = true
                    }
                    if (onOpenStore != null && LobbyMetrics.barVariant(uiLanguage()).languageIconOnly) {
                        // §4.4 fit rule (PAY-GAP): with Premium in the bar, the language button keeps its globe only.
                        IconOnlyButton(stringResource(langNameRes(uiLanguage())), MishIcons.Globe, openLanguage, Modifier.focusRequester(languageFocus))
                    } else {
                        MishButton(stringResource(langNameRes(uiLanguage())), openLanguage, Modifier.focusRequester(languageFocus), icon = MishIcons.Globe)
                    }
                    MishButton(
                        text = stringResource(R.string.lobby__start_game),
                        onClick = {
                            when {
                                view.canStart -> send(Start)
                                blocker == StartBlocker.INVALID_ROLE_CONFIG -> onOpenSettings(SettingsCategory.Roles)
                                blocker == StartBlocker.NO_WORDS_AVAILABLE -> onOpenSettings(SettingsCategory.Words)
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
        InitialFocus(defaultFocus, restore = { restoreTarget?.invoke() })
    }

    activeKick?.let { target ->
        MishDialog(
            title = stringResource(R.string.lobby__kick_confirm, isolate(Names.ellipsize(target.name, 20))),
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

/**
 * PAYMENTS-SPEC §4.4 fit rule fallback: a 48 × 48 dp icon-only bar button (`gem` for Premium, never mirrored) with a
 * focus tooltip ([label]) drawn above it (outside the bar's layout, so nothing moves) and [label] as contentDescription.
 */
@Composable
private fun IconOnlyButton(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit, modifier: Modifier, tint: Color = MishColors.Text) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    Box(Modifier.size(LobbyMetrics.ICON_ONLY_DP.dp)) {
        MishFocusSurface(
            onClick = onClick,
            modifier = modifier.size(LobbyMetrics.ICON_ONLY_DP.dp).semantics { contentDescription = label },
            shape = MishShapes.pill,
            interactionSource = interaction,
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.align(Alignment.Center).size(24.dp))
        }
        if (focused) {
            Text(
                label,
                style = MishTheme.type.caption,
                color = MishColors.Text,
                maxLines = 1,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .wrapContentWidth(unbounded = true)
                    .offset(y = (-44).dp)
                    .background(MishColors.Elevated, MishShapes.pill)
                    .padding(horizontal = 12.dp, vertical = 2.dp),
            )
        }
    }
}

/** Marker substituted for `{url}` in `lobby.orVisit`, to split the sentence around the host line. */
private const val URL_MARK = "%URL%"

/**
 * "or open / mish-ana.example.workers.dev / and enter the code" (`lobby.orVisit`), centred in the ticket, the host in
 * cream Bold, the words around it muted: the host gets its own LTR line
 * that shrinks (20 → 12 dp) instead of breaking at a hyphen or ellipsizing — people type it by hand. The words
 * around it are caption lines; the host is measured first so it always shows.
 */
@Composable
private fun JoinHostBlock(joinUrl: String, modifier: Modifier) {
    val type = MishTheme.type
    val sentence = stringResource(R.string.lobby__or_visit, URL_MARK)
    val before = sentence.substringBefore(URL_MARK).trim()
    val after = sentence.substringAfter(URL_MARK, "").trim()
    val latinBody = remember { mishTypeScale(arabic = false).body.copy(lineHeight = 1.4.em) }
    // The block gets ~75 dp (what the column above leaves): Arabic captions at their 30 sp line height (2 × 30 + 28)
    // overflowed it and were clipped. 23 sp lines fit in every locale; Arabic marks draw past the box, unclipped.
    val line = type.caption.copy(lineHeight = 23.sp)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        if (before.isNotEmpty()) {
            Text(before, style = line, color = MishColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.weight(1f, fill = false))
        }
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            FitText(
                text = ServerUrls.displayHost(joinUrl),
                style = latinBody.copy(fontWeight = FontWeight.Bold),
                color = MishColors.Text,
                maxSize = LobbyMetrics.HOST_MAX_DP.dp,
                minSize = LobbyMetrics.HOST_MIN_DP.dp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
        if (after.isNotEmpty()) {
            Text(after, style = line, color = MishColors.TextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.weight(1f, fill = false))
        }
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

/** Why Start is dimmed (readable from the sofa), or null. */
@Composable
private fun blockerText(view: TvView): String? = when (view.blocker) {
    StartBlocker.NOT_ENOUGH_PLAYERS -> {
        val need = (Constants.MIN_PLAYERS - view.players.count { it.connected && !it.left }).coerceAtLeast(1)
        pluralStringResource(R.plurals.lobby__need_players, need, need)
    }
    StartBlocker.INVALID_ROLE_CONFIG -> stringResource(R.string.lobby__blocker_roles)
    StartBlocker.NO_WORDS_AVAILABLE -> stringResource(R.string.lobby__blocker_words)
    StartBlocker.UNKNOWN, null -> null
}

/**
 * Top-end settings chips (DESIGN TV-02): [Premium room] [packs] [word language] [● 4 ● 1 ● 1] with role-colour dots,
 * and the win rule only when it is not the default. The role chip waits for 3 players (a split for 0 players is
 * noise while the QR should own the screen). The row flashes accent when the settings change.
 */
@Composable
private fun SettingsChips(view: TvView, playerCount: Int, premiumChip: Boolean, modifier: Modifier = Modifier) {
    val s = view.settings
    val packs = if (s.packIds.isEmpty()) {
        stringResource(R.string.settings__all_packs)
    } else {
        val titles = s.packIds.mapNotNull { id -> view.availablePacks.firstOrNull { it.id == id } }.map { localizedTitle(it.title) }
        if (titles.isEmpty()) stringResource(R.string.settings__all_packs) else titles.take(2).joinToString(", ") + if (titles.size > 2) " +${titles.size - 2}" else ""
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
    Row(
        modifier.background(bg, MishShapes.pill),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (premiumChip) { // false while billing is off (no Store): a billing-off room projects premium:true
            // §4.4: premium status lives here (not on the Premium button).
            SummaryChip {
                Icon(MishIcons.Gem, null, tint = MishColors.Accent, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                ChipText(stringResource(R.string.lobby__premium_room), MishColors.Accent)
            }
        }
        SummaryChip(Modifier.weight(1f, fill = false)) { ChipText(packs) }
        SummaryChip { ChipText(stringResource(langNameRes(s.wordLocale))) }
        if (s.winRule != WinRule.OFFICIAL) {
            SummaryChip(Modifier.weight(1f, fill = false)) { ChipText(stringResource(R.string.settings__win_rule_parity)) }
        }
        val rc = view.roleCounts
        if (rc != null && playerCount >= ROLE_CHIP_MIN_PLAYERS) {
            val a11y = stringResource(R.string.lobby__role_summary, rc.civilian.toString(), rc.undercover.toString(), rc.blank.toString())
            SummaryChip(Modifier.semantics(mergeDescendants = true) { contentDescription = a11y }) {
                RoleCount(MishColors.Civilian, rc.civilian)
                RoleCount(MishColors.Undercover, rc.undercover, Modifier.padding(start = 10.dp))
                RoleCount(MishColors.Blank, rc.blank, Modifier.padding(start = 10.dp))
            }
        }
    }
}

private const val ROLE_CHIP_MIN_PLAYERS = 3

@Composable
private fun SummaryChip(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Row(
        modifier
            .height(36.dp)
            .background(MishColors.Text.copy(alpha = 0.07f), MishShapes.pill)
            .border(BorderStroke(1.dp, MishColors.Text.copy(alpha = 0.10f)), MishShapes.pill)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun ChipText(text: String, color: Color = MishColors.TextSecondary) {
    Text(text, style = MishTheme.type.caption.copy(fontWeight = FontWeight.Bold), color = color, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

@Composable
private fun RoleCount(color: Color, count: Int, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).background(color, CircleShape))
        Spacer(Modifier.width(6.dp))
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(count.toString(), style = MishTheme.type.caption.copy(fontWeight = FontWeight.Black), color = MishColors.Text, maxLines = 1)
        }
    }
}

/**
 * The join "ticket" (DESIGN TV-02): one surface card holding "Scan to join", the QR, the room code (accent, soft glow)
 * and the host line, so how to join reads as one object.
 */
@Composable
private fun JoinTicket(view: TvView, full: Boolean, modifier: Modifier) {
    val type = MishTheme.type
    val shape = RoundedCornerShape(28.dp)
    Column(
        modifier
            .shadow(24.dp, shape, ambientColor = Color.Black, spotColor = Color.Black)
            .background(MishColors.Surface, shape)
            // The inner highlight: a hairline of light along the top edge.
            .border(BorderStroke(1.dp, Brush.verticalGradient(0f to MishColors.Text.copy(alpha = 0.10f), 0.25f to Color.Transparent)), shape)
            .padding(horizontal = LobbyMetrics.TICKET_PAD_DP.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            stringResource(R.string.lobby__scan_to_join),
            style = type.caption.copy(letterSpacing = if (LocalIsArabic.current) 0.sp else 0.08.em, fontWeight = FontWeight.Black),
            color = MishColors.TextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(6.dp))
        AnimatedContent(
            targetState = full,
            transitionSpec = { fadeIn(tween(MishMotion.Slow)) togetherWith fadeOut(tween(MishMotion.Slow)) },
            label = "qrFull",
        ) { isFull ->
            if (!isFull) {
                QrCode(view.joinUrl, panel = LobbyMetrics.QR_DP.dp, description = stringResource(R.string.lobby__scan_to_join))
            } else {
                Box(
                    Modifier.size(LobbyMetrics.QR_DP.dp).background(MishColors.Elevated, MishShapes.tile),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(stringResource(R.string.lobby__full), style = type.headline, color = MishColors.Text, textAlign = TextAlign.Center)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        RoomCode(view.roomCode, dim = full, modifier = Modifier.fillMaxWidth(), centered = true, glow = !full)
        Spacer(Modifier.height(2.dp))
        JoinHostBlock(view.joinUrl, Modifier.fillMaxWidth())
    }
}

/** 4 × 3 grid of 120 × 96 tiles; empty slots are dashed, non-focusable, and only the first one pulses. */
@Composable
private fun PlayerGrid(
    players: List<PublicPlayer>,
    modifier: Modifier,
    entryFocus: FocusRequester,
    tileFocus: MutableMap<String, FocusRequester>,
    onKick: (PublicPlayer) -> Unit,
) {
    // Up from the bottom bar enters the LAST occupied row (DESIGN TV-02): the restorer's fallback is its first tile.
    val entryIndex = if (players.isEmpty()) 0 else ((players.size - 1) / 4) * 4
    tileFocus.keys.retainAll(players.map { it.id }.toSet()) // a kicked/left player's requester is dropped
    val known = remember { mutableStateOf(players.map { it.id }.toSet()) }
    // The newest arrival keeps a ring in their colour until the next join (it pairs with the "Karim is with us!" toast).
    val seen = remember { mutableSetOf<String>().apply { addAll(players.map { it.id }) } }
    var newest by remember { mutableStateOf<String?>(null) }
    val ids = players.map { it.id }
    LaunchedEffect(ids) {
        ids.lastOrNull { it !in seen }?.let { newest = it }
        seen.addAll(ids)
    }
    // After "Play again" the scores are the replay hook ("I'm 2 points behind"): a badge on every tile.
    val showScores = players.any { it.score > 0 }
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
                                newest = p.id == newest,
                                showScore = showScores,
                                onShown = { known.value = known.value + p.id },
                                modifier = Modifier
                                    .focusRequester(tileFocus.getOrPut(p.id) { FocusRequester() })
                                    .then(if (i == entryIndex) Modifier.focusRequester(entryFocus) else Modifier),
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
    newest: Boolean,
    showScore: Boolean,
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
    val newestAlpha by animateFloatAsState(if (newest) 1f else 0f, tween(MishMotion.Slow), label = "newest")
    Box(modifier.graphicsLayer { translationY = drop.value.dp.toPx() }) {
        if (newestAlpha > 0f) {
            // A 2 dp ring in the player's own colour + a soft colour glow, drawn around (outside) the tile.
            Canvas(Modifier.size(TILE_W.dp, TILE_H.dp)) {
                val out = 3.dp.toPx()
                val glow = 13.dp.toPx()
                drawRoundRect(
                    Brush.radialGradient(
                        listOf(color.copy(alpha = 0.32f * newestAlpha), Color.Transparent),
                        center = center,
                        radius = size.maxDimension * 0.75f,
                    ),
                    topLeft = Offset(-glow, -glow),
                    size = Size(size.width + 2 * glow, size.height + 2 * glow),
                    cornerRadius = CornerRadius(MishRadius.lg.toPx() + glow),
                )
                drawRoundRect(
                    color = color.copy(alpha = newestAlpha),
                    topLeft = Offset(-out, -out),
                    size = Size(size.width + 2 * out, size.height + 2 * out),
                    cornerRadius = CornerRadius(MishRadius.lg.toPx() + out),
                    style = Stroke(width = 2.dp.toPx()),
                )
            }
        }
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
        if (showScore) ScoreBadge(player.score, Modifier.align(Alignment.BottomEnd).offset(x = 6.dp, y = 6.dp))
    }
}

/** The player's total after a game: an accent pill with a trophy, at the tile's bottom end. */
@Composable
private fun ScoreBadge(score: Int, modifier: Modifier) {
    Row(
        modifier
            .height(28.dp)
            .background(MishColors.Accent, MishShapes.pill)
            .padding(horizontal = 8.dp)
            .clearAndSetSemantics { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(MishIcons.Trophy, contentDescription = null, tint = MishColors.Ink, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(4.dp))
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(score.toString(), style = MishTheme.type.caption.copy(fontWeight = FontWeight.Black, lineHeight = 22.sp), color = MishColors.Ink, maxLines = 1)
        }
    }
}

@Composable
private fun EmptySlot(pulse: Boolean) {
    val reduce = MishTheme.reduceMotion
    // The pulse is read in the layer only: an idle lobby never recomposes for it.
    val pulseAlpha = if (pulse && !reduce) {
        rememberInfiniteTransition(label = "slot")
            .animateFloat(0.45f, 1f, infiniteRepeatable(tween(1_200, easing = MishMotion.Standard), RepeatMode.Reverse), label = "a")
    } else {
        null
    }
    val still = if (pulse) 1f else 0.45f
    Box(Modifier.size(TILE_W.dp, TILE_H.dp).graphicsLayer { alpha = pulseAlpha?.value ?: still }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            drawRoundRect(
                color = MishColors.Outline,
                cornerRadius = CornerRadius(MishRadius.lg.toPx()),
                style = Stroke(width = 2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 7.dp.toPx()))),
            )
        }
        Text("+", style = MishTheme.type.headline, color = MishColors.Outline)
    }
}

/** The Language list (3 items). Changing it recreates the activity with the new per-app locale. */
@Composable
private fun LanguagePicker(onDismiss: () -> Unit) {
    val current = uiLanguage()
    val first = remember { FocusRequester() }
    OverlayCard(onBack = onDismiss, width = 420.dp, default = first) {
        Text(stringResource(R.string.common__language), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(20.dp))
        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            for (tag in Locales.ALL) {
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
