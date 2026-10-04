package app.mishana.tv.game

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.mishana.tv.Constants
import app.mishana.tv.billing.BillingEvent
import app.mishana.tv.billing.Products
import app.mishana.tv.billing.RoomBilling
import app.mishana.tv.billing.StoreEntry
import app.mishana.tv.billing.StoreOrigin
import app.mishana.tv.i18n.MessageKeys
import app.mishana.tv.net.ConnState
import app.mishana.tv.net.CreateRoomException
import app.mishana.tv.net.RoomConnection
import app.mishana.tv.protocol.ActionMsg
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.CreateRoomResponse
import app.mishana.tv.protocol.EntitlementMsg
import app.mishana.tv.protocol.ErrorMsg
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.SettingsPatch
import app.mishana.tv.protocol.StateMsg
import app.mishana.tv.protocol.StoreOpenMsg
import app.mishana.tv.protocol.UpdateSettings
import app.mishana.tv.protocol.TvView
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
import kotlin.coroutines.cancellation.CancellationException

/** SPEC §9.8. */
sealed interface TvUiState {
    data object CreatingRoom : TvUiState
    data class CreateFailed(val messageKey: String) : TvUiState
    data class InRoom(
        val code: String,
        val joinUrl: String,
        val view: TvView?,
        val conn: ConnState,
        val clockOffsetMs: Long,
        val lastError: ErrorMsg?,
        val paused: Boolean,
        /** PAYMENTS-SPEC §4.4: the Store overlay (LOBBY only), or null. */
        val store: StoreEntry? = null,
    ) : TvUiState
    data class Fatal(val messageKey: String) : TvUiState
}

/** One-shot UI events (toasts). */
sealed interface TvEvent {
    /** A 4010 in an empty lobby silently re-created the room (TV-13e): toast `tv.newCode`. */
    data class NewCode(val code: String) : TvEvent

    /** Every server `error` once, even when it repeats an identical earlier one (lastError would not change). */
    class ServerError(val error: ErrorMsg) : TvEvent

    /** Join / leave / away / forfeit / skipped turn, derived from consecutive views ([diffViews]). */
    data class Game(val event: ViewEvent) : TvEvent

    /** Someone else (the VIP) changed lobby settings: the `settings.changedBy` toast and the row flash. */
    data class SettingsChanged(val keys: Set<String>, val hostName: String?) : TvEvent

    /** A billing toast (PAYMENTS-SPEC §4.4), already past the queue rule: show it now. */
    data class Billing(val toast: BillingToast) : TvEvent
}

/** Everything platform-specific the ViewModel needs; tests pass fakes. */
class GameDeps(
    /** Effective server URL (SPEC §9.4). */
    val serverUrl: () -> String,
    /** Current app language: en | fr | ar (default en). */
    val appLocale: () -> String,
    /** POST /api/rooms; [entitlement] is the stored token or null (PAYMENTS-SPEC §4.3). */
    val createRoom: suspend (baseUrl: String, locale: String, entitlement: String?) -> CreateRoomResponse,
    val newConnection: (scope: CoroutineScope, serverUrl: () -> String) -> RoomConnection,
    val clock: () -> Long = { System.currentTimeMillis() },
    /** Sound cues (DESIGN §6.4); SoundPool on the device. */
    val sound: SoundSink = SoundSink.None,
    /** The persisted mute setting (Settings and the pause menu). */
    val loadMuted: () -> Boolean = { false },
    val saveMuted: (Boolean) -> Unit = {},
    /** Premium / packs (PAYMENTS-SPEC §4); null = no billing (free rooms only). */
    val billing: RoomBilling? = null,
)

/** SPEC §9.8. */
class GameViewModel(app: Application, private val deps: GameDeps) : AndroidViewModel(app) {

    /** Used by the default ViewModel factory (AndroidViewModelFactory needs an `(Application)` constructor). */
    constructor(app: Application) : this(app, productionDeps(app))

    private val _ui = MutableStateFlow<TvUiState>(TvUiState.CreatingRoom)
    val ui: StateFlow<TvUiState> = _ui.asStateFlow()

    private val _events = MutableSharedFlow<TvEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<TvEvent> = _events.asSharedFlow()

    private val _reconnectAttempt = MutableStateFlow(0)

    /** Consecutive reconnect attempts of the current socket (TV-13a counter). */
    val reconnectAttempt: StateFlow<Int> = _reconnectAttempt.asStateFlow()

    private val draft = SettingsDraft()
    private val _settingsDraft = MutableStateFlow<SettingsPatch?>(null)

    /** The TV's optimistic settings overlay (TV-03), shown over `view.settings` until the server echoes it. */
    val settingsDraft: StateFlow<SettingsPatch?> = _settingsDraft.asStateFlow()
    private var draftJob: Job? = null

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
    val billingState: StateFlow<app.mishana.tv.billing.StoreUiState>? = billing?.state

    /** §4.8: the debug fake store's purchase dialog, when active. */
    val fakePrompt: app.mishana.tv.billing.FakePurchasePrompt? get() = billing?.fakePrompt
    private val toastQueue = BillingToastQueue()
    private val lobbyNotices = LobbyNotices()

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
                deps.createRoom(deps.serverUrl(), deps.appLocale(), billing?.tokenForCreate())
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
            billing?.onCreateRoomEntitlement(resp.entitlement)
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
            conn = ConnState.CONNECTING,
            clockOffsetMs = 0L,
            lastError = null,
            paused = false,
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
    }

    private fun onMessage(msg: app.mishana.tv.protocol.ServerMessage) {
        when (msg) {
            is StateMsg -> {
                // Drop only older frames: the server's meta-only broadcasts (premium, lockedPacks, tvBusy after an
                // `entitlement` / `storeOpen` / the `changesAt` alarm) reuse the game-state version as `seq`, and
                // frames on one socket arrive in order, so an equal seq is a newer frame (PAYMENTS-SPEC §3.11).
                if (msg.seq < lastSeq) return
                val firstOfSocket = lastSeq < 0
                lastSeq = msg.seq
                val offset = clockOffset.add(msg.serverNow, deps.clock())
                val current = _ui.value as? TvUiState.InRoom ?: return
                val before = current.view
                // The Store opens only in LOBBY; a phase that still leaves it closes it (the purchase flow continues).
                val leftLobby = current.store != null && msg.view.phase != Phase.LOBBY
                _ui.value = current.copy(view = msg.view, clockOffsetMs = offset, store = if (leftLobby) null else current.store)
                if (leftLobby) billing?.closeStore()
                if (firstOfSocket) onSessionReady()
                announce(before, msg.view)
                for (c in SoundCues.viewCues(before, msg.view)) playCue(c)
                if (billing != null) {
                    for (key in lobbyNotices.onView(before, msg.view)) showBillingToast(BillingToast(key))
                    toastQueue.flush(storeOpen(), msg.view.phase)?.let { _events.tryEmit(TvEvent.Billing(it)) }
                }
            }
            is ErrorMsg -> {
                if (msg.code == "TV_BUSY") return // never expected on the TV (the Store covers Start)
                // A cap hit on our own entitlement/storeOpen (§3.9, 6/min per TV connection): retried, no toast.
                if (msg.code == "RATE_LIMITED" && msg.ref == null && onBillingRateLimited()) return
                _ui.update { s -> if (s is TvUiState.InRoom) s.copy(lastError = msg) else s }
                if (_ui.value is TvUiState.InRoom) {
                    _events.tryEmit(TvEvent.ServerError(msg))
                    playCue(CuePlay(Cue.ERROR))
                }
            }
            else -> Unit // welcome/pong are not for the TV
        }
    }

    /** Toast-worthy differences between two consecutive views, emitted whichever screen is showing. */
    private fun announce(before: TvView?, after: TvView) {
        for (e in diffViews(before, after)) _events.tryEmit(TvEvent.Game(e))
        if (before != null && before.phase == Phase.LOBBY && after.phase == Phase.LOBBY) {
            val keys = draft.onServerSettings(before.settings, after.settings)
            _settingsDraft.value = draft.patch
            if (keys.isNotEmpty()) {
                val host = after.players.firstOrNull { it.id == after.hostPlayerId }?.name
                _events.tryEmit(TvEvent.SettingsChanged(keys, host))
            }
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
        val view = s.view
        val emptyLobby = view == null || (view.phase == Phase.LOBBY && view.players.isEmpty())
        if (code == 4010 && emptyLobby) {
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

    /**
     * A local settings change (TV-03): shown at once, merged and sent as one UPDATE_SETTINGS after [SETTINGS_DEBOUNCE_MS];
     * if the server never echoes it (rejected), the screen falls back to the server values after [SETTINGS_FALLBACK_MS].
     */
    fun changeSettings(p: SettingsPatch) {
        draft.change(p)
        _settingsDraft.value = draft.patch
        draftJob?.cancel()
        draftJob = viewModelScope.launch {
            delay(SETTINGS_DEBOUNCE_MS)
            val patch = draft.flush() ?: return@launch
            send(UpdateSettings(patch))
            delay(SETTINGS_FALLBACK_MS)
            draft.expire()
            _settingsDraft.value = draft.patch
        }
    }

    /** Local only: pauses local animations and shows the pause menu, never the game. */
    fun setPaused(p: Boolean) {
        _ui.update { s -> if (s is TvUiState.InRoom) s.copy(paused = p) else s }
    }

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

    private fun currentView(): TvView? = (_ui.value as? TvUiState.InRoom)?.view

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
        when (e) {
            is BillingEvent.Token -> sendEntitlement(e.token)
            is BillingEvent.Toast -> showBillingToast(BillingToast(e.key, e.arg))
            is BillingEvent.Granted -> onGranted(e)
        }
    }

    private fun showBillingToast(t: BillingToast) {
        toastQueue.offer(t, storeOpen(), currentView()?.phase)?.let { _events.tryEmit(TvEvent.Billing(it)) }
    }

    /** §4.4: a pack bought from a locked row joins a non-empty `packIds` (same language), else the language hint. */
    private fun onGranted(e: BillingEvent.Granted) {
        val view = currentView() ?: return
        for ((productId, origin) in e.origins) {
            if (origin != StoreOrigin.LOCKED_PACK) continue
            val packId = Products.packIdFromProductId(productId) ?: continue
            val packLocale = billing?.state?.value?.catalog?.packs?.firstOrNull { it.packId == packId }?.language
                ?: view.lockedPacks.firstOrNull { it.id == packId }?.locale
                ?: continue
            val packLang = Products.languageOf(packLocale)
            if (packLang != Products.languageOf(view.settings.wordLocale)) {
                showBillingToast(BillingToast("store.switchLanguage", packLang))
                continue
            }
            val ids = view.settings.packIds
            if (view.phase == Phase.LOBBY && ids.isNotEmpty() && packId !in ids && ids.size < Constants.SETTINGS_BOUNDS.packIds.maxItems) {
                send(UpdateSettings(SettingsPatch(packIds = ids + packId)))
                showBillingToast(BillingToast("store.addedToGame"))
            }
        }
    }

    /** §4.4: opens the Store overlay (LOBBY only). */
    fun openStore(entry: StoreEntry) {
        val s = _ui.value as? TvUiState.InRoom ?: return
        val view = s.view ?: return
        if (view.phase != Phase.LOBBY || billing == null) return
        _ui.value = s.copy(store = entry)
        billing.openStore(view.lockedPacks)
        toastQueue.flush(true, view.phase)?.let { _events.tryEmit(TvEvent.Billing(it)) }
    }

    fun closeStore() {
        _ui.update { s -> if (s is TvUiState.InRoom) s.copy(store = null) else s }
        billing?.closeStore()
    }

    /** "Try again" in `Unavailable(NETWORK)`. */
    fun retryStore() {
        val view = currentView() ?: return
        billing?.openStore(view.lockedPacks)
    }

    fun buy(activity: Activity, productId: String, basePlanId: String?) {
        val origin = (_ui.value as? TvUiState.InRoom)?.store?.origin ?: StoreOrigin.LOBBY_BUTTON
        billing?.buy(activity, productId, basePlanId, origin)
    }

    fun restorePurchases() {
        billing?.restorePurchases()
    }

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

        /** §4.3: TV-register toasts for the two new settings errors; everything else uses the server's messageKey. */
        fun tvMessageKey(error: ErrorMsg): String = when (error.code) {
            "PREMIUM_REQUIRED" -> "tv.premiumRequired"
            "PACK_LOCKED" -> "tv.packLocked"
            else -> error.messageKey
        }

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
