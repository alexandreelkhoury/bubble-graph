package app.mishana.tv.game

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.mishana.tv.net.ConnState
import app.mishana.tv.net.CreateRoomException
import app.mishana.tv.net.RoomConnection
import app.mishana.tv.protocol.ActionMsg
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.CreateRoomResponse
import app.mishana.tv.protocol.ErrorMsg
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.StateMsg
import app.mishana.tv.protocol.TvView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
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
    ) : TvUiState
    data class Fatal(val messageKey: String) : TvUiState
}

/** One-shot UI events (toasts). */
sealed interface TvEvent {
    /** A 4010 in an empty lobby silently re-created the room (TV-13e): toast `tv.newCode`. */
    data class NewCode(val code: String) : TvEvent

    /** Every server `error` once, even when it repeats an identical earlier one (lastError would not change). */
    class ServerError(val error: ErrorMsg) : TvEvent
}

/** Everything platform-specific the ViewModel needs; tests pass fakes. */
class GameDeps(
    /** Effective server URL (SPEC §9.4). */
    val serverUrl: () -> String,
    /** Current app language: en | fr | ar (default en). */
    val appLocale: () -> String,
    val createRoom: suspend (baseUrl: String, locale: String) -> CreateRoomResponse,
    val newConnection: (scope: CoroutineScope, serverUrl: () -> String) -> RoomConnection,
    val clock: () -> Long = { System.currentTimeMillis() },
)

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

    private var connection: RoomConnection? = null
    private var roomJobs: List<Job> = emptyList()
    private var createJob: Job? = null
    private var lastSeq = -1L
    private var actionCounter = 0L
    private val clockOffset = ClockOffset()

    init {
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
                deps.createRoom(deps.serverUrl(), deps.appLocale())
            } catch (e: CancellationException) {
                throw e
            } catch (e: CreateRoomException) {
                _ui.value = TvUiState.CreateFailed(e.errorCode?.let { errorMessageKey(it) } ?: "tv.createFailed")
                return@launch
            } catch (e: Exception) {
                _ui.value = TvUiState.CreateFailed("tv.createFailed")
                return@launch
            }
            openRoom(resp)
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
    }

    private fun teardownRoom() {
        roomJobs.forEach { it.cancel() }
        roomJobs = emptyList()
        connection?.disconnect()
        connection = null
        _reconnectAttempt.value = 0
    }

    private fun onMessage(msg: app.mishana.tv.protocol.ServerMessage) {
        when (msg) {
            is StateMsg -> {
                if (msg.seq <= lastSeq) return
                lastSeq = msg.seq
                val offset = clockOffset.add(msg.serverNow, deps.clock())
                _ui.update { s -> if (s is TvUiState.InRoom) s.copy(view = msg.view, clockOffsetMs = offset) else s }
            }
            is ErrorMsg -> {
                _ui.update { s -> if (s is TvUiState.InRoom) s.copy(lastError = msg) else s }
                if (_ui.value is TvUiState.InRoom) _events.tryEmit(TvEvent.ServerError(msg))
            }
            else -> Unit // welcome/pong are not for the TV
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
            ?: "error.internal"
        teardownRoom()
        _ui.value = TvUiState.Fatal(key)
    }

    /** Wraps in `ActionMsg(id = counter)`; dropped unless the socket is OPEN. */
    fun send(intent: ClientIntent) {
        val s = _ui.value as? TvUiState.InRoom ?: return
        if (s.conn != ConnState.OPEN) return
        val conn = connection ?: return
        actionCounter += 1
        conn.send(ActionMsg(id = actionCounter.toString(), a = intent))
    }

    /** Local only: pauses local animations and shows the pause menu, never the game. */
    fun setPaused(p: Boolean) {
        _ui.update { s -> if (s is TvUiState.InRoom) s.copy(paused = p) else s }
    }

    /** TV-13b "Try again": skip the backoff. */
    fun retryConnectionNow() {
        connection?.retryNow()
    }

    override fun onCleared() {
        teardownRoom()
        super.onCleared()
    }

    companion object {
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
            if (parts.isEmpty()) return "error.internal"
            return "error." + parts.first() + parts.drop(1).joinToString("") { p -> p.replaceFirstChar { it.uppercaseChar() } }
        }
    }
}
