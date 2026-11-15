package app.jamaa.tv.games.taqriban

import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.protocol.ProtocolJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** GAME-TAQRIBAN on the TV: the wire mirror decodes a real REVEAL view, and the number line matches the web model. */
class TaqribanTest {
    // A REVEAL `game.public` as the shared projection writes it (key order of TaqribanPublicSchema).
    private val reveal = """
        {"schema":1,"phase":"REVEAL","index":2,"total":10,"isFinal":false,"deadline":1790000012000,"durationMs":9750,
         "question":{"id":"tw-026","text":"How many trees are there on Earth (2015 global estimate)?","unit":"trees"},
         "answeredIds":[],
         "reveal":{"answer":3040000000000,"source":"Crowther et al., Nature 2015","mode":"ratio","logLine":true,
           "guesses":[{"id":"p1","value":3,"rank":3,"closest":false,"bullseye":false,"points":0},
                      {"id":"p0","value":1000000000000,"rank":1,"closest":true,"bullseye":false,"points":1000},
                      {"id":"p2","value":8000000000000,"rank":2,"closest":false,"bullseye":false,"points":0}],
           "missingIds":["p3"],"closestIds":["p0"],"bullseyeIds":[],"wildId":"p1"},
         "scores":[{"playerId":"p0","score":2500,"scoreBefore":1500,"rank":1,"rankBefore":1,"closest":2,"bullseyes":1,"left":false},
                   {"playerId":"p1","score":0,"scoreBefore":0,"rank":3,"rankBefore":2,"closest":0,"bullseyes":0,"left":false},
                   {"playerId":"p2","score":1000,"scoreBefore":1000,"rank":2,"rankBefore":2,"closest":1,"bullseyes":0,"left":false},
                   {"playerId":"p3","score":0,"scoreBefore":0,"rank":3,"rankBefore":2,"closest":0,"bullseyes":0,"left":false}],
         "newIds":[],"waitingIds":[],"rerun":false,"endedEarly":false}
    """.trimIndent()

    @Test fun decodesTheRevealStrictly() {
        val pub = ProtocolJson.strict.decodeFromString(TaqPub.serializer(), reveal)
        assertEquals(TaqPhase.REVEAL, pub.phase)
        assertEquals(3.04e12, pub.reveal!!.answer, 0.0)
        assertEquals(listOf("p0"), pub.reveal!!.closestIds)
        assertEquals("p1", pub.reveal!!.wildId)
    }

    @Test fun registeredAndImplemented() {
        assertTrue(GameDecoders.isSupported(GameIds.TAQRIBAN))
        assertEquals("observatory", GameCatalog.TAQRIBAN.world)
        assertEquals(2, GameCatalog.TAQRIBAN.minPlayers)
        assertEquals(listOf("QUESTION", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"), GameCatalog.TAQRIBAN.phases)
    }

    @Test fun numberWordsAndDigits() {
        assertEquals("8" to "billion", TaqribanLine.compactParts(8e9))
        assertEquals("3.04" to "trillion", TaqribanLine.compactParts(3.04e12))
        assertEquals("384" to "thousand", TaqribanLine.compactParts(384_400.0))
        assertEquals("8849" to null, TaqribanLine.compactParts(8849.0))
        assertEquals("8 000 000 000", TaqribanLine.groupDigits(8e9))
        assertEquals("42.2", TaqribanLine.groupDigits(42.195))
        assertEquals("1 507.5", TaqribanLine.groupDigits(1507.5))
    }

    @Test fun logLineOrdersDotsAndPinsZeroAtTheStart() {
        val l = TaqribanLine.layout(3.04e12, listOf("a" to 3.0, "b" to 1e12, "c" to 0.0), log = true)
        val x = l.dots.associate { it.id to it.x }
        assertEquals(0f, x["c"]!!, 0f)
        assertTrue(x["a"]!! < x["b"]!!)
        assertTrue(l.answerX > x["b"]!! && l.answerX <= 1f)
        assertTrue(l.ticks.size in 3..8)
    }

    @Test fun closeDotsStackIntoLanes() {
        val l = TaqribanLine.layout(330.0, listOf("a" to 320.0, "b" to 321.0, "c" to 322.0, "d" to 500.0), log = false)
        assertEquals(3, l.dots.filter { it.value < 400 }.map { it.lane }.toSet().size)
        assertNull(l.dots.firstOrNull { it.x < 0f || it.x > 1f })
    }

    @Test fun revealTimelineIsOrdered() {
        val n = 6
        assertTrue(TaqribanLine.Timeline.dotAt(n - 1) < TaqribanLine.Timeline.answerAt(n))
        assertTrue(TaqribanLine.Timeline.answerAt(n) < TaqribanLine.Timeline.stampAt(n))
        // The whole show fits the shortest server REVEAL window (9 s + 250 ms per guess, capped at 13 s).
        for (k in 1..12) assertTrue(TaqribanLine.Timeline.doneAt(k) <= minOf(13_000L, 9_000L + 250L * k))
    }
}
