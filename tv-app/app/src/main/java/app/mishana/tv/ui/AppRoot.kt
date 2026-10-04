package app.mishana.tv.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.BuildConfig
import app.mishana.tv.R
import app.mishana.tv.game.GameViewModel
import app.mishana.tv.game.TvEvent
import app.mishana.tv.game.TvUiState
import app.mishana.tv.game.ViewEvent
import app.mishana.tv.i18n.isolate
import app.mishana.tv.i18n.messageKeyRes
import app.mishana.tv.net.ConnState
import app.mishana.tv.protocol.BackToLobby
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.GuessStatus
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.Kick
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.PlayAgain
import app.mishana.tv.protocol.TvView
import app.mishana.tv.settings.DebugPrefs
import app.mishana.tv.ui.components.DeadlineSounds
import app.mishana.tv.ui.components.FocusTrap
import app.mishana.tv.ui.components.LocalSounds
import app.mishana.tv.ui.components.TvSounds
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.components.MishBackground
import app.mishana.tv.ui.components.ProvideFrameClock
import app.mishana.tv.ui.components.StatusStage
import app.mishana.tv.ui.components.blockPointer
import app.mishana.tv.ui.components.inertWhen
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.PauseMenu
import app.mishana.tv.ui.components.StatusBanner
import app.mishana.tv.ui.components.ToastHost
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.TopBar
import app.mishana.tv.ui.screens.BlankGuessScreen
import app.mishana.tv.ui.screens.CluesScreen
import app.mishana.tv.ui.screens.DebugSettingsScreen
import app.mishana.tv.ui.screens.EliminationScreen
import app.mishana.tv.ui.screens.FatalScreen
import app.mishana.tv.ui.screens.HomeScreen
import app.mishana.tv.ui.screens.HomeStatus
import app.mishana.tv.ui.screens.LobbyScreen
import app.mishana.tv.ui.screens.ResultsScreen
import app.mishana.tv.ui.screens.RoleRevealScreen
import app.mishana.tv.ui.screens.SettingsCategory
import app.mishana.tv.ui.screens.SettingsScreen
import app.mishana.tv.ui.screens.VotingScreen
import app.mishana.tv.ui.screens.roleLabelRes
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/** Which full screen is showing; CLUES and TIE_BREAK share one screen (the tie is an overlay). */
private enum class ScreenKey { Loading, Lobby, Settings, RoleReveal, Clues, Voting, Elimination, Guess, Results }

private data class Frame(val key: ScreenKey, val view: TvView?)

private fun screenKeyFor(view: TvView?, settingsOpen: Boolean): ScreenKey = when (view?.phase) {
    null -> ScreenKey.Loading
    Phase.LOBBY -> if (settingsOpen) ScreenKey.Settings else ScreenKey.Lobby
    Phase.ROLE_REVEAL -> ScreenKey.RoleReveal
    Phase.CLUES, Phase.TIE_BREAK -> ScreenKey.Clues
    Phase.VOTING -> ScreenKey.Voting
    Phase.ELIMINATION -> ScreenKey.Elimination
    Phase.MR_WHITE_GUESS -> ScreenKey.Guess
    Phase.RESULTS -> ScreenKey.Results
}

/** Phase → screen switch, the pause overlay, Back handling, connection states and toasts (SPEC §9.3, DESIGN §7). */
@Composable
fun AppRoot(vm: GameViewModel) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val toasts = remember { ToastState() }
    var debugOpen by remember { mutableStateOf(false) }
    val sounds = remember(vm) { TvSounds(vm::playCue, vm::stopCues) }

    LaunchedEffect(vm) {
        vm.events.collect { e ->
            when (e) {
                is TvEvent.NewCode -> toasts.show(context.getString(R.string.tv__new_code, e.code), MishColors.Accent)
                is TvEvent.ServerError -> toasts.show(context.getString(messageKeyRes(e.error.messageKey)), MishColors.Danger)
                is TvEvent.Game -> showGameToast(context, toasts, e.event)
                is TvEvent.SettingsChanged -> Unit // announced by the Settings screen, which flashes the rows too
            }
        }
    }

    val s = ui
    val gv = (s as? TvUiState.InRoom)?.view
    val guessStatus = gv?.guess?.status
    val darkRoom = gv != null && gv.phase == Phase.MR_WHITE_GUESS &&
        (guessStatus == GuessStatus.PENDING || guessStatus == GuessStatus.CORRECT)
    val base by animateColorAsState(if (darkRoom) MishColors.BgDark else MishColors.Bg, tween(600), label = "roomLight")

    CompositionLocalProvider(LocalSounds provides sounds) {
        MishBackground(base = base, pattern = s !is TvUiState.InRoom) {
            // The remote's own feedback (ui.select / ui.back, and the arrow that makes a focus change tick): observed here,
            // never consumed.
            Box(
                Modifier
                    .fillMaxSize()
                    .onPreviewKeyEvent { sounds.onKey(it); false }
                    .padding(horizontal = MishSpace.SafeH, vertical = MishSpace.SafeV),
            ) {
                when (s) {
                    TvUiState.CreatingRoom -> HomeScreen(HomeStatus.Busy(R.string.tv__creating_room), vm::createRoom) { debugOpen = true }
                    is TvUiState.CreateFailed -> HomeScreen(HomeStatus.Failed(s.messageKey), vm::createRoom) { debugOpen = true }
                    is TvUiState.InRoom -> RoomRoot(s, vm, toasts) { debugOpen = true }
                    is TvUiState.Fatal -> FatalScreen(s.messageKey, vm::createRoom)
                }
                // The Lobby shows its toasts in its own header slot (never over the code, QR or grid). In a game they sit
                // at the top centre under the top bar, one at a time (clear of the stage, the strip and the action bar).
                if (toasts.screenHosts == 0) {
                    when (gv?.phase) {
                        null, Phase.LOBBY -> ToastHost(toasts, Modifier.align(Alignment.BottomStart).padding(bottom = 64.dp))
                        Phase.RESULTS -> ToastHost(toasts, Modifier.align(Alignment.TopCenter), maxItems = 1)
                        else -> ToastHost(toasts, Modifier.align(Alignment.TopCenter).padding(top = 56.dp), maxItems = 1)
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

/** Toast text for a [ViewEvent] (the diff itself lives in the ViewModel, so no event is lost to a screen change). */
private fun showGameToast(context: Context, toasts: ToastState, e: ViewEvent) {
    when (e) {
        is ViewEvent.PlayerJoined -> toasts.show(context.getString(R.string.lobby__joined, isolate(e.name)), MishColors.Success)
        is ViewEvent.PlayerLeft -> toasts.show(context.getString(R.string.lobby__left, isolate(e.name)), MishColors.TextMuted)
        is ViewEvent.PlayerAway -> toasts.show(context.getString(R.string.conn__player_away, isolate(e.name)), MishColors.Danger)
        is ViewEvent.TurnSkipped -> toasts.show(context.getString(R.string.clues__skipped, isolate(e.name)), MishColors.Danger)
        is ViewEvent.Forfeit -> toasts.show(
            context.getString(R.string.elim__forfeit, isolate(e.name), context.getString(roleLabelRes(e.role))),
            MishColors.Undercover,
        )
    }
}

@Composable
private fun RoomRoot(s: TvUiState.InRoom, vm: GameViewModel, toasts: ToastState, onOpenDebug: () -> Unit) {
    val context = LocalContext.current
    val view = s.view
    val attempt by vm.reconnectAttempt.collectAsStateWithLifecycle()
    val settingsDraft by vm.settingsDraft.collectAsStateWithLifecycle()
    val soundMuted by vm.soundMuted.collectAsStateWithLifecycle()
    var settingsOpen by remember { mutableStateOf(false) }
    var settingsCategory by remember { mutableStateOf(SettingsCategory.Game) }
    var settingsAfterPlayAgain by remember { mutableStateOf(false) }
    // TV-07: while the votes are being revealed, the top bar must not give the verdict away.
    var revealing by remember { mutableStateOf(false) }
    val reduce = MishTheme.reduceMotion
    val rise = with(LocalDensity.current) { 24.dp.roundToPx() }

    // Settings is reachable only in the lobby; leaving the lobby closes it.
    LaunchedEffect(view?.phase) {
        if (view?.phase != Phase.LOBBY) settingsOpen = false
        if (view?.phase != Phase.ELIMINATION) revealing = false
        if (view?.phase == Phase.LOBBY && settingsAfterPlayAgain) {
            settingsAfterPlayAgain = false
            settingsCategory = SettingsCategory.Game
            settingsOpen = true
        }
        if (view?.phase == Phase.LOBBY && s.paused) vm.setPaused(false)
    }

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
    val inGame = view != null && view.phase != Phase.LOBBY && view.phase != Phase.RESULTS
    val phonesAsleepNow = inGame && view.players.none { it.connected && !it.left }
    var phonesAsleep by remember { mutableStateOf(false) }
    LaunchedEffect(phonesAsleepNow) {
        phonesAsleep = false
        if (phonesAsleepNow) {
            delay(60_000)
            phonesAsleep = true
        }
    }

    // ---- Back (TV-DB): Lobby is root → exit; in a game / on Results → pause menu ----
    val activity = context.findActivity()
    val onBack: () -> Unit = { if (view?.phase == Phase.LOBBY) activity?.finish() else vm.setPaused(true) }
    BackHandler(enabled = view != null && !settingsOpen && !s.paused) { onBack() }

    // TV-13a: the stage is frozen while the socket is down; a press that cannot be sent says so instead of vanishing.
    val conn by rememberUpdatedState(s.conn)
    val send: (ClientIntent) -> Unit = { intent ->
        if (conn == ConnState.OPEN) vm.send(intent) else toasts.show(context.getString(R.string.conn__tv_reconnecting), MishColors.Danger)
    }

    // DESIGN §6.4: the last 5 s of a timer tick (then the horn); the Blank's guess beats a heartbeat.
    DeadlineSounds(view?.deadline, s.clockOffsetMs)

    val key = screenKeyFor(view, settingsOpen)
    val lostOverlay = offlineLong && view != null && degraded && !s.paused
    val overlayOpen = s.paused || lostOverlay
    Box(Modifier.fillMaxSize()) {
        CompositionLocalProvider(LocalFocusBlocked provides overlayOpen) {
            ProvideFrameClock(active = view?.deadline != null) {
                // Nothing behind an overlay can take D-pad focus (DESIGN §7: no way out of a modal but its own exits).
                Column(Modifier.fillMaxSize().inertWhen(overlayOpen)) {
                    val showTopBar = view != null && key != ScreenKey.Lobby && key != ScreenKey.Settings && key != ScreenKey.Results && key != ScreenKey.Loading
                    if (showTopBar) {
                        val hideVerdict = revealing && key == ScreenKey.Elimination
                        TopBar(
                            view,
                            degraded,
                            phaseOverride = if (hideVerdict) stringResource(R.string.vote__votes_in) else null,
                            aliveOverride = if (hideVerdict) view.players.count { (it.alive || it.id == view.eliminated?.playerId) && !it.left } else null,
                        )
                        Spacer(Modifier.height(MishSpace.s3))
                    }
                    AnimatedContent(
                        targetState = Frame(key, view),
                        contentKey = { it.key },
                        transitionSpec = {
                            if (reduce) {
                                fadeIn(tween(MishMotion.Fast)) togetherWith fadeOut(tween(MishMotion.Fast))
                            } else {
                                (fadeIn(tween(MishMotion.Slow, easing = MishMotion.Decel)) + slideInVertically(tween(MishMotion.Slow, easing = MishMotion.Decel)) { rise }) togetherWith
                                    (fadeOut(tween(MishMotion.Base, easing = MishMotion.Accel)) + scaleOut(tween(MishMotion.Base, easing = MishMotion.Accel), targetScale = 0.98f))
                            }
                        },
                        modifier = Modifier.weight(1f),
                        label = "phase",
                    ) { frame ->
                        val leaving = transition.targetState != EnterExitState.Visible
                        CompositionLocalProvider(LocalFocusBlocked provides (overlayOpen || leaving)) {
                            Box(Modifier.fillMaxSize()) {
                                val v = frame.view
                                when {
                                    v == null -> HomeScreen(HomeStatus.Busy(R.string.conn__connecting), vm::createRoom, onOpenDebug)
                                    frame.key == ScreenKey.Lobby -> LobbyScreen(v, send, { c -> settingsCategory = c; settingsOpen = true }, toasts)
                                    frame.key == ScreenKey.Settings -> SettingsScreen(
                                        view = v,
                                        draft = settingsDraft,
                                        events = vm.events,
                                        onChange = vm::changeSettings,
                                        onClose = { settingsOpen = false },
                                        initialCategory = settingsCategory,
                                        toasts = toasts,
                                        soundOn = !soundMuted,
                                        onToggleSound = { vm.setSoundMuted(!soundMuted) },
                                    )
                                    frame.key == ScreenKey.RoleReveal -> RoleRevealScreen(v, s.clockOffsetMs, send)
                                    frame.key == ScreenKey.Clues -> CluesScreen(v, s.clockOffsetMs, s.paused, send)
                                    frame.key == ScreenKey.Voting -> VotingScreen(v, s.clockOffsetMs, send)
                                    frame.key == ScreenKey.Elimination -> EliminationScreen(v, s.clockOffsetMs, s.paused, send) { revealing = it }
                                    frame.key == ScreenKey.Guess -> BlankGuessScreen(v, s.clockOffsetMs, send)
                                    frame.key == ScreenKey.Results -> ResultsScreen(
                                        v,
                                        send,
                                        onChangeSettings = {
                                            settingsAfterPlayAgain = true
                                            send(PlayAgain)
                                        },
                                        onNewRoom = vm::createRoom,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // TV-13a: the stage stays visible but frozen under a 40 % scrim (pointer clicks stop here too), with a top
            // banner and an attempt counter.
            if (degraded && view != null && !offlineLong) {
                Box(Modifier.fillMaxSize().fullBleed().background(MishColors.Bg.copy(alpha = 0.4f)).blockPointer())
                StatusBanner(
                    stringResource(R.string.conn__tv_reconnecting),
                    Modifier.align(Alignment.TopCenter),
                    spinner = true,
                    trailing = if (attempt > 0) "#$attempt" else null,
                )
            }
            // TV-13f
            AnimatedVisibility(phonesAsleep && !degraded, Modifier.align(Alignment.TopCenter), enter = fadeIn(), exit = fadeOut()) {
                StatusBanner(stringResource(R.string.conn__phones_asleep), icon = MishIcons.Phone)
            }
        }
    }

    // TV-13b: still offline after 30 s.
    if (lostOverlay) {
        ConnectionLost(onRetry = vm::retryConnectionNow, onBack = onBack)
    }

    // TV-12 pause menu.
    if (s.paused && view != null) {
        PauseMenu(
            players = view.players,
            canSkip = view.phase != Phase.RESULTS && view.phase != Phase.LOBBY,
            onResume = { vm.setPaused(false) },
            onSkip = { send(HostAdvance) },
            onKick = { p -> send(Kick(p.id)) },
            onEndGame = { send(BackToLobby) },
            onExit = { activity?.finish() },
            soundOn = !soundMuted,
            onToggleSound = { vm.setSoundMuted(!soundMuted) },
        )
    }
}

/** TV-13b full screen: wifi-off, `conn.lost`, `conn.tvLostBody`, (• Try again). Auto-retry continues underneath. */
@Composable
private fun ConnectionLost(onRetry: () -> Unit, onBack: () -> Unit) {
    Box(Modifier.fillMaxSize().fullBleed().background(MishColors.Bg.copy(alpha = 0.96f)).blockPointer()) {
        FocusTrap(onBack = onBack) {
            StatusStage(
                icon = MishIcons.WifiOff,
                tint = MishColors.Danger,
                title = stringResource(R.string.conn__lost),
                body = stringResource(R.string.conn__tv_lost_body),
                actionLabel = stringResource(R.string.common__retry),
                onAction = onRetry,
            )
        }
    }
}
