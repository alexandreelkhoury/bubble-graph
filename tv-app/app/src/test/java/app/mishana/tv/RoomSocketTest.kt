package app.mishana.tv

import app.mishana.tv.net.ConnState
import app.mishana.tv.net.ReconnectPolicy
import app.mishana.tv.net.RoomSocket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/** SPEC §14.4: MockWebServer, real time, short timeouts. */
class RoomSocketTest {
    private lateinit var server: MockWebServer
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val client = OkHttpClient.Builder().readTimeout(0, TimeUnit.MILLISECONDS).build()
    private val fastPolicy = ReconnectPolicy(random = { 0.5 }, baseMs = 20, capMs = 200)
    private val captured = CopyOnWriteArrayList<Pair<WebSocket, WebSocketListener>>()

    /** Server side: records text frames per connection and runs [onOpen]. */
    private inner class ServerSide(val onOpen: (WebSocket) -> Unit = {}) : WebSocketListener() {
        val received = LinkedBlockingQueue<String>()
        override fun onOpen(webSocket: WebSocket, response: Response) = onOpen(webSocket)
        override fun onMessage(webSocket: WebSocket, text: String) {
            received.add(text)
        }
        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null) // complete the close handshake so the server can shut down
        }
    }

    private fun upgrade(side: ServerSide) = MockResponse.Builder().webSocketUpgrade(side).build()

    private fun socket() = RoomSocket(
        serverUrl = { server.url("/").toString() },
        scope = scope,
        client = client,
        policy = fastPolicy,
        heartbeatIntervalMs = 60_000,
        pongTimeoutMs = 60_000,
        slowReconnectMs = 50,
        webSocketFactory = { req, l -> client.newWebSocket(req, l).also { captured += it to l } },
    )

    @Before fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After fun tearDown() {
        scope.cancel()
        server.close()
    }

    private fun awaitState(s: RoomSocket, predicate: (ConnState) -> Boolean) = runBlocking {
        withTimeout(5_000) { s.state.first(predicate) }
    }

    @Test
    fun helloIsSentOnOpen() {
        val side = ServerSide()
        server.enqueue(upgrade(side))
        val s = socket()
        s.connect("KXRT", "0123456789abcdef0123456789abcdef")
        awaitState(s) { it == ConnState.OPEN }
        val hello = side.received.poll(5, TimeUnit.SECONDS)
        assertEquals(
            Json.parseToJsonElement("""{"v":1,"t":"hello","role":"tv","tvToken":"0123456789abcdef0123456789abcdef"}"""),
            Json.parseToJsonElement(hello!!),
        )
        val request = server.takeRequest(5, TimeUnit.SECONDS)!!
        assertTrue(request.url.encodedPath == "/parties/room/KXRT")
        assertTrue(request.url.queryParameter("_pk")!!.isNotBlank())
        assertTrue(request.url.queryParameter("cid")!!.length >= 8)
        s.disconnect()
    }

    @Test
    fun noReconnectAfterClose4006() {
        server.enqueue(upgrade(ServerSide { it.close(4006, "kicked") }))
        server.enqueue(upgrade(ServerSide()))
        val s = socket()
        s.connect("KXRT", "0123456789abcdef0123456789abcdef")
        awaitState(s) { it is ConnState.CLOSED_FATAL }
        assertEquals(ConnState.CLOSED_FATAL(4006), s.state.value)
        Thread.sleep(400) // several backoff periods
        assertEquals(1, server.requestCount)
        assertEquals(ConnState.CLOSED_FATAL(4006), s.state.value)
    }

    @Test
    fun reconnectAfterANormalClose() {
        server.enqueue(upgrade(ServerSide { it.close(1000, "bye") }))
        val second = ServerSide()
        server.enqueue(upgrade(second))
        val s = socket()
        s.connect("KXRT", "0123456789abcdef0123456789abcdef")
        awaitState(s) { it == ConnState.RECONNECTING }
        awaitState(s) { it == ConnState.OPEN }
        assertTrue(second.received.poll(5, TimeUnit.SECONDS)!!.contains("\"hello\""))
        assertEquals(2, server.requestCount)
        s.disconnect()
    }

    @Test
    fun late4005OnAnOldSocketIsIgnored() {
        server.enqueue(upgrade(ServerSide { it.close(1000, "restart") }))
        val second = ServerSide()
        server.enqueue(upgrade(second))
        val s = socket()
        s.connect("KXRT", "0123456789abcdef0123456789abcdef")
        awaitState(s) { it == ConnState.RECONNECTING }
        awaitState(s) { it == ConnState.OPEN }
        second.received.poll(5, TimeUnit.SECONDS)
        assertEquals(2, captured.size)
        val (oldWs, oldListener) = captured[0]
        oldListener.onClosing(oldWs, 4005, "replaced")
        oldListener.onClosed(oldWs, 4005, "replaced")
        oldListener.onFailure(oldWs, RuntimeException("late"), null)
        Thread.sleep(100)
        assertEquals(ConnState.OPEN, s.state.value)
        assertEquals(2, server.requestCount)
        s.disconnect()
    }

    @Test
    fun slowReconnectCodesStillReconnect() {
        server.enqueue(upgrade(ServerSide { it.close(4008, "rate limited") }))
        server.enqueue(upgrade(ServerSide()))
        val s = socket()
        s.connect("KXRT", "0123456789abcdef0123456789abcdef")
        awaitState(s) { it == ConnState.RECONNECTING }
        awaitState(s) { it == ConnState.OPEN }
        assertEquals(2, server.requestCount)
        s.disconnect()
    }
}
