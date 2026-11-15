package app.jamaa.tv.monitor

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** JAMAA-PLATFORM §8.3: the crash saver (save now, send on the next launch), the report shape and the throttle. */
class CrashReporterTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun boom(msg: String = "x is null"): Throwable = try {
        throw IllegalStateException(msg, RuntimeException("inner"))
    } catch (e: IllegalStateException) {
        e
    }

    @Test
    fun crashIsSavedThenSentOnceOnTheNextLaunch() {
        val store = CrashStore(tmp.newFolder("monitor"))
        val sent = mutableListOf<Pair<String, String>>()
        val first = CrashReporter(store, { "https://play.example/" }, "1.0.0", { "PLAYING:mishana" to "KXRT" }, { u, j -> sent += u to j })
        first.onUncaught(boom())
        assertTrue(sent.isEmpty()) // nothing is sent from the dying process
        val saved = store.peek()!!
        assertEquals("crash", saved.kind)
        assertEquals("IllegalStateException", saved.name)
        assertEquals("KXRT", saved.room)

        // Next launch: a new reporter on the same store sends it once and forgets it.
        val next = CrashReporter(store, { "https://play.example/" }, "1.0.1", send = { u, j -> sent += u to j })
        next.sendPending()
        next.sendPending()
        assertEquals(1, sent.size)
        assertEquals("https://play.example/api/client-errors", sent[0].first)
        val o = Json.parseToJsonElement(sent[0].second).jsonObject
        assertEquals("tv-android", o["p"]!!.jsonPrimitive.content)
        assertEquals("1.0.1", o["v"]!!.jsonPrimitive.content)
        assertEquals("crash", o["k"]!!.jsonPrimitive.content)
        assertEquals("x is null", o["m"]!!.jsonPrimitive.content)
        assertEquals("PLAYING:mishana", o["s"]!!.jsonPrimitive.content)
        assertTrue(o["st"]!!.jsonPrimitive.content.contains("Caused by: java.lang.RuntimeException"))
        assertNull(store.peek())
    }

    @Test
    fun theSameCrashTwiceBumpsTheCountAnotherReplacesIt() {
        val store = CrashStore(tmp.newFolder("m"))
        store.save(ErrorReport.of("crash", boom()))
        store.save(ErrorReport.of("crash", boom()))
        assertEquals(2, store.peek()!!.count)
        assertEquals(2, countOf(store.peek()!!.toJson("1")))
        store.save(ErrorReport.of("crash", boom("other")))
        assertEquals(1, store.peek()!!.count)
        assertEquals("other", store.take()!!.message)
        assertNull(store.take())
    }

    @Test
    fun aBrokenOrMissingFileIsIgnoredAndSendFailuresAreSilent() {
        val dir = tmp.newFolder("b")
        java.io.File(dir, CrashStore.FILE).writeText("{not json")
        val store = CrashStore(dir)
        assertNull(store.take())
        store.save(ErrorReport.of("crash", boom()))
        CrashReporter(store, { "https://x" }, "1", send = { _, _ -> throw java.io.IOException("offline") }).sendPending()
        assertNull(store.peek()) // dropped, not retried forever
        // A throwing context never breaks the crash path.
        CrashReporter(store, { "https://x" }, "1", { throw IllegalStateException("ctx") }).onUncaught(boom())
        assertEquals("IllegalStateException", store.peek()!!.name)
    }

    @Test
    fun truncatesAndDropsAnInvalidRoomCode() {
        val r = ErrorReport.of("caught", IllegalStateException("m".repeat(1000)), room = "kx rt")
        val o = Json.parseToJsonElement(r.toJson("1.0.0")).jsonObject
        assertEquals(ErrorReport.MESSAGE_MAX, o["m"]!!.jsonPrimitive.content.length)
        assertFalse(o.containsKey("r"))
        assertTrue(o["st"]!!.jsonPrimitive.content.length <= ErrorReport.STACK_MAX)
    }

    @Test
    fun throttleAllowsEachErrorOnceAndAtMostFive() {
        val t = ReportThrottle(5)
        val a = ErrorReport.of("caught", boom("a"))
        assertTrue(t.allow(a))
        assertFalse(t.allow(a))
        var n = 1
        for (i in 0 until 10) if (t.allow(ErrorReport.of("caught", boom("e$i")))) n++
        assertEquals(5, n)
    }
}
