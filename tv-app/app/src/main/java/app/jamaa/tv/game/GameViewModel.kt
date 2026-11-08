package app.jamaa.tv.game

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.jamaa.tv.Constants
import app.jamaa.tv.billing.BillingEvent
import app.jamaa.tv.billing.Products
import app.jamaa.tv.billing.RoomBilling
import app.jamaa.tv.billing.StoreEntry
import app.jamaa.tv.billing.StoreOrigin
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.GameView
import app.jamaa.tv.games.PauseItemSpec
import app.jamaa.tv.games.mishana.MishanaGameView
import app.jamaa.tv.games.mishana.MishanaSetupView
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.i18n.MessageKeys
import app.jamaa.tv.net.ConnState
import app.jamaa.tv.net.CreateRoomException
import app.jamaa.tv.net.RoomConnection
import app.jamaa.tv.platform.ActiveMoment
import app.jamaa.tv.platform.GateDecision
import app.jamaa.tv.platform.InputGate
import app.jamaa.tv.platform.Moment
import app.jamaa.tv.platform.Moments
import app.jamaa.tv.platform.MotionMode
import app.jamaa.tv.platform.Overlay
import app.jamaa.tv.platform.OverlayStack
import app.jamaa.tv.platform.ReactionTracker
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.SetupRows
import app.jamaa.tv.protocol.AbortGame
import app.jamaa.tv.protocol.ActionMsg
import app.jamaa.tv.protocol.BackToHub
import app.jamaa.tv.protocol.BackToSetup
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.CloseGame
import app.jamaa.tv.protocol.CreateRoomResponse
import app.jamaa.tv.protocol.EntitlementMsg
import app.jamaa.tv.protocol.ErrorMsg
import app.jamaa.tv.protocol.GameIntent
import app.jamaa.tv.protocol.GuessStatus
import app.jamaa.tv.protocol.HubFocus
import app.jamaa.tv.protocol.Kick
import app.jamaa.tv.protocol.OpenGame
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.Replay
import app.jamaa.tv.protocol.RoomPhase
import app.jamaa.tv.protocol.RoomSetup
import app.jamaa.tv.protocol.RoomView
import app.jamaa.tv.protocol.SetContentLocale
import app.jamaa.tv.protocol.SettingsPatch
import app.jamaa.tv.protocol.StartGame
import app.jamaa.tv.protocol.StateMsg
import app.jamaa.tv.protocol.StoreOpenMsg
import app.jamaa.tv.protocol.UpdateGameSettings
import app.jamaa.tv.protocol.betweenGames
import app.jamaa.tv.settings.MemoryPlatformPrefs
import app.jamaa.tv.settings.PlatformPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlin.coroutines.cancellation.CancellationException

/** SPEC §9.8, with the platform room (JAMAA-PLATFORM §2.3/§2.5). */
sealed interface TvUiState {
    data object CreatingRoom : TvUiState
    data class CreateFailed(val messageKey: String) : TvUiState
    data class InRoom(
        val code: String,
        val joinUrl: String,
        /** The last room view (null until the first state of the socket). */
        val view: RoomView?,
        /** The active game decoded by its package, or null outside PLAYING. Unknown → UnsupportedGameView. */
        val game: GameView?,
        val conn: ConnState,
        val clockOffsetMs: Long,
        val lastError: ErrorMsg?,
        /** PAYMENTS-SPEC §4.4 / JAMAA-PLATFORM §4.5: the Pass store overlay (HUB or SETUP only), or null. */
        val store: StoreEntry? = null,
        /** The server's BILLING_ENABLED for this room (`GET /api/config`). false: no Pass UI, Store or install id. */
        val billingEnabled: Boolean = true,
    ) : TvUiState
    data class Fatal(val messageKey: String) : TvUiState
}

/** One-shot UI events (toasts). */
sealed interface TvEvent {
    /** A 4010 / 4004 between games silently re-created the room (TV-13e): toast `tv.newCode`. */
    data class NewCode(val code: String) : TvEvent

    /** Every server `error` once, even when it repeats an identical earlier one (lastError would not change). */
    class ServerError(val error: ErrorMsg) : TvEvent

    /** Join / leave / away / forfeit / skipped turn, derived from consecutive views. */
    data class Game(val event: ViewEvent) : TvEvent

    /** Someone else (the VIP) changed Mish Ana!'s setup settings: the `settings.changedBy` toast and the row flash. */
    data class SettingsChanged(val keys: Set<String>, val hostName: String?) : TvEvent

    /** A billing toast (PAYMENTS-SPEC §4.4), already past the queue rule: show it now. */
    data class Billing(val toast: BillingToast) : TvEvent
}

/** Everything platform-specific the ViewModel needs; tests pass fakes. */
class GameDeps(
    /** Effective server URL (SPEC §9.4). */
    val serverUrl: () -> String,
    /** Current app language: en | fr | ar | es (default en). */
    val appLocale: () -> String,
    /** POST /api/rooms; [entitlement] is the stored token or null (PAYMENTS-SPEC §4.3). */
    val createRoom: suspend (baseUrl: String, locale: String, entitlement: String?) -> CreateRoomResponse,
    val newConnection: (scope: CoroutineScope, serverUrl: () -> String) -> RoomConnection,
    val clock: () -> Long = { System.currentTimeMillis() },
    /** Sound cues (DESIGN §6.4); SoundPool on the device. */
    val sound: SoundSink = SoundSink.None,
    /** The persisted mute setting (hub Settings and the pause menu). */
    val loadMuted: () -> Boolean = { false },
    val saveMuted: (Boolean) -> Unit = {},
    /** The Pass / packs (PAYMENTS-SPEC §4, JAMAA-PLATFORM §4); null = no billing (free rooms only). */
    val billing: RoomBilling? = null,
    /** `GET /api/config` before each room: false = the server has billing off (no token, no billing messages or UI). */
    val billingEnabled: suspend (baseUrl: String) -> Boolean = { true },
    /** PAYMENTS-SPEC §2.1 install id, shown in Settings → About (§3.12 admin grants); null = none on this build. */
    val installId: () -> String? = { null },
    /** Per-device platform prefs: `intro_seen_<gameId>` and Calm animations (JAMAA-PLATFORM §3.2, §3.8). */
    val prefs: PlatformPrefs = MemoryPlatformPrefs(),
    /** §3.8 motion decision from the Calm animations pref (the device part — low RAM, animator scale — is bound in). */
    val motion: (calm: Boolean) -> MotionMode = { calm -> MotionMode(reduced = calm, lite = false) },
)

/** SPEC §9.8 + JAMAA-PLATFORM §3 (hub, setup, game, overlays, the input rule). */
class GameViewModel(app: Application, private val deps: GameDeps) : AndroidViewModel(app) {

    /** Used by the default ViewModel factory (AndroidViewModelFactory needs an `(Application)` constructor). */
    constructor(app: Application) : this(app, productionDeps(app))

    private val _ui = MutableStateFlow<TvUiState>(TvUiState.CreatingRoom)
    val ui: StateFlow<TvUiState> = _ui.asStateFlow()

    private val _events = MutableSharedFlow<TvEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<TvEvent> = _events.asSharedFlow()

    private val _reconnectAttempt = MutableStateFlow(0)

    /** Consecutive reconnect attempts of the current socket (TV-13a counter). */
    val reconnectAttempt: StateFlow<Int> = _reconnectAttempt.asStateFlow()

    // ---------------------------------------------------------------- platform UI state (§3)

    /** §3.10 E: the one input rule, shared by every screen (AppRoot routes every key through [gateKey]). */
    val gate = InputGate(deps.clock)

    private val overlayStack = OverlayStack()
    private val _overlays = MutableStateFlow<List<Overlay>>(emptyList())

    /** Local overlays above the current screen (top-most last); none sends anything by itself. */
    val overlays: StateFlow<List<Overlay>> = _overlays.asStateFlow()

    private val _focusedGameId = MutableStateFlow<String?>(null)

    /** The hub carousel's local focus (instant; the server's `focusedGameId` follows after the debounce). */
    val focusedGameId: StateFlow<String?> = _focusedGameId.asStateFlow()
    private var hubFocusJob: Job? = null
    private var hubFocusSent: String? = null

    private val _moment = MutableStateFlow<ActiveMoment?>(null)

    /** The signature moment playing now (portal, entrance, cup), or null. OK completes it ([ActiveMoment.completed]). */
    val moment: StateFlow<ActiveMoment?> = _moment.asStateFlow()
    private var momentSeq = 0

    /** Games whose portal already played in this room session (1 100 ms the first time, 700 ms afterwards). */
    private val portalsPlayed = HashSet<String>()

    /** The last game played in this room (hub initial focus). */
    var lastPlayedGameId: String? = null
        private set

    private val _motion = MutableStateFlow(deps.motion(deps.prefs.calmMotion))

    /** §3.8 reduced / lite motion. */
    val motionMode: StateFlow<MotionMode> = _motion.asStateFlow()

    /** Characters' reactions (keyed by `reaction.n`, §3.7). */
    val reactions = ReactionTracker()

    val prefs: PlatformPrefs get() = deps.prefs

    // ---------------------------------------------------------------- settings drafts (TV-03)

    private val draft = SettingsDraft()
    private val _settingsDraft = MutableStateFlow<SettingsPatch?>(null)

    /** Mish Ana!'s optimistic settings overlay (TV-03), shown over the server settings until the server echoes it. */
    val settingsDraft: StateFlow<SettingsPatch?> = _settingsDraft.asStateFlow()
    private var draftJob: Job? = null

    private val _genericDraft = MutableStateFlow<JsonObject?>(null)

    /** Other games' optimistic setup patch (same debounce and fallback as [settingsDraft]). */
    val genericDraft: StateFlow<JsonObject?> = _genericDraft.asStateFlow()
    private var genericDraftGame: String? = null
    private var genericJob: Job? = null

    private var connection: RoomConnection? = null
    private var roomJobs: List<Job> = emptyList()
    private var createJob: Job? = null
    private var lastSeq = -1L
    private var actionCounter = 0L
    private val clockOffset = ClockOffset()

    private val _soundMuted = MutableStateFlow(deps.loadMuted())

    /** The TV's global mute (a device setting, never sent to the server). */
    val soundMuted: StateFlow<Boolean> = _soundMuted.asStateFlow()

    private val billing = deps.billing

    /** The process-wide Store state (PAYMENTS-SPEC §4.4), or null when billing is off. */
    val billingState: StateFlow<app.jamaa.tv.billing.StoreUiState>? = billing?.state

    /** §4.8: the debug fake store's purchase dialog, when active. */
    val fakePrompt: app.jamaa.tv.billing.FakePurchasePrompt? get() = billing?.fakePrompt
    private val toastQueue = BillingToastQueue()
    private val lobbyNotices = LobbyNotices()

    /** Finished games in this room session (the results soft line "Love it? …" waits for the 2nd, §4.5). */
    var finishedGames: Int = 0
        private set

    /** The newest token not yet sent to the room (sent after the first state following hello). */
    private var pendingToken: String? = null

    /** The last `storeOpen` value sent on the current room, or null if none (or lost to RATE_LIMITED). */
    private var storeOpenSent: Boolean? = null

    /** The 4-min `storeOpen:true` keepalive; runs while the server is told the TV is busy. */
    private var storeOpenJob: Job? = null

    /** A debounced `storeOpen:false` ([STORE_CLOSE_DEBOUNCE_MS]): close then reopen quickly sends nothing. */
    private var storeCloseJob: Job? = null

    /**
     * Billing sends not yet known to have passed the server's per-connection cap (§3.9: entitlement + storeOpen share
     * 6/min, and a capped one only gets a ref-less RATE_LIMITED). `conn.send()` success means queued locally, not
     * accepted, so the newest token and the time of each send stay here for [BILLING_RATE_WINDOW_MS].
     */
    private var lastTokenSent: String? = null
    private var lastTokenSentAt = Long.MIN_VALUE / 2
    private var lastStoreOpenSentAt = Long.MIN_VALUE / 2
    private var billingRetryJob: Job? = null
    private var storeOpenRetry = false

    /** The server's BILLING_ENABLED, read before each room is created (fail closed). */
    private var billingOn = true

    init {
        billing?.let { b ->
            viewModelScope.launch { b.events.collect { onBillingEvent(it) } }
            viewModelScope.launch { b.state.map { it.busy }.distinctUntilChanged().collect { onBusyChanged(it) } }
        }
        createRoom()
    }

    /** POST /api/rooms in the current app language, then connect (SPEC §9.8). */
    fun createRoom() = createRoomInternal(announceNewCode = false)

    private fun createRoomInternal(announceNewCode: Boolean) {
        teardownRoom()
        createJob?.cancel()
        _ui.value = TvUiState.CreatingRoom
        createJob = viewModelScope.launch {
            val resp = try {
                billingOn = try { deps.billingEnabled(deps.serverUrl()) } catch (e: CancellationException) { throw e } catch (e: Exception) { false }
                deps.createRoom(deps.serverUrl(), deps.appLocale(), if (billingOn) billing?.tokenForCreate() else null)
            } catch (e: CancellationException) {
                throw e
            } catch (e: CreateRoomException) {
                _ui.value = TvUiState.CreateFailed(e.errorCode?.let { errorMessageKey(it) } ?: MessageKeys.TV_CREATE_FAILED)
                return@launch
            } catch (e: Exception) {
                _ui.value = TvUiState.CreateFailed(MessageKeys.TV_CREATE_FAILED)
                return@launch
            }
            openRoom(resp)
            if (billingOn) billing?.onCreateRoomEntitlement(resp.entitlement)
            if (announceNewCode) _events.tryEmit(TvEvent.NewCode(resp.code))
        }
    }

    private fun openRoom(resp: CreateRoomResponse) {
        val conn = deps.newConnection(viewModelScope, deps.serverUrl)
        connection = conn
        lastSeq = -1L
        clockOffset.clear()
        _ui.value = TvUiState.InRoom(
            code = resp.code,
            joinUrl = resp.joinUrl,
            view = null,
            game = null,
            conn = ConnState.CONNECTING,
            clockOffsetMs = 0L,
            lastError = null,
            billingEnabled = billingOn,
        )
        // Subscribe before connecting so nothing is missed.
        roomJobs = listOf(
            viewModelScope.launch { conn.incoming.collect { msg -> if (connection === conn) onMessage(msg) } },
            viewModelScope.launch { conn.state.collect { st -> if (connection === conn) onConnState(st) } },
            viewModelScope.launch { conn.attempt.collect { a -> if (connection === conn) _reconnectAttempt.value = a } },
        )
        conn.connect(resp.code, resp.tvToken) // tvToken lives in memory only
        lobbyNotices.reset()
        storeOpenSent = null
        billing?.setInRoom(true)
    }

    private fun teardownRoom() {
        if ((_ui.value as? TvUiState.InRoom)?.store != null) billing?.closeStore()
        billing?.setInRoom(false)
        storeOpenJob?.cancel()
        storeOpenJob = null
        storeCloseJob?.cancel()
        storeCloseJob = null
        billingRetryJob?.cancel()
        billingRetryJob = null
        storeOpenRetry = false
        lastTokenSent = null
        lastTokenSentAt = Long.MIN_VALUE / 2
        lastStoreOpenSentAt = Long.MIN_VALUE / 2
        roomJobs.forEach { it.cancel() }
        roomJobs = emptyList()
        connection?.disconnect()
        connection = null
        _reconnectAttempt.value = 0
        draftJob?.cancel()
        draft.clear()
        _settingsDraft.value = null
        genericJob?.cancel()
        _genericDraft.value = null
        genericDraftGame = null
        hubFocusJob?.cancel()
        hubFocusJob = null
        hubFocusSent = null
        _focusedGameId.value = null
        portalsPlayed.clear()
        lastPlayedGameId = null
        finishedGames = 0
        overlayStack.clear()
        publishOverlays()
        _moment.value = null
        gate.reset()
        reactions.reset()
    }

    private fun onMessage(msg: app.jamaa.tv.protocol.ServerMessage) {
        when (msg) {
            is StateMsg -> {
                // Drop only older frames: the server's meta-only broadcasts (premium, lockedPacks, tvBusy, the hub focus)
                // reuse the room version as `seq`, and frames on one socket arrive in order, so an equal seq is a newer
                // frame (PAYMENTS-SPEC §3.11).
                if (msg.seq < lastSeq) return
                val firstOfSocket = lastSeq < 0
                lastSeq = msg.seq
                val offset = clockOffset.add(msg.serverNow, deps.clock())
                val current = _ui.value as? TvUiState.InRoom ?: return
                val before = current.view
                val beforeGame = current.game
                val after = msg.view
                val game = after.game?.let { GameDecoders.decode(it, after.room) }
                // The Store opens only between games in HUB/SETUP; entering a game closes it (the purchase flow goes on).
                val leaveStore = current.store != null && after.room.phase == RoomPhase.PLAYING
                _ui.value = current.copy(view = after, game = game, clockOffsetMs = offset, store = if (leaveStore) null else current.store)
                if (leaveStore) billing?.closeStore()
                if (firstOfSocket) onSessionReady()
                onRoomTransition(before, after, game)
                announce(before, beforeGame, after, game)
                if (billing != null && billingOn) {
                    for (key in lobbyNotices.onView(before, after)) showBillingToast(BillingToast(key))
                    toastQueue.flush(storeOpen(), after.betweenGames)?.let { _events.tryEmit(TvEvent.Billing(it)) }
                }
            }
            is ErrorMsg -> {
                if (msg.code == "TV_BUSY") return // never expected on the TV (the Store covers Start)
                // TV-13e: the fatal close that follows re-creates the room silently; no red toast first.
                if (msg.code in RECREATE_ERROR_CODES && recreatesRoom(currentView())) return
                // A cap hit on our own entitlement/storeOpen (§3.9, 6/min per TV connection): retried, no toast.
                if (msg.code == "RATE_LIMITED" && msg.ref == null && onBillingRateLimited()) return
                _ui.update { s -> if (s is TvUiState.InRoom) s.copy(lastError = msg) else s }
                if (_ui.value is TvUiState.InRoom) {
                    _events.tryEmit(TvEvent.ServerError(msg))
                    playCue(CuePlay(Cue.ERROR))
                }
                // OPEN_GAME refused (GAME_UNAVAILABLE…) while our portal plays: the hub stays (the portal is dropped).
                val m = _moment.value
                if (m != null && m.moment.id in OPEN_PORTALS && currentView()?.room?.phase == RoomPhase.HUB) {
                    _moment.value = null
                    gate.reset()
                    gate.becameInteractive()
                }
            }
            else -> Unit // welcome/pong are not for the TV
        }
    }

    /** §3.10: the moments each room transition plays, the overlay hygiene, and the per-device intro state. */
    private fun onRoomTransition(before: RoomView?, after: RoomView, game: GameView?) {
        val from = before?.room?.phase
        val to = after.room.phase
        val reduced = _motion.value.reduced
        if (_focusedGameId.value == null) _focusedGameId.value = after.room.focusedGameId
        if (after.room.focusedGameId == hubFocusSent || to != RoomPhase.HUB) hubFocusSent = null
        if (from != to) {
            // Overlays belong to the screen they opened on: entering a game closes them all; leaving one closes the
            // game's menus; hub ↔ setup closes the rules sheet and the hub dialogs.
            overlayStack.closeAll { o ->
                when {
                    to == RoomPhase.PLAYING -> true
                    o is Overlay.Rules -> true
                    from == RoomPhase.PLAYING -> o == Overlay.PauseMenu || o == Overlay.AbortConfirm || o is Overlay.PauseItemConfirm || o == Overlay.HostDialog
                    else -> o == Overlay.CloseConfirm || o is Overlay.MemberMenu || o is Overlay.KickConfirm || o is Overlay.SwitchLanguage || o == Overlay.CupSheet
                }
            }
            publishOverlays()
        }
        when {
            from == RoomPhase.HUB && to == RoomPhase.SETUP -> {
                val id = after.room.setupGameId
                val running = _moment.value
                // Our own OK already started this portal (openGame): keep it.
                if (running == null || running.gameId != id || running.moment.id !in OPEN_PORTALS) {
                    startMoment(Moments.portal(id !in portalsPlayed, reduced), id)
                    playCue(CuePlay(Cue.PORTAL_OPEN))
                }
                id?.let { portalsPlayed += it }
            }
            from == RoomPhase.SETUP && to == RoomPhase.HUB -> {
                startMoment(Moments.portalBack(reduced), before.room.setupGameId)
                playCue(CuePlay(Cue.PORTAL_CLOSE))
            }
            to == RoomPhase.PLAYING && (from != RoomPhase.PLAYING || before.game?.n != after.game?.n) -> {
                lastPlayedGameId = after.game?.gameId ?: lastPlayedGameId
                startMoment(Moments.entrance(reduced), after.game?.gameId)
                // The sting plays in calm motion too (sound is not motion); the door opens at 250 ms.
                SoundCues.worldSting(after.game?.gameId)?.let { playCue(CuePlay(it, delayMs = if (reduced) 0L else 250L)) }
            }
            to == RoomPhase.PLAYING && before?.game?.over == false && after.game?.over == true -> {
                finishedGames++
                val gained = after.room.cup.stars.values.sum() - (before.room.cup.stars.values.sum())
                startMoment(Moments.cup(gained, reduced), after.game.gameId)
                for (i in 0 until minOf(gained, 10)) playCue(CuePlay(Cue.CUP_STAR, SoundCues.semitones(i), delayMs = 70L * i))
                overlayStack.closeAll { it == Overlay.PauseMenu || it == Overlay.AbortConfirm || it is Overlay.PauseItemConfirm }
                publishOverlays()
            }
            from != null && from != to -> gate.becameInteractive() // ABORT → setup, results → hub/setup: a plain transition
        }
        // §3.6: a host dialog takes over from the rules sheet (Mish Ana!'s guess override window).
        val mv = (game as? MishanaGameView)?.view
        if (mv != null && MishanaHost.needsHost(mv) && overlayStack.rules != null) {
            overlayStack.closeAll { it is Overlay.Rules }
            publishOverlays()
        }
    }

    /** Toast-worthy differences between two consecutive views, emitted whichever screen is showing. */
    private fun announce(before: RoomView?, beforeGame: GameView?, after: RoomView, game: GameView?) {
        val now = deps.clock()
        for (id in reactions.update(after.room.members, now)) playCue(CuePlay(Cue.REACTION_POP))
        for (e in diffMembers(before?.room, after.room)) _events.tryEmit(TvEvent.Game(e))
        for (c in SoundCues.memberCues(before?.room, after.room)) playCue(c)
        val mvBefore = (beforeGame as? MishanaGameView)?.view
        val mvAfter = (game as? MishanaGameView)?.view
        if (mvAfter != null) {
            for (e in diffViews(mvBefore, mvAfter)) _events.tryEmit(TvEvent.Game(e))
            for (c in SoundCues.viewCues(mvBefore, mvAfter)) playCue(c)
        }
        // Mish Ana! setup: the VIP's settings changes (toast + row flash) and the echo of ours.
        val sb = before?.let { MishanaTv.setupView(it.room) }
        val sa = MishanaTv.setupView(after.room)
        if (sb != null && sa != null) {
            val keys = draft.onServerSettings(sb.settings, sa.settings)
            _settingsDraft.value = draft.patch
            if (keys.isNotEmpty()) {
                val host = after.room.members.firstOrNull { it.id == after.room.hostPlayerId }?.name
                _events.tryEmit(TvEvent.SettingsChanged(keys, host))
            }
        }
        // Other games: drop the generic draft once the server shows every key we sent.
        val g = _genericDraft.value
        val setup = after.room.setup
        if (g != null && (setup == null || setup.gameId != genericDraftGame || g.all { (k, v) -> setup.settings[k] == v })) {
            _genericDraft.value = null
        }
    }

    private fun onConnState(st: ConnState) {
        if (st != ConnState.OPEN) lastSeq = -1L // the next socket starts a fresh seq stream
        val current = _ui.value as? TvUiState.InRoom ?: return
        if (st is ConnState.CLOSED_FATAL) {
            handleFatal(st.code, current)
            return
        }
        _ui.value = current.copy(conn = st)
    }

    private fun handleFatal(code: Int, s: TvUiState.InRoom) {
        // TV-13e (SPEC §7.5): the room expired (TV gone 15 min, or the 12 h cap) or vanished between games.
        if (code in RECREATE_CLOSE_CODES && recreatesRoom(s.view)) {
            createRoomInternal(announceNewCode = true)
            return
        }
        val expected = FATAL_ERROR_CODES[code]
        val key = s.lastError?.takeIf { it.code == expected }?.messageKey
            ?: expected?.let { errorMessageKey(it) }
            ?: MessageKeys.INTERNAL
        teardownRoom()
        _ui.value = TvUiState.Fatal(key)
    }

    /** Wraps in `ActionMsg(id = counter)`; dropped unless the socket is OPEN (the UI says so: AppRoot, TV-13a). */
    fun send(intent: ClientIntent) {
        val s = _ui.value as? TvUiState.InRoom ?: return
        if (s.conn != ConnState.OPEN) return
        val conn = connection ?: return
        actionCounter += 1
        conn.send(ActionMsg(id = actionCounter.toString(), a = intent))
    }

    // ---------------------------------------------------------------- the input rule and moments (§3.10)

    /** Every remote key goes through here first (§3.10 E). CONSUME/COMPLETE: the screen must not see the key. */
    fun gateKey(key: RemoteKey, repeatCount: Int = 0): GateDecision = gate.onKey(key, repeatCount)

    private fun startMoment(m: Moment, gameId: String?) {
        val seq = ++momentSeq
        val active = ActiveMoment(m, deps.clock(), gameId, completed = false, seq = seq)
        _moment.value = active
        gate.start(m.id + "#" + seq, m.totalMs) {
            _moment.update { cur -> if (cur?.seq == seq) cur.copy(completed = true) else cur }
        }
    }

    /** The UI reports that a moment's animation ended (naturally, or after OK snapped it to its end state). */
    fun momentEnded(seq: Int) {
        val cur = _moment.value ?: return
        if (cur.seq != seq) return
        gate.finish(cur.moment.id + "#" + seq)
        _moment.value = null
    }

    /** A screen reached without a moment became interactive (a dialog opening): starts the input guard. */
    fun screenInteractive() = gate.becameInteractive()

    // ---------------------------------------------------------------- overlays (§3.2 HUB-06, §3.6)

    private fun publishOverlays() {
        _overlays.value = overlayStack.items
    }

    fun openOverlay(o: Overlay) {
        overlayStack.open(o)
        publishOverlays()
        if (o !is Overlay.Rules) gate.becameInteractive()
    }

    /** Back / Close on the top overlay (a rules sheet opened from the pause menu returns straight to the game). */
    fun overlayBack() {
        overlayStack.back()
        publishOverlays()
    }

    fun closeOverlay(o: Overlay) {
        overlayStack.close(o)
        publishOverlays()
    }

    // ---------------------------------------------------------------- room intents (§2.5)

    private fun room() = currentView()?.room

    /**
     * Hub carousel focus: local at once; `HUB_FOCUS` after [Constants.HUB_FOCUS_DEBOUNCE_MS] of rest (at most one per
     * rest), and only when it differs from the server's `focusedGameId`.
     */
    fun focusGame(gameId: String) {
        _focusedGameId.value = gameId
        hubFocusJob?.cancel()
        hubFocusJob = viewModelScope.launch {
            delay(Constants.HUB_FOCUS_DEBOUNCE_MS)
            val r = room() ?: return@launch
            // Compare with what the server has, or with our last message it has not echoed yet.
            if (r.phase == RoomPhase.HUB && gameId != (hubFocusSent ?: r.focusedGameId)) {
                send(HubFocus(gameId))
                hubFocusSent = gameId
            }
        }
    }

    /** OK on a poster: OPEN_GAME and the portal starts at once, so a second OK only completes it (§3.10 E). */
    fun openGame(gameId: String) {
        val r = room() ?: return
        if (r.phase != RoomPhase.HUB) return
        hubFocusJob?.cancel()
        send(OpenGame(gameId))
        startMoment(Moments.portal(gameId !in portalsPlayed, _motion.value.reduced), gameId)
        playCue(CuePlay(Cue.PORTAL_OPEN))
        portalsPlayed += gameId
    }

    fun closeGame() = send(CloseGame)
    fun startGame() = send(StartGame)
    fun replay() = send(Replay)
    fun backToSetup() = send(BackToSetup)
    fun backToHub() = send(BackToHub)
    fun abortGame() = send(AbortGame)
    fun kick(playerId: String) = send(Kick(playerId))
    fun setContentLocale(locale: String) {
        if (room()?.contentLocale != locale) send(SetContentLocale(locale))
    }

    /** A pause-menu game item (§2.2 `pauseItems`): `GAME {gameId, i: {type: intent}}`. */
    fun runPauseItem(item: PauseItemSpec) {
        val gameId = currentView()?.game?.gameId ?: return
        send(GameIntent(gameId, JsonObject(mapOf("type" to kotlinx.serialization.json.JsonPrimitive(item.intent)))))
    }

    /** Sends one of the active game's own intents (e.g. Mish Ana!'s guess override), via its package. */
    fun sendGame(intent: GameIntent) {
        if (currentView()?.game?.gameId != intent.gameId) return
        send(intent)
    }

    // ---------------------------------------------------------------- setup settings (TV-03, §3.5)

    /** A Left/Right step on a setup row: Mish Ana! goes through its draft, other games through the generic one. */
    fun stepSetting(key: String, delta: Int) {
        val setup = effectiveSetup() ?: return
        val meta = GameCatalog.meta(setup.gameId) ?: return
        val patch = SetupRows.step(meta, setup, key, delta) ?: return
        if (setup.gameId == GameIds.MISHANA) {
            val p = try { ProtocolJson.decoder.decodeFromJsonElement(SettingsPatch.serializer(), patch) } catch (e: IllegalArgumentException) { return }
            changeSettings(p)
        } else {
            changeGenericSettings(setup.gameId, patch)
        }
    }

    /** The setup as the column shows it: the server's settings with the local draft applied. */
    fun effectiveSetup(): RoomSetup? {
        val setup = room()?.setup ?: return null
        val overlay = if (setup.gameId == GameIds.MISHANA) _settingsDraft.value?.let { MishanaTv.wirePatch(it) }
        else _genericDraft.value?.takeIf { genericDraftGame == setup.gameId }
        return if (overlay == null) setup else setup.copy(settings = JsonObject(setup.settings + overlay))
    }

    /** The Mish Ana! setup (Advanced settings screen data), or null when the setup is another game's. */
    fun mishanaSetup(): MishanaSetupView? = room()?.let { MishanaTv.setupView(it) }

    /**
     * A local Mish Ana! settings change (TV-03): shown at once, merged and sent after [SETTINGS_DEBOUNCE_MS]; if the
     * server never echoes it (rejected), the screen falls back to the server values after [SETTINGS_FALLBACK_MS].
     * `wordLocale` is the room's content language in v2 (`SET_CONTENT_LOCALE`); the rest is `UPDATE_GAME_SETTINGS`.
     */
    fun changeSettings(p: SettingsPatch) {
        draft.change(p)
        _settingsDraft.value = draft.patch
        draftJob?.cancel()
        draftJob = viewModelScope.launch {
            delay(SETTINGS_DEBOUNCE_MS)
            val patch = draft.flush() ?: return@launch
            patch.wordLocale?.let { setContentLocale(it) }
            MishanaTv.wirePatch(patch)?.let { send(UpdateGameSettings(GameIds.MISHANA, it)) }
            delay(SETTINGS_FALLBACK_MS)
            draft.expire()
            _settingsDraft.value = draft.patch
        }
    }

    private fun changeGenericSettings(gameId: String, patch: JsonObject) {
        val merged = if (genericDraftGame == gameId) JsonObject((_genericDraft.value ?: JsonObject(emptyMap())) + patch) else patch
        genericDraftGame = gameId
        _genericDraft.value = merged
        genericJob?.cancel()
        genericJob = viewModelScope.launch {
            delay(SETTINGS_DEBOUNCE_MS)
            send(UpdateGameSettings(gameId, merged))
            delay(SETTINGS_FALLBACK_MS)
            _genericDraft.value = null
        }
    }

    /** Pack picker: the new selection for a `packs` row (multi: ids; single: one family id). */
    fun setPacks(key: String, ids: List<String>, single: Boolean) {
        val setup = room()?.setup ?: return
        if (setup.gameId == GameIds.MISHANA && key == "packIds") {
            changeSettings(SettingsPatch(packIds = ids))
            return
        }
        val v: kotlinx.serialization.json.JsonElement = if (single) kotlinx.serialization.json.JsonPrimitive(ids.firstOrNull())
        else kotlinx.serialization.json.JsonArray(ids.map { kotlinx.serialization.json.JsonPrimitive(it) })
        changeGenericSettings(setup.gameId, JsonObject(mapOf(key to v)))
    }

    // ---------------------------------------------------------------- device settings

    fun setCalmMotion(on: Boolean) {
        deps.prefs.calmMotion = on
        _motion.value = deps.motion(on)
    }

    /** Hub Settings → "Show how-to again". */
    fun clearIntros() = deps.prefs.clearIntros()

    /** Plays a cue unless the TV is muted (the screens' timelines, deadlines and remote feedback come here too). */
    fun playCue(p: CuePlay) {
        if (!_soundMuted.value) deps.sound.play(p)
    }

    /** Cuts every ringing cue (a skipped reveal must not drag its drumroll over the end state). */
    fun stopCues() = deps.sound.stopAll()

    fun setSoundMuted(muted: Boolean) {
        _soundMuted.value = muted
        deps.saveMuted(muted)
        // Muting cuts what rings; unmuting confirms with the OK tick (the key's own tick was still muted).
        if (muted) deps.sound.stopAll() else deps.sound.play(CuePlay(Cue.UI_SELECT))
    }

    // ---------------------------------------------------------------- billing (PAYMENTS-SPEC §4.3 / §4.4)

    private fun storeOpen(): Boolean = (_ui.value as? TvUiState.InRoom)?.store != null

    private fun currentView(): RoomView? = (_ui.value as? TvUiState.InRoom)?.view

    /** The socket is OPEN and the server answered our hello with a state: queued messages may go now. */
    private fun sessionReady(): Boolean {
        val s = _ui.value as? TvUiState.InRoom ?: return false
        return s.conn == ConnState.OPEN && lastSeq >= 0 && connection != null
    }

    private fun onSessionReady() {
        pendingToken?.let { t -> if (sendTokenNow(t)) pendingToken = null }
        val busy = billing?.state?.value?.busy ?: false
        // A replacing connection (same tvToken) re-sends its state; a closed one cleared it on the server.
        if (busy) {
            storeCloseJob?.cancel()
            storeCloseJob = null
            sendStoreOpenNow(true)
            ensureStoreKeepalive()
        } else if (storeOpenSent == true || storeOpenRetry) {
            closeStoreOpenNow()
        }
    }

    /** §4.3: sends at once when the session is ready, else keeps the newest token for the next first state. */
    fun sendEntitlement(token: String) {
        if (sessionReady() && sendTokenNow(token)) {
            pendingToken = null
        } else {
            pendingToken = token
        }
    }

    private fun sendTokenNow(token: String): Boolean {
        val conn = connection ?: return false
        if (!conn.send(EntitlementMsg(token = token))) return false
        lastTokenSent = token
        lastTokenSentAt = deps.clock()
        return true
    }

    /**
     * §3.11 `storeOpen`: true while the Store is visible or a purchase flow is in flight. `true` goes out only when the
     * server does not already think the TV is busy, then every [STORE_OPEN_RESEND_MS]; `false` is debounced by
     * [STORE_CLOSE_DEBOUNCE_MS] so remote navigation (close, reopen) does not spend the 6/min cap.
     */
    fun sendStoreOpen(open: Boolean) {
        storeCloseJob?.cancel()
        storeCloseJob = null
        if (open) {
            if (storeOpenSent != true && sessionReady()) sendStoreOpenNow(true)
            ensureStoreKeepalive()
        } else {
            storeCloseJob = viewModelScope.launch {
                delay(STORE_CLOSE_DEBOUNCE_MS)
                storeCloseJob = null
                // Not ready: the next first state sends false (storeOpenSent stays true), or a closed socket cleared it.
                if (sessionReady()) closeStoreOpenNow()
            }
        }
    }

    private fun closeStoreOpenNow() {
        storeOpenJob?.cancel()
        storeOpenJob = null
        sendStoreOpenNow(false)
    }

    private fun ensureStoreKeepalive() {
        if (storeOpenJob?.isActive == true) return
        storeOpenJob = viewModelScope.launch {
            while (true) {
                delay(STORE_OPEN_RESEND_MS)
                if (sessionReady()) sendStoreOpenNow(true)
            }
        }
    }

    private fun sendStoreOpenNow(open: Boolean) {
        val conn = connection ?: return
        if (conn.send(StoreOpenMsg(open = open))) {
            storeOpenSent = open
            storeOpenRetry = false
            lastStoreOpenSentAt = deps.clock()
        }
    }

    /**
     * A ref-less RATE_LIMITED within [BILLING_RATE_WINDOW_MS] of a billing send: assume that send was capped and re-send
     * the newest values after [BILLING_RETRY_MS] (the cap is a 60 s sliding window). Re-sending an accepted token or
     * storeOpen value is harmless (same token: `iatMs` is equal; storeOpen is idempotent). Returns true if handled.
     */
    private fun onBillingRateLimited(): Boolean {
        val now = deps.clock()
        val tokenHit = lastTokenSent != null && now - lastTokenSentAt in 0..BILLING_RATE_WINDOW_MS
        val storeHit = storeOpenSent != null && now - lastStoreOpenSentAt in 0..BILLING_RATE_WINDOW_MS
        if (!tokenHit && !storeHit) return false
        if (tokenHit && pendingToken == null) pendingToken = lastTokenSent
        if (storeHit) {
            storeOpenSent = null // unknown: the retry re-sends the current busy value
            storeOpenRetry = true
        }
        if (billingRetryJob?.isActive != true) {
            billingRetryJob = viewModelScope.launch {
                delay(BILLING_RETRY_MS)
                billingRetryJob = null
                if (!sessionReady()) return@launch // the next first state sends pendingToken and the busy value
                pendingToken?.let { t -> if (sendTokenNow(t)) pendingToken = null }
                if (storeOpenRetry && storeCloseJob == null) {
                    val busy = billing?.state?.value?.busy ?: false
                    if (busy) sendStoreOpenNow(true) else closeStoreOpenNow()
                }
            }
        }
        return true
    }

    private fun onBusyChanged(busy: Boolean) {
        // Not busy: close only if the server may think the TV is busy (sent true, keepalive, or a capped send).
        if (busy || storeOpenSent == true || storeOpenJob != null || storeCloseJob != null || storeOpenRetry) sendStoreOpen(busy)
    }

    private fun onBillingEvent(e: BillingEvent) {
        if (!billingOn) return // server billing off: no entitlement sends, toasts or grants
        when (e) {
            is BillingEvent.Token -> sendEntitlement(e.token)
            is BillingEvent.Toast -> showBillingToast(BillingToast(e.key, e.arg))
            is BillingEvent.Granted -> onGranted(e)
        }
    }

    private fun showBillingToast(t: BillingToast) {
        toastQueue.offer(t, storeOpen(), currentView()?.betweenGames ?: true)?.let { _events.tryEmit(TvEvent.Billing(it)) }
    }

    /** §4.4: a pack bought from a locked row joins a non-empty Mish Ana! `packIds` (same language), else the language hint. */
    private fun onGranted(e: BillingEvent.Granted) {
        val view = currentView() ?: return
        val setup = MishanaTv.setupView(view.room)
        for ((productId, origin) in e.origins) {
            if (origin != StoreOrigin.LOCKED_PACK) continue
            val packId = Products.packIdFromProductId(productId) ?: continue
            val packLocale = billing?.state?.value?.catalog?.packs?.firstOrNull { it.packId == packId }?.language
                ?: view.room.setup?.lockedPacks?.firstOrNull { it.id == packId }?.locale
                ?: continue
            val packLang = Products.languageOf(packLocale)
            if (packLang != Products.languageOf(view.room.contentLocale)) {
                showBillingToast(BillingToast("store.switchLanguage", packLang))
                continue
            }
            val ids = setup?.settings?.packIds ?: continue
            if (ids.isNotEmpty() && packId !in ids && ids.size < Constants.SETTINGS_BOUNDS.packIds.maxItems) {
                send(UpdateGameSettings(GameIds.MISHANA, MishanaTv.wirePatch(SettingsPatch(packIds = ids + packId)) ?: continue))
                showBillingToast(BillingToast("store.addedToGame"))
            }
        }
    }

    /** §4.5: opens the Pass store overlay (HUB or SETUP, billing on). */
    fun openStore(entry: StoreEntry) {
        val s = _ui.value as? TvUiState.InRoom ?: return
        val view = s.view ?: return
        if (view.room.phase == RoomPhase.PLAYING || billing == null || !s.billingEnabled) return
        _ui.value = s.copy(store = entry)
        billing.openStore(view.room.setup?.lockedPacks.orEmpty())
        toastQueue.flush(true, view.betweenGames)?.let { _events.tryEmit(TvEvent.Billing(it)) }
    }

    fun closeStore() {
        _ui.update { s -> if (s is TvUiState.InRoom) s.copy(store = null) else s }
        billing?.closeStore()
        gate.becameInteractive()
    }

    /** "Try again" in `Unavailable(NETWORK)`. */
    fun retryStore() {
        val view = currentView() ?: return
        billing?.openStore(view.room.setup?.lockedPacks.orEmpty())
    }

    fun buy(activity: Activity, productId: String, basePlanId: String?) {
        val origin = (_ui.value as? TvUiState.InRoom)?.store?.origin ?: StoreOrigin.LOBBY_BUTTON
        billing?.buy(activity, productId, basePlanId, origin)
    }

    fun restorePurchases() {
        billing?.restorePurchases()
    }

    /** Settings → About: this TV's install id (created on first use), or null. Never sent anywhere from here. */
    fun installId(): String? = deps.installId()

    /** TV-13b "Try again": skip the backoff. */
    fun retryConnectionNow() {
        connection?.retryNow()
    }

    override fun onCleared() {
        teardownRoom()
        deps.sound.release()
        super.onCleared()
    }

    companion object {
        /** The hub → setup portal variants (not the reverse portal). */
        val OPEN_PORTALS: Set<String> = setOf("portal", "portal.repeat", "portal.reduced")

        const val SETTINGS_DEBOUNCE_MS = 300L
        const val SETTINGS_FALLBACK_MS = 1_500L

        /** §3.11: re-send `storeOpen{open:true}` every 4 min (the server clears it after TV_BUSY_MAX_MS = 5 min). */
        const val STORE_OPEN_RESEND_MS = 4 * 60_000L

        /** A close followed by a reopen within this window sends nothing (the server stays busy meanwhile). */
        const val STORE_CLOSE_DEBOUNCE_MS = 2_000L

        /** A ref-less RATE_LIMITED this soon after a billing send is attributed to it. */
        const val BILLING_RATE_WINDOW_MS = 2_000L

        /** Back-off before re-sending capped billing messages (the server cap is 6 per sliding 60 s). */
        const val BILLING_RETRY_MS = 60_000L

        /** §4.3: TV-register toasts for the two settings errors; everything else uses the server's messageKey. */
        fun tvMessageKey(error: ErrorMsg): String = when (error.code) {
            "PREMIUM_REQUIRED" -> "tv.premiumRequired"
            "PACK_LOCKED" -> "tv.packLocked"
            else -> error.messageKey
        }

        /** TV-13e: ROOM_EXPIRED (4010) and ROOM_NOT_FOUND (4004) re-create the room when [recreatesRoom]. */
        val RECREATE_CLOSE_CODES: Set<Int> = setOf(4010, 4004)
        val RECREATE_ERROR_CODES: Set<String> = setOf("ROOM_EXPIRED", "ROOM_NOT_FOUND")

        /** Between games (HUB, SETUP, a finished game, or no view yet): a lost room is replaced silently; in-game stays Fatal. */
        fun recreatesRoom(view: RoomView?): Boolean = view == null || view.betweenGames

        /** Close code → the error code whose messageKey explains it (SPEC §6.4). */
        val FATAL_ERROR_CODES: Map<Int, String> = mapOf(
            4002 to "UNSUPPORTED_VERSION",
            4003 to "TV_AUTH_FAILED",
            4004 to "ROOM_NOT_FOUND",
            4005 to "REPLACED",
            4006 to "KICKED",
            4010 to "ROOM_EXPIRED",
        )

        /** `messageKey = "error." + lowerCamel(code)` (SPEC §6.4). */
        fun errorMessageKey(code: String): String {
            val parts = code.lowercase().split('_').filter { it.isNotEmpty() }
            if (parts.isEmpty()) return MessageKeys.INTERNAL
            return "error." + parts.first() + parts.drop(1).joinToString("") { p -> p.replaceFirstChar { it.uppercaseChar() } }
        }
    }
}

/** Mish Ana!'s host dialog moments (§3.6: the rules sheet yields to them). */
object MishanaHost {
    /** The guess-override window: a verdict is in, not overridden, not a timeout. */
    fun needsHost(v: MishanaView): Boolean {
        val g = v.guess ?: return false
        return v.phase == Phase.MR_WHITE_GUESS && g.status != GuessStatus.PENDING && g.status != GuessStatus.TIMEOUT && !g.overridden
    }
}
