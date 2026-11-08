package app.jamaa.tv.ui.hub

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.net.ServerUrls
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.HubFocus
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.platform.ReactionTracker
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.TicketState
import app.jamaa.tv.platform.TopBarItem
import app.jamaa.tv.platform.Worlds
import app.jamaa.tv.protocol.GameCard
import app.jamaa.tv.protocol.MemberPublic
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.Wordmark
import app.jamaa.tv.ui.components.WordmarkVariant
import app.jamaa.tv.ui.components.tryFocus
import app.jamaa.tv.ui.platform.BarButton
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.screens.langNameRes
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage
import app.jamaa.tv.ui.platform.keyText
import kotlinx.coroutines.delay

/** What the hub screen asks the room / overlays to do. Local navigation stays inside the screen. */
class HubActions(
    val onFocusGame: (String) -> Unit,
    val onOpenGame: (GameCard) -> Unit,
    val onRules: () -> Unit,
    val onCup: () -> Unit,
    val onPass: (() -> Unit)?,
    val onSettings: () -> Unit,
    val onMember: (MemberPublic) -> Unit,
)

/**
 * HUB-02 (JAMAA-PLATFORM §3.2, DESIGN-JAMAA §2.1): top bar, the game poster carousel with the 40 % world tint, the
 * join ticket (gathering / compact) and the members strip. Remote-only: the focus graph is [HubModel.move] (wrap,
 * Up → ⓘ always, Down → the strip; RTL mirrored); Back is handled by AppRoot (the "Close JAMAA?" confirm).
 */
@Composable
fun HubScreen(
    room: RoomPublic,
    focusedGameId: String?,
    lastPlayed: String?,
    launchedAt: Long,
    showPass: Boolean,
    reactions: ReactionTracker,
    actions: HubActions,
) {
    val cards = remember(room.games) { HubModel.cards(room) }
    val strip = HubModel.strip(room)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val topBar = HubModel.topBar(HubModel.showCup(room.cup), showPass)
    var posterIndex by remember { mutableStateOf(HubModel.initialIndex(cards, lastPlayed, focusedGameId)) }
    posterIndex = posterIndex.coerceIn(0, (cards.size - 1).coerceAtLeast(0))
    var focus by remember { mutableStateOf<HubFocus>(HubFocus.Poster(posterIndex)) }
    val posterFocus = remember(cards.size) { List(cards.size) { FocusRequester() } }
    val barFocus = remember { TopBarItem.entries.associateWith { FocusRequester() } }
    val memberFocus = remember(strip.size) { List(strip.size) { FocusRequester() } }
    val focusedCard = cards.getOrNull(posterIndex)
    val world = Worlds.of(GameCatalog.meta(focusedCard?.id)?.world)

    // Gathering → compact after 60 s and 3 members; re-evaluated every second.
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1_000); now = System.currentTimeMillis() } }
    val ticket = HubModel.ticketState(strip.size, now - launchedAt)

    fun requester(f: HubFocus): FocusRequester? = when (f) {
        is HubFocus.Poster -> posterFocus.getOrNull(if (f.index < 0) posterIndex else f.index)
        is HubFocus.TopBar -> barFocus[f.item]
        is HubFocus.Member -> memberFocus.getOrNull(f.index)
    }

    Box(Modifier.fillMaxSize()) {
        WorldStage(world, tint = HubModel.WORLD_TINT)
        Column(
            Modifier
                .fillMaxSize()
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    val k = e.remoteKey()
                    if (k != RemoteKey.UP && k != RemoteKey.DOWN && k != RemoteKey.LEFT && k != RemoteKey.RIGHT) return@onPreviewKeyEvent false
                    val next = HubModel.move(focus, k, rtl, cards.size, strip.size, topBar) ?: return@onPreviewKeyEvent true
                    val resolved = if (next is HubFocus.Poster && next.index < 0) HubFocus.Poster(posterIndex) else next
                    requester(resolved)?.tryFocus()
                    true
                },
        ) {
            // ---- top bar (y 27–75)
            Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Wordmark(120.dp, variant = WordmarkVariant.Latin)
                Spacer(Modifier.weight(1f))
                for (item in topBar) {
                    val m = Modifier.focusRequester(barFocus.getValue(item)).onFocusChanged { if (it.isFocused) focus = HubFocus.TopBar(item) }
                    when (item) {
                        TopBarItem.CUP -> CupChip(room, m, actions.onCup)
                        TopBarItem.INFO -> RoundIconButton(JamaaIcons.Info, stringResource(R.string.hub__rules), actions.onRules, m)
                        TopBarItem.PASS -> BarButton(stringResource(R.string.hub__pass), { actions.onPass?.invoke() }, m, icon = JamaaIcons.Gem, accent = true)
                        TopBarItem.SETTINGS -> RoundIconButton(JamaaIcons.Settings, stringResource(R.string.hub__settings), actions.onSettings, m)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().weight(1f)) {
                // ---- carousel (x 48–688 compact, 48–640 gathering)
                Column(Modifier.weight(1f).fillMaxHeight()) {
                    Carousel(
                        cards = cards,
                        index = posterIndex,
                        room = room,
                        showPass = showPass,
                        requesters = posterFocus,
                        onFocused = { i ->
                            posterIndex = i
                            focus = HubFocus.Poster(i)
                            actions.onFocusGame(cards[i].id)
                        },
                        onOpen = actions.onOpenGame,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                    )
                    focusedCard?.let { MetaLine(it, strip.size) }
                }
                Spacer(Modifier.width(24.dp))
                JoinTicket(room, ticket)
            }
            Spacer(Modifier.height(8.dp))
            // ---- members strip (y 435–513)
            MembersStrip(strip, room, reactions, memberFocus, onFocused = { focus = HubFocus.Member(it) }, onMember = actions.onMember)
        }
    }
    posterFocus.getOrNull(posterIndex)?.let { InitialFocus(it) }
}

@Composable
private fun Carousel(
    cards: List<GameCard>,
    index: Int,
    room: RoomPublic,
    showPass: Boolean,
    requesters: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    onOpen: (GameCard) -> Unit,
    modifier: Modifier,
) {
    // The focused poster sits at the start edge + 24 dp; every poster stays composed so focus can reach it.
    val step = HubModel.POSTER_W_DP + HubModel.POSTER_GAP_DP
    val shift by animateDpAsState((-(index * step)).dp, tween(240, easing = JamaaMotion.Standard), label = "carousel")
    Box(modifier.clipToBounds(), contentAlignment = Alignment.CenterStart) {
        Row(Modifier.offset(x = shift + 24.dp), horizontalArrangement = Arrangement.spacedBy(HubModel.POSTER_GAP_DP.dp), verticalAlignment = Alignment.CenterVertically) {
            cards.forEachIndexed { i, card ->
                Poster(
                    card = card,
                    room = room,
                    showPass = showPass,
                    focused = i == index,
                    onClick = { onOpen(card) },
                    modifier = Modifier.focusRequester(requesters[i]).onFocusChanged { if (it.isFocused) onFocused(i) },
                )
            }
        }
    }
}

/** "3–12 players · 10–20 min · EN FR AR" under the focused poster; "Needs 3+" in danger when the room is short. */
@Composable
private fun MetaLine(card: GameCard, present: Int) {
    val m = HubModel.metaLine(card, present)
    val players = if (m.needs) stringResource(R.string.hub__needs_players, m.minPlayers) else stringResource(R.string.hub__players, m.minPlayers.toString(), m.maxPlayers.toString())
    val minutes = stringResource(R.string.hub__minutes, m.minMinutes.toString(), m.maxMinutes.toString())
    Row(Modifier.padding(start = 24.dp, top = 4.dp)) {
        Text(players, style = JamaaTheme.type.caption, color = if (m.needs) JamaaColors.Danger else JamaaColors.TextSecondary)
        Text("  ·  $minutes", style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary)
    }
}

@Composable
private fun CupChip(room: RoomPublic, modifier: Modifier, onClick: () -> Unit) {
    val top = HubModel.cupTop(room.cup, room.members)
    BarButton(stringResource(R.string.cup__title), onClick, modifier, icon = JamaaIcons.Trophy, accent = true) {
        Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
            for ((m, _) in top) Character(m.color, 24.dp, app.jamaa.tv.platform.Expression.IDLE)
        }
    }
}

/** The join ticket (never focusable): "Join on your phone", the QR on cream, the code, the short URL. */
@Composable
private fun JoinTicket(room: RoomPublic, state: TicketState) {
    val column by animateDpAsState(HubModel.columnDp(state).dp, tween(400, easing = JamaaMotion.Standard), label = "ticketW")
    val panel = HubModel.panelDp(state).dp
    Column(
        Modifier.width(column).fillMaxHeight().background(JamaaColors.Surface, JamaaShapes.tile).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(stringResource(R.string.hub__join_on_phone), style = JamaaTheme.type.body, color = JamaaColors.Text, textAlign = TextAlign.Center)
        QrCode(room.joinUrl, panel = panel)
        RoomCode(room.roomCode, Modifier.fillMaxWidth().height(48.dp), centered = true, glow = true)
        Text(ServerUrls.displayHost(room.joinUrl) + "/" + room.roomCode, style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1)
    }
}

/** Members as 48 dp characters with names (≤ 8 / ≤ 6 graphemes), VIP crown; OK → Kick / Cancel. */
@Composable
private fun MembersStrip(
    members: List<MemberPublic>,
    room: RoomPublic,
    reactions: ReactionTracker,
    requesters: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    onMember: (MemberPublic) -> Unit,
) {
    Row(Modifier.fillMaxWidth().height(78.dp), horizontalArrangement = Arrangement.spacedBy(0.dp), verticalAlignment = Alignment.CenterVertically) {
        if (members.isEmpty()) {
            Text(stringResource(R.string.hub__waiting_gang), style = JamaaTheme.type.body, color = JamaaColors.TextMuted)
        }
        val max = HubModel.captionGraphemes(members.size)
        members.forEachIndexed { i, m ->
            val crown = m.id == HubModel.cupLeader(room.cup)
            JamaaFocusSurface(
                onClick = { onMember(m) },
                modifier = Modifier.width(72.dp).focusRequester(requesters[i]).onFocusChanged { if (it.isFocused) onFocused(i) },
                container = androidx.compose.ui.graphics.Color.Transparent,
            ) {
                Column(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    val expression = CharacterRules.expression(m, null, reactions.activeFor(m.id, System.currentTimeMillis()))
                    Character(m.color, 48.dp, expression, state = AvatarState(host = m.isHost || crown, away = !m.connected))
                    Text(Names.ellipsize(m.name, max), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, maxLines = 1)
                }
            }
        }
    }
}

/** A game's title in the UI language (posters, setup title, rules header). */
@Composable
fun gameTitle(gameId: String): String = GameCatalog.meta(gameId)?.let { keyText(it.titleKey) } ?: gameId

/** The language name of a content locale ("Not available in Arabic yet"). */
@Composable
fun languageName(locale: String): String = stringResource(langNameRes(locale))
