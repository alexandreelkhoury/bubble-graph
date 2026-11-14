package app.jamaa.tv

import app.jamaa.tv.settings.MemoryRoomMemoryStore
import app.jamaa.tv.settings.RoomMemory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** JAMAA-PLATFORM §2.6a: mirrors shared/test/room/memory.test.ts (sanitize, merge, storage round trip). */
class RoomMemoryTest {
    @Test
    fun keys() {
        for (k in listOf("en-food-01:p001", "lb-quiz-01:q0123", "teta-words-07", "x")) assertTrue(k, RoomMemory.isKey(k))
        for (k in listOf("", "A:b", "a b", "a:b:c", ":a", "a:", "-a", "a".repeat(41), "a/b")) assertFalse(k, RoomMemory.isKey(k))
    }

    @Test
    fun sanitizeKeepsKnownGamesInOrderAndTheLatestUniqueKeys() {
        val raw = mapOf(
            "trivia" to listOf("lb-quiz-01:q0001"),
            "karaoke" to listOf("a"),
            "likely" to emptyList(),
            "mishana" to listOf("a:p001", "a:p002", "a:p001", "NO"),
        )
        val w = RoomMemory.sanitize(raw)
        assertEquals(listOf("mishana", "trivia"), w.keys.toList())
        assertEquals(listOf("a:p002", "a:p001"), w["mishana"])
        val many = (0 until Constants.MEMORY_MAX_KEYS + 50).map { "k$it" }
        assertEquals(many.takeLast(Constants.MEMORY_MAX_KEYS), RoomMemory.sanitize(mapOf("bluff" to many))["bluff"])
    }

    @Test
    fun mergeReplacesTheFramesGamesAndKeepsTheOthers() {
        val store = MemoryRoomMemoryStore(mapOf("mishana" to listOf("a:p001"), "bluff" to listOf("b1")))
        store.save(mapOf("mishana" to listOf("a:p001", "a:p002"), "trivia" to listOf("t:q0001")))
        assertEquals(mapOf("mishana" to listOf("a:p001", "a:p002"), "bluff" to listOf("b1"), "trivia" to listOf("t:q0001")), store.load())
    }

    @Test
    fun storedJsonRoundTripsAndJunkReadsEmpty() {
        val m = mapOf("mishana" to listOf("a:p001"), "likely" to listOf("c1", "c2"))
        assertEquals(m, RoomMemory.decode(RoomMemory.encode(m)))
        assertEquals(emptyMap<String, List<String>>(), RoomMemory.decode(null))
        assertEquals(emptyMap<String, List<String>>(), RoomMemory.decode("{nope"))
        assertEquals(emptyMap<String, List<String>>(), RoomMemory.decode("[1,2]"))
        assertEquals(mapOf("bluff" to listOf("ok")), RoomMemory.decode("""{"chess":["a"],"bluff":["ok",3,"NOT OK"],"likely":"x"}"""))
    }
}
