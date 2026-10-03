package app.mishana.tv.net

import app.mishana.tv.Constants
import app.mishana.tv.protocol.ClientMessage
import app.mishana.tv.protocol.HelloTv
import app.mishana.tv.protocol.ProtocolJson
import app.mishana.tv.protocol.ServerMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import kotlin.math.max

/** SPEC §9.7: `ConnState = CONNECTING | OPEN | RECONNECTING | CLOSED_FATAL(code)`. */
sealed interface ConnState {
    data object CONNECTING : ConnState
    data object OPEN : ConnState
    data object RECONNECTING : ConnState
    @Suppress("ClassName")
    data class CLOSED_FATAL(val code: Int) : ConnState
}

/** What the ViewModel needs from a room connection (RoomSocket in production, a fake in tests). */
interface RoomConnection {
    val state: StateFlow<ConnState>
    val incoming: SharedFlow<ServerMessage>

    /** Consecutive failed attempts since the last stable open (TV-13a attempt counter). */
    val attempt: StateFlow<Int>
    fun connect(code: String, tvToken: String)

    /** Sends when OPEN; returns false (and drops) otherwise. */
    fun send(msg: ClientMessage): Boolean

    /** Skips the pending backoff and reconnects now (TV-13b "Try again"). No-op unless RECONNECTING. */
    fun retryNow()
    fun disconnect()
}

/**
 * OkHttp WebSocket client for one room (SPEC §9.7).
 * - Fatality is decided by the close code only, in [WebSocketListener.onClosing] (onClosed may never come).
 * - Every callback first checks that it comes from the current socket; callbacks from older sockets are ignored.
 */
class RoomSocket(
    private val serverUrl: () -> String,
    private val scope: CoroutineScope,
    client: OkHttpClient = defaultClient,
    private val policy: ReconnectPolicy = ReconnectPolicy(),
    private val clock: () -> Long = { System.currentTimeMillis() },
    heartbeatIntervalMs: Long = Constants.HEARTBEAT_INTERVAL_MS,
    pongTimeoutMs: Long = Constants.PONG_TIMEOUT_MS,
    private val attemptResetMs: Long = 5_000L,
    private val slowReconnectMs: Long = Constants.SLOW_RECONNECT_MS,
    private val webSocketFactory: (Request, WebSocketListener) -> WebSocket = { r, l -> client.newWebSocket(r, l) },
) : RoomConnection {

    companion object {
        /** connectTimeout 5 s, readTimeout 0, and no OkHttp pingInterval (the heartbeat is app-level). */
        val defaultClient: OkHttpClient by lazy {
            OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build()
        }
    }

    private val lock = Any()
    private var current: WebSocket? = null
    private var code: String? = null
    private var tvToken: String? = null
    private var stopped = true
    private var reconnectJob: Job? = null
    private var resetJob: Job? = null

    /** The socket the running heartbeat belongs to; a timeout only acts on that socket while it is still current. */
    private var heartbeatSocket: WebSocket? = null

    private val _state = MutableStateFlow<ConnState>(ConnState.CONNECTING)
    override val state: StateFlow<ConnState> = _state.asStateFlow()

    private val _incoming = MutableSharedFlow<ServerMessage>(extraBufferCapacity = 256)
    override val incoming: SharedFlow<ServerMessage> = _incoming.asSharedFlow()

    private val _attempt = MutableStateFlow(0)
    override val attempt: StateFlow<Int> = _attempt.asStateFlow()

    private val heartbeat = Heartbeat(
        scope = scope,
        clock = clock,
        send = { frame -> synchronized(lock) { current }?.send(frame) ?: false },
        onTimeout = { onHeartbeatTimeout() },
        intervalMs = heartbeatIntervalMs,
        timeoutMs = pongTimeoutMs,
    )

    override fun connect(code: String, tvToken: String) {
        synchronized(lock) {
            this.code = code
            this.tvToken = tvToken
            stopped = false
            _attempt.value = 0
            _state.value = ConnState.CONNECTING
            openLocked()
        }
    }

    override fun send(msg: ClientMessage): Boolean {
        val ws = synchronized(lock) { if (_state.value == ConnState.OPEN) current else null } ?: return false
        return ws.send(ProtocolJson.encodeClient(msg))
    }

    override fun retryNow() {
        synchronized(lock) {
            if (stopped || _state.value != ConnState.RECONNECTING || current != null) return
            reconnectJob?.cancel()
            reconnectJob = null
            openLocked()
        }
    }

    override fun disconnect() {
        val ws: WebSocket?
        synchronized(lock) {
            stopped = true
            reconnectJob?.cancel()
            reconnectJob = null
            resetJob?.cancel()
            resetJob = null
            ws = current
            current = null
            stopHeartbeatLocked()
        }
        ws?.close(1000, null)
    }

    // ---- internals (all state changes under [lock]) ----

    private fun openLocked() {
        val c = code ?: return
        if (stopped) return
        val url = ServerUrls.wsUrl(serverUrl(), c) // fresh _pk and cid per attempt (SPEC §9.4)
        // Request.Builder.url(String) canonicalises ws:// → http:// (do not use HttpUrl for ws URLs).
        val request = Request.Builder().url(url).build()
        current = webSocketFactory(request, Listener())
    }

    private fun stopHeartbeatLocked() {
        heartbeatSocket = null
        heartbeat.stop()
    }

    private fun isCurrent(ws: WebSocket): Boolean = synchronized(lock) { ws === current }

    private fun scheduleReconnectLocked(minDelayMs: Long = 0L) {
        if (stopped) return
        val delayMs = max(minDelayMs, policy.delayMs(_attempt.value))
        _attempt.value = _attempt.value + 1
        _state.value = ConnState.RECONNECTING
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(delayMs)
            synchronized(lock) {
                reconnectJob = null
                if (current == null) openLocked()
            }
        }
    }

    private fun handleClose(ws: WebSocket, closeCode: Int) {
        synchronized(lock) {
            if (ws !== current) return
            current = null
            resetJob?.cancel()
            resetJob = null
            when (closeCode) {
                in Constants.FATAL_CLOSE_CODES -> {
                    stopped = true
                    reconnectJob?.cancel()
                    reconnectJob = null
                    _state.value = ConnState.CLOSED_FATAL(closeCode)
                }
                in Constants.SLOW_RECONNECT_CLOSE_CODES -> scheduleReconnectLocked(slowReconnectMs)
                else -> scheduleReconnectLocked()
            }
            stopHeartbeatLocked()
        }
    }

    private fun handleFailure(ws: WebSocket) {
        synchronized(lock) {
            if (ws !== current) return
            current = null
            resetJob?.cancel()
            resetJob = null
            scheduleReconnectLocked()
            stopHeartbeatLocked()
        }
    }

    private fun onHeartbeatTimeout() {
        val ws: WebSocket?
        synchronized(lock) {
            ws = current ?: return
            if (ws !== heartbeatSocket) return // a stale watchdog from an older socket: never cancel a newer one
            current = null
            resetJob?.cancel()
            resetJob = null
            scheduleReconnectLocked()
            stopHeartbeatLocked()
        }
        ws?.cancel()
    }

    private inner class Listener : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            val token: String
            synchronized(lock) {
                if (webSocket !== current) return
                token = tvToken ?: return
                _state.value = ConnState.OPEN
                resetJob?.cancel()
                resetJob = scope.launch {
                    delay(attemptResetMs)
                    synchronized(lock) { if (webSocket === current) _attempt.value = 0 }
                }
                // Started under the lock, after the current-socket check: a concurrent disconnect()/timeout can no
                // longer stop() first and then have this start() revive a ping loop for a dead socket.
                heartbeatSocket = webSocket
                heartbeat.start()
            }
            webSocket.send(ProtocolJson.encodeClient(HelloTv(tvToken = token)))
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (!isCurrent(webSocket)) return
            if (text == Constants.PONG_FRAME) {
                heartbeat.onPong()
                return
            }
            val msg = ProtocolJson.decodeServer(text) ?: return // unknown "t" or partyserver {"error":…}: ignore
            _incoming.tryEmit(msg)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            if (!isCurrent(webSocket)) return
            webSocket.close(1000, null)
            handleClose(webSocket, code)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            handleClose(webSocket, code) // no-op when onClosing already handled it
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            handleFailure(webSocket)
        }
    }
}
