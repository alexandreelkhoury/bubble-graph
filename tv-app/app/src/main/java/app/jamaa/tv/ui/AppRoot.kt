package app.jamaa.tv.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.jamaa.tv.BuildConfig
import app.jamaa.tv.R
import app.jamaa.tv.billing.Products
import app.jamaa.tv.billing.StoreEntry
import app.jamaa.tv.billing.StoreOrigin
import app.jamaa.tv.billing.StoreUiState
import app.jamaa.tv.game.BillingToast
import app.jamaa.tv.game.GameViewModel
import app.jamaa.tv.game.TvEvent
import app.jamaa.tv.game.TvUiState
import app.jamaa.tv.game.ViewEvent
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.GameScreens
import app.jamaa.tv.games.ResultsActions
import app.jamaa.tv.games.mishana.MishanaGameView
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.i18n.messageKeyRes
import app.jamaa.tv.net.ConnState
import app.jamaa.tv.platform.GateDecision
import app.jamaa.tv.platform.Overlay
import app.jamaa.tv.platform.PauseMenuModel
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.RulesContext
import app.jamaa.tv.platform.RulesOrigin
import app.jamaa.tv.platform.SetupRow
import app.jamaa.tv.platform.SetupRows
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.GuessStatus
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.RoomPhase
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.protocol.member
import app.jamaa.tv.settings.DebugPrefs
import app.jamaa.tv.ui.components.FocusTrap
import app.jamaa.tv.ui.components.JamaaBackground
import app.jamaa.tv.ui.components.JamaaDialog
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.LocalFocusBlocked
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.components.PauseMenu
import app.jamaa.tv.ui.components.StatusBanner
import app.jamaa.tv.ui.components.StatusStage
import app.jamaa.tv.ui.components.ToastHost
import app.jamaa.tv.ui.components.ToastState
import app.jamaa.tv.ui.components.TvSounds
import app.jamaa.tv.ui.components.blockPointer
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.components.inertWhen
import app.jamaa.tv.ui.hub.AbortConfirm
import app.jamaa.tv.ui.hub.BackMenuHint
import app.jamaa.tv.ui.hub.CloseConfirm
import app.jamaa.tv.ui.hub.ContentLanguageSheet
import app.jamaa.tv.ui.hub.CupPanel
import app.jamaa.tv.ui.hub.CupSheet
import app.jamaa.tv.ui.hub.HubActions
import app.jamaa.tv.ui.hub.HubScreen
import app.jamaa.tv.ui.hub.HubSettingsSheet
import app.jamaa.tv.ui.hub.KickConfirm
import app.jamaa.tv.ui.hub.MemberMenu
import app.jamaa.tv.ui.hub.PackPickerSheet
import app.jamaa.tv.ui.hub.SwitchLanguageDialog
import app.jamaa.tv.ui.hub.gameTitle
import app.jamaa.tv.ui.motion.MomentLayer
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.platform.repeats
import app.jamaa.tv.ui.rules.RulesSheet
import app.jamaa.tv.ui.screens.DebugSettingsScreen
import app.jamaa.tv.ui.screens.FakePurchaseDialog
import app.jamaa.tv.ui.screens.FatalScreen
import app.jamaa.tv.ui.screens.HomeScreen
import app.jamaa.tv.ui.screens.HomeStatus
import app.jamaa.tv.ui.screens.SettingsCategory
import app.jamaa.tv.ui.screens.SettingsScreen
import app.jamaa.tv.ui.screens.StoreRoomContext
import app.jamaa.tv.ui.screens.StoreScreen
import app.jamaa.tv.ui.screens.langNameRes
import app.jamaa.tv.ui.screens.roleLabelRes
import app.jamaa.tv.ui.setup.SetupActions
import app.jamaa.tv.ui.setup.SetupScreen
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.LocalReduceMotion
import kotlinx.coroutines.delay

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/** HUB-03 local sheets (not room state): the content-language list, a pack picker, Mish Ana!'s Advanced settings. */
private sealed interface SetupSheet {
    data object Content : SetupSheet
    data class Packs(val row: SetupRow.Packs) : SetupSheet
    data object Advanced : SetupSheet
}

/**
 * The platform root (JAMAA-PLATFORM §3): HUB-02 / HUB-03 / the game (by `room.phase`), the signature moments, the local
 * overlays (rules sheet, pause menu, confirms, hub sheets), the Pass store, connection states and toasts. Every remote
 * key passes the §3.10 E input rule first ([GameViewModel.gateKey]); INFO/MENU open the ⓘ sheet anywhere (§3.6).
 */
@Composable
fun AppRoot(vm: GameViewModel) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val motion by vm.motionMode.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val toasts = remember { ToastState() }
    var debugOpen by remember { mutableStateOf(false) }
    val sounds = remember(vm) { TvSounds(vm::playCue, vm::stopCues) }

    LaunchedEffect(vm) {
        vm.events.collect { e ->
            when (e) {
                is TvEvent.NewCode -> toasts.show(context.getString(R.string.tv__new_code, e.code), JamaaColors.Accent)
                is TvEvent.ServerError -> toasts.show(context.getString(messageKeyRes(GameViewModel.tvMessageKey(e.error))), JamaaColors.Danger)
                is TvEvent.Billing -> toasts.show(billingToastText(context, e.toast), JamaaColors.Accent)
                is TvEvent.Game -> showGameToast(context, toasts, e.event)
                is TvEvent.SettingsChanged -> Unit // announced by the Advanced settings screen, which flashes the rows too
            }
        }
    }

    val s = ui
    val mv = ((s as? TvUiState.InRoom)?.game as? MishanaGameView)?.view
    val guessStatus = mv?.guess?.status
    val darkRoom = mv != null && mv.phase == Phase.MR_WHITE_GUESS && (guessStatus == GuessStatus.PENDING || guessStatus == GuessStatus.CORRECT)
    val base by animateColorAsState(if (darkRoom) JamaaColors.BgDark else JamaaColors.Bg, tween(600), label = "roomLight")

    // §3.8: Calm animations (and a device animator scale of 0) reduce every animation that reads JamaaTheme.reduceMotion.
    CompositionLocalProvider(LocalSounds provides sounds, LocalReduceMotion provides motion.reduced) {
        JamaaBackground(base = base, pattern = s !is TvUiState.InRoom) {
            Box(
                Modifier
                    .fillMaxSize()
                    // The remote's own feedback (ui.select / ui.back, the focus tick): observed, never consumed.
                    .onPreviewKeyEvent { sounds.onKey(it); false }
                    .padding(horizontal = JamaaSpace.SafeH, vertical = JamaaSpace.SafeV),
            ) {
                when (s) {
                    TvUiState.CreatingRoom -> HomeScreen(HomeStatus.Busy(R.string.tv__creating_room), vm::createRoom) { debugOpen = true }
                    is TvUiState.CreateFailed -> HomeScreen(HomeStatus.Failed(s.messageKey), vm::createRoom) { debugOpen = true }
                    is TvUiState.InRoom -> RoomRoot(s, vm, toasts) { debugOpen = true }
                    is TvUiState.Fatal -> FatalScreen(s.messageKey, vm::createRoom)
                }
                if (toasts.screenHosts == 0) {
                    when ((s as? TvUiState.InRoom)?.view?.room?.phase) {
                        // HUB: above the members strip (the live-join toast); SETUP: bottom start, clear of Start.
                        null, RoomPhase.HUB -> ToastHost(toasts, Modifier.align(Alignment.BottomCenter).padding(bottom = 92.dp), maxItems = 1)
                        RoomPhase.SETUP -> ToastHost(toasts, Modifier.align(Alignment.BottomStart).padding(bottom = 8.dp))
                        // In game: one compact line in the top bar's band (never over the stage or the clue rule).
                        RoomPhase.PLAYING -> ToastHost(toasts, Modifier.align(Alignment.TopCenter).padding(top = 6.dp), maxWidth = 420.dp, maxItems = 1, compact = true)
                    }
                }
            }
            if (debugOpen && BuildConfig.DEBUG) {
                val prefs = remember { DebugPrefs(context) }
                DebugSettingsScreen(prefs, onClose = { debugOpen = false }, onSaved = {
                    debugOpen = false
                    vm.createRoom()
                })
            }
        }
    }
}

/** PAYMENTS-SPEC §4.4/§4.7: a billing toast's text; its one argument is bidi-isolated (a language code becomes its name). */
private fun billingToastText(context: Context, t: BillingToast): String {
    val res = messageKeyRes(t.key)
    val arg = t.arg ?: return context.getString(res)
    val value = if (t.key == "store.switchLanguage") context.getString(langNameRes(arg)) else arg
    return context.getString(res, isolate(value))
}

/** Toast text for a [ViewEvent] (the diff itself lives in the ViewModel, so no event is lost to a screen change). */
private fun showGameToast(context: Context, toasts: ToastState, e: ViewEvent) {
    when (e) {
        is ViewEvent.PlayerJoined -> toasts.show(context.getString(R.string.lobby__joined, isolate(e.name)), JamaaColors.Success)
        is ViewEvent.PlayerLeft -> toasts.show(context.getString(R.string.lobby__left, isolate(e.name)), JamaaColors.TextMuted)
        is ViewEvent.PlayerAway -> toasts.show(context.getString(R.string.conn__player_away, isolate(e.name)), JamaaColors.Danger)
        is ViewEvent.TurnSkipped -> toasts.show(context.getString(R.string.clues__skipped, isolate(e.name)), JamaaColors.Danger)
        is ViewEvent.Forfeit -> toasts.show(
            context.getString(R.string.elim__forfeit, isolate(e.name), context.getString(roleLabelRes(e.role))),
            JamaaColors.Undercover,
        )
    }
}

@Composable
private fun RoomRoot(s: TvUiState.InRoom, vm: GameViewModel, toasts: ToastState, onOpenDebug: () -> Unit) {
    val context = LocalContext.current
    val room = s.view?.room
    val game = s.game
    val attempt by vm.reconnectAttempt.collectAsStateWithLifecycle()
    val settingsDraft by vm.settingsDraft.collectAsStateWithLifecycle()
    val genericDraft by vm.genericDraft.collectAsStateWithLifecycle()
    val soundMuted by vm.soundMuted.collectAsStateWithLifecycle()
    val overlays by vm.overlays.collectAsStateWithLifecycle()
    val hubFocus by vm.focusedGameId.collectAsStateWithLifecycle()
    val moment by vm.moment.collectAsStateWithLifecycle()
    val motion by vm.motionMode.collectAsStateWithLifecycle()
    val noBilling = remember { kotlinx.coroutines.flow.MutableStateFlow(StoreUiState()) }
    val billing by (vm.billingState ?: noBilling).collectAsStateWithLifecycle()
    val noFake = remember { kotlinx.coroutines.flow.MutableStateFlow<app.jamaa.tv.billing.PurchasableOffer?>(null) }
    val fakeRequest by (vm.fakePrompt?.request ?: noFake).collectAsStateWithLifecycle()
    val installId = remember { vm.installId() }
    val launchedAt = remember(s.code) { System.currentTimeMillis() }
    var calm by remember { mutableStateOf(vm.prefs.calmMotion) }
    var setupSheet by remember { mutableStateOf<SetupSheet?>(null) }
    val billingOn = vm.billingState != null && s.billingEnabled

    // The setup's local sheets belong to one setup visit.
    LaunchedEffect(room?.phase, room?.setupGameId) { if (room?.phase != RoomPhase.SETUP) setupSheet = null }

    // ---- connection state timers (TV-13a/b/f) ----
    val degraded = s.conn != ConnState.OPEN
    var offlineLong by remember { mutableStateOf(false) }
    LaunchedEffect(degraded) {
        offlineLong = false
        if (degraded) {
            delay(30_000)
            offlineLong = true
        }
    }
    val inGame = room?.phase == RoomPhase.PLAYING && game?.envelope?.over == false
    val phonesAsleepNow = inGame && room.members.none { it.connected && !it.left && !it.benched }
    var phonesAsleep by remember { mutableStateOf(false) }
    LaunchedEffect(phonesAsleepNow) {
        phonesAsleep = false
        if (phonesAsleepNow) {
            delay(60_000)
            phonesAsleep = true
        }
    }

    val activity = context.findActivity()
    val conn by rememberUpdatedState(s.conn)
    // TV-13a: the stage is frozen while the socket is down; a press that cannot be sent says so instead of vanishing.
    val send: (ClientIntent) -> Unit = { intent ->
        if (conn == ConnState.OPEN) vm.send(intent) else toasts.show(context.getString(R.string.conn__tv_reconnecting), JamaaColors.Danger)
    }
    // §4.5 entry points: the hub Pass button, a locked pack, a locked premium setting.
    val openStore: (StoreEntry) -> Unit = { entry ->
        if (billing.billingUnavailable && entry.origin != StoreOrigin.LOBBY_BUTTON) {
            toasts.show(context.getString(R.string.store__play_unavailable), JamaaColors.Accent)
        } else {
            vm.openStore(entry)
        }
    }

    // Overlays that own focus (the game's own host dialog is drawn and focused by the game itself).
    val modal = overlays.filter { it != Overlay.HostDialog }
    val storeOpen = s.store != null && room != null && room.phase != RoomPhase.PLAYING
    val lostOverlay = offlineLong && room != null && degraded
    val overlayOpen = modal.isNotEmpty() || lostOverlay || storeOpen || setupSheet.let { it is SetupSheet.Content || it is SetupSheet.Packs }
    val hostDialogUp = overlays.any { it is Overlay.CloseConfirm || it is Overlay.AbortConfirm || it is Overlay.KickConfirm || it is Overlay.PauseItemConfirm || it is Overlay.HostDialog || it is Overlay.SwitchLanguage }

    /** ⓘ for the current screen (§3.6): hub → the last-focused game; setup → its game; in game → the game. */
    fun openRules(origin: RulesOrigin) {
        val r = room ?: return
        val o = when (r.phase) {
            RoomPhase.HUB -> Overlay.Rules(hubFocus ?: r.focusedGameId, origin, RulesContext.HUB)
            RoomPhase.SETUP -> Overlay.Rules(r.setupGameId ?: return, origin, RulesContext.SETUP)
            RoomPhase.PLAYING -> Overlay.Rules(game?.gameId ?: return, origin, RulesContext.GAME)
        }
        vm.openOverlay(o)
    }

    // ---- Back (§3.1): hub → "Close JAMAA?"; setup → CLOSE_GAME (reverse portal); in game → the pause menu ----
    val onBack: () -> Unit = {
        when (room?.phase) {
            RoomPhase.HUB -> vm.openOverlay(Overlay.CloseConfirm)
            RoomPhase.SETUP -> vm.closeGame()
            RoomPhase.PLAYING -> vm.openOverlay(Overlay.PauseMenu)
            null -> activity?.finish()
        }
    }
    BackHandler(enabled = room != null && modal.isEmpty() && !storeOpen && setupSheet == null && !lostOverlay) { onBack() }

    // §3.10 E: every key passes the input rule first. A KeyDown the gate swallows takes its KeyUp with it (a click fires
    // on the release). INFO / MENU open the rules sheet unless a host dialog needs the remote.
    val swallowed = remember { HashSet<Key>() }
    val gateModifier = Modifier.onPreviewKeyEvent { e ->
        if (e.type == KeyEventType.KeyUp) return@onPreviewKeyEvent swallowed.remove(e.key)
        if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
        val k = e.remoteKey()
        if (k == RemoteKey.INFO) {
            if (room != null && !hostDialogUp && !storeOpen && !lostOverlay) openRules(RulesOrigin.INFO_KEY)
            swallowed += e.key
            return@onPreviewKeyEvent true
        }
        when (vm.gateKey(k, e.repeats)) {
            GateDecision.CONSUME, GateDecision.COMPLETE -> {
                swallowed += e.key
                true
            }
            GateDecision.PASS, GateDecision.MOVE_ONLY -> false
        }
    }

    Box(Modifier.fillMaxSize().then(gateModifier)) {
        // While a moment plays, or an overlay is up, screens must not grab focus (InitialFocus waits for the block to lift).
        CompositionLocalProvider(LocalFocusBlocked provides (overlayOpen || moment != null)) {
            Box(Modifier.fillMaxSize().inertWhen(overlayOpen)) {
                when {
                    room == null -> HomeScreen(HomeStatus.Busy(R.string.conn__connecting), vm::createRoom, onOpenDebug)
                    room.phase == RoomPhase.HUB -> HubScreen(
                        room = room,
                        focusedGameId = hubFocus,
                        lastPlayed = vm.lastPlayedGameId,
                        launchedAt = launchedAt,
                        showPass = billingOn && !room.premium,
                        reactions = vm.reactions,
                        actions = HubActions(
                            onFocusGame = vm::focusGame,
                            onOpenGame = { card -> if (card.available) vm.openGame(card.id) else vm.openOverlay(Overlay.SwitchLanguage(card.id)) },
                            onRules = { openRules(RulesOrigin.TOP_BAR) },
                            onCup = { vm.openOverlay(Overlay.CupSheet) },
                            onPass = if (billingOn && !room.premium) ({ openStore(StoreEntry(focusProductId = null, origin = StoreOrigin.LOBBY_BUTTON)) }) else null,
                            onSettings = { vm.openOverlay(Overlay.HubSettings) },
                            onMember = { m -> vm.openOverlay(Overlay.MemberMenu(m.id)) },
                        ),
                    )
                    room.phase == RoomPhase.SETUP -> SetupRoot(
                        room, vm, setupSheet, settingsDraft, genericDraft, toasts, billingOn, soundMuted, installId,
                        onSheet = { setupSheet = it },
                        openRules = { openRules(RulesOrigin.TOP_BAR) },
                        openStore = openStore,
                        billingUnavailable = billing.billingUnavailable,
                    )
                    else -> {
                        val g = game
                        if (g == null) {
                            HomeScreen(HomeStatus.Busy(R.string.conn__connecting), vm::createRoom, onOpenDebug)
                        } else {
                            GameScreens.Render(
                                GameScreenArgs(
                                    game = g,
                                    room = room,
                                    clockOffsetMs = s.clockOffsetMs,
                                    // The pause menu and its dialogs hold reveal choreographies; the rules sheet never does (§3.6).
                                    overlayOpen = modal.any { it !is Overlay.Rules } || lostOverlay,
                                    degraded = degraded,
                                    send = send,
                                    results = ResultsActions(onReplay = vm::replay, onChangeSettings = vm::backToSetup, onOtherGames = vm::backToHub),
                                    cupPanel = { CupPanel(room) },
                                    passHook = if (billingOn && !room.premium && vm.finishedGames >= 2) stringResource(R.string.pass__results_hook) else null,
                                    onHostDialog = { up -> if (up) vm.openOverlay(Overlay.HostDialog) else vm.closeOverlay(Overlay.HostDialog) },
                                    onRules = { openRules(RulesOrigin.TOP_BAR) },
                                ),
                            )
                            if (!g.envelope.over) BackMenuHint(g, Modifier.align(Alignment.TopEnd).padding(top = 52.dp))
                        }
                    }
                }
            }
        }

        // §3.10 A/B/D: the portal, the world entrance and the cup hold, drawn over the destination screen.
        MomentLayer(moment, motion, vm::momentEnded)

        // TV-13a: the stage stays visible but frozen under a 40 % scrim, with a top banner and an attempt counter.
        if (degraded && room != null && !offlineLong) {
            Box(Modifier.fillMaxSize().fullBleed().background(JamaaColors.Bg.copy(alpha = 0.4f)).blockPointer())
            StatusBanner(
                stringResource(R.string.conn__tv_reconnecting),
                Modifier.align(Alignment.TopCenter),
                spinner = true,
                trailing = if (attempt > 0) "#$attempt" else null,
            )
        }
        // TV-13f
        AnimatedVisibility(phonesAsleep && !degraded, Modifier.align(Alignment.TopCenter), enter = fadeIn(), exit = fadeOut()) {
            // With a timer running the game is not waiting: it says so (`conn.phonesAsleepTimer`).
            val timer = (game as? MishanaGameView)?.view?.deadline != null
            StatusBanner(stringResource(if (timer) R.string.conn__phones_asleep_timer else R.string.conn__phones_asleep), icon = JamaaIcons.Phone)
        }
    }

    // ---- setup sheets (end side, local) ----
    if (room != null && room.phase == RoomPhase.SETUP) {
        val setup = vm.effectiveSetup()
        when (val sheet = setupSheet) {
            SetupSheet.Content -> ContentLanguageSheet(room, onPick = { vm.setContentLocale(it); setupSheet = null }, onBack = { setupSheet = null })
            is SetupSheet.Packs -> if (setup != null) PackPickerSheet(
                row = sheet.row,
                gameId = setup.gameId,
                selectedIds = SetupRows.selectedIds(setup, sheet.row.key),
                available = setup.availablePacks,
                locked = setup.lockedPacks,
                contentLocale = room.contentLocale,
                onChange = { ids -> vm.setPacks(sheet.row.key, ids, sheet.row.single) },
                onLocked = if (billingOn) ({ p -> openStore(StoreEntry(focusProductId = p.productId, origin = StoreOrigin.LOCKED_PACK)) }) else null,
                onBack = { setupSheet = null },
            )
            else -> Unit
        }
    }

    // ---- local overlays, bottom to top ----
    if (room != null) {
        for (o in overlays) OverlayView(o, room, s, vm, soundMuted, calm, { calm = it }, installId, ::openRules)
    }

    // PAYMENTS-SPEC §4.4 / JAMAA-PLATFORM §4.5: the Pass store (HUB or SETUP; the ViewModel closes it on PLAYING).
    val entry = s.store
    if (entry != null && room != null && room.phase != RoomPhase.PLAYING && !lostOverlay) {
        StoreScreen(
            entry = entry,
            state = billing,
            view = StoreRoomContext(room.roomCode, room.contentLocale, room.setup?.lockedPacks.orEmpty()),
            onClose = vm::closeStore,
            onRetry = vm::retryStore,
            onBuy = { productId, basePlanId -> activity?.let { vm.buy(it, productId, basePlanId) } },
            onRestore = vm::restorePurchases,
        )
    }
    // §4.8 debug fake store: the purchase "sheet", over everything like Play's own sheet.
    fakeRequest?.let { offer -> FakePurchaseDialog(offer.productId) { choice -> vm.fakePrompt?.choose(choice) } }

    // TV-13b: still offline after 30 s.
    if (lostOverlay) ConnectionLost(onRetry = vm::retryConnectionNow, onBack = onBack)
}

/** HUB-03, or Mish Ana!'s Advanced settings screen opened from it. */
@Composable
private fun SetupRoot(
    room: RoomPublic,
    vm: GameViewModel,
    sheet: SetupSheet?,
    @Suppress("UNUSED_PARAMETER") mishanaDraft: Any?, // read so a draft change recomposes the effective setup
    @Suppress("UNUSED_PARAMETER") genericDraft: Any?,
    toasts: ToastState,
    billingOn: Boolean,
    soundMuted: Boolean,
    installId: String?,
    onSheet: (SetupSheet?) -> Unit,
    openRules: () -> Unit,
    openStore: (StoreEntry) -> Unit,
    billingUnavailable: Boolean,
) {
    val setup = vm.effectiveSetup()
    val meta = GameCatalog.meta(setup?.gameId ?: room.setupGameId)
    if (setup == null || meta == null) {
        HomeScreen(HomeStatus.Busy(R.string.conn__connecting), vm::createRoom) {}
        return
    }
    val mishana = if (sheet == SetupSheet.Advanced && setup.gameId == GameIds.MISHANA) vm.mishanaSetup() else null
    if (mishana != null) {
        val draft by vm.settingsDraft.collectAsStateWithLifecycle()
        SettingsScreen(
            view = mishana,
            draft = draft,
            events = vm.events,
            onChange = vm::changeSettings,
            onClose = { onSheet(null) },
            initialCategory = SettingsCategory.Game,
            toasts = toasts,
            soundOn = !soundMuted,
            onToggleSound = { vm.setSoundMuted(!soundMuted) },
            onOpenStore = if (billingOn) openStore else null,
            billingUnavailable = billingUnavailable,
            installId = if (billingOn) installId else null,
            appVersion = BuildConfig.VERSION_NAME,
        )
        return
    }
    SetupScreen(
        room = room,
        setup = setup,
        meta = meta,
        // With billing off every premium row is open (§6.4 acceptance 7: the whole catalog plays, no Pass UI).
        column = SetupRows.column(meta, setup, room.contentLocale, room.premium || !billingOn),
        prefs = vm.prefs,
        actions = SetupActions(
            onStep = vm::stepSetting,
            onStart = vm::startGame,
            onRules = openRules,
            onContentLanguage = { onSheet(SetupSheet.Content) },
            onPacks = { onSheet(SetupSheet.Packs(it)) },
            onAdvanced = { if (setup.gameId == GameIds.MISHANA) onSheet(SetupSheet.Advanced) },
            onLockedSetting = if (billingOn) ({ openStore(StoreEntry(focusProductId = Products.PREMIUM_PRODUCT_ID, origin = StoreOrigin.LOCKED_SETTING)) }) else null,
        ),
    )
}

/** One local overlay (§3.2 HUB-06, §3.6); Back on each one is [GameViewModel.overlayBack]. */
@Composable
private fun OverlayView(
    o: Overlay,
    room: RoomPublic,
    s: TvUiState.InRoom,
    vm: GameViewModel,
    soundMuted: Boolean,
    calm: Boolean,
    onCalm: (Boolean) -> Unit,
    installId: String?,
    openRules: (RulesOrigin) -> Unit,
) {
    val activity = LocalContext.current.findActivity()
    val game = s.game
    when (o) {
        is Overlay.Rules -> RulesSheet(o, if (o.context == RulesContext.GAME) game?.envelope?.phase else null, vm::overlayBack)
        Overlay.PauseMenu -> {
            val env = game?.envelope
            PauseMenu(
                rows = PauseMenuModel.rows(GameCatalog.meta(game?.gameId), env?.phase, env?.over ?: true),
                onResume = vm::overlayBack,
                onItem = { item ->
                    if (item.confirm) {
                        vm.openOverlay(Overlay.PauseItemConfirm(item))
                    } else {
                        vm.runPauseItem(item)
                        vm.closeOverlay(Overlay.PauseMenu)
                    }
                },
                onRules = { openRules(RulesOrigin.PAUSE_MENU) },
                soundOn = !soundMuted,
                onToggleSound = { vm.setSoundMuted(!soundMuted) },
                onQuit = { vm.openOverlay(Overlay.AbortConfirm) },
            )
        }
        Overlay.AbortConfirm -> AbortConfirm(
            onKeep = vm::overlayBack,
            onQuit = {
                vm.abortGame()
                vm.closeOverlay(Overlay.AbortConfirm)
                vm.closeOverlay(Overlay.PauseMenu)
            },
        )
        is Overlay.PauseItemConfirm -> JamaaDialog(
            title = keyText(o.item.labelKey),
            body = null,
            safeLabel = stringResource(R.string.tv__keep_playing),
            actionLabel = keyText(o.item.labelKey),
            onSafe = vm::overlayBack,
            onAction = {
                vm.runPauseItem(o.item)
                vm.closeOverlay(o)
                vm.closeOverlay(Overlay.PauseMenu)
            },
        )
        Overlay.CloseConfirm -> CloseConfirm(onStay = vm::overlayBack, onClose = { activity?.finish() })
        is Overlay.MemberMenu -> {
            val m = room.member(o.memberId)
            if (m == null || m.left) {
                LaunchedEffect(o) { vm.closeOverlay(o) }
            } else {
                MemberMenu(m, onKick = { vm.closeOverlay(o); vm.openOverlay(Overlay.KickConfirm(m.id)) }, onCancel = vm::overlayBack)
            }
        }
        is Overlay.KickConfirm -> {
            val m = room.member(o.memberId)
            if (m == null || m.left) {
                LaunchedEffect(o) { vm.closeOverlay(o) }
            } else {
                KickConfirm(m, onCancel = vm::overlayBack, onKick = { vm.kick(m.id); vm.closeOverlay(o) })
            }
        }
        Overlay.HubSettings -> HubSettingsSheet(
            soundOn = !soundMuted,
            onToggleSound = { vm.setSoundMuted(!soundMuted) },
            calm = calm,
            onToggleCalm = { onCalm(!calm); vm.setCalmMotion(!calm) },
            onShowHowTo = vm::clearIntros,
            installId = if (s.billingEnabled) installId else null,
            appVersion = BuildConfig.VERSION_NAME,
            onBack = vm::overlayBack,
        )
        Overlay.CupSheet -> CupSheet(room, vm::overlayBack)
        is Overlay.SwitchLanguage -> SwitchLanguageDialog(
            room = room,
            gameTitle = gameTitle(o.gameId),
            onPick = { tag -> vm.setContentLocale(tag); vm.closeOverlay(o) },
            onKeep = vm::overlayBack,
        )
        Overlay.HostDialog -> Unit // drawn by the game screen itself
    }
}

/** TV-13b full screen: wifi-off, `conn.lost`, `conn.tvLostBody`, (• Try again). Auto-retry continues underneath. */
@Composable
private fun ConnectionLost(onRetry: () -> Unit, onBack: () -> Unit) {
    Box(Modifier.fillMaxSize().fullBleed().background(JamaaColors.Bg.copy(alpha = 0.96f)).blockPointer()) {
        FocusTrap(onBack = onBack) {
            StatusStage(
                icon = JamaaIcons.WifiOff,
                tint = JamaaColors.Danger,
                title = stringResource(R.string.conn__lost),
                body = stringResource(R.string.conn__tv_lost_body),
                actionLabel = stringResource(R.string.common__retry),
                onAction = onRetry,
            )
        }
    }
}
