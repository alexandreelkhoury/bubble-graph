package app.jamaa.tv.games.likely

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** GAME-LIKELY §12.7 / DESIGN-JAMAA §6.4.3: the Kotlin layout math equals shared/src/games/likely/layout.ts. */
class LikelyLayoutTest {
    private val fx: JsonObject = Json.parseToJsonElement(LikelyFixtures.text("layout.json")).jsonObject

    private fun pt(e: kotlinx.serialization.json.JsonElement) = e.jsonObject.let { LikelyPt(it["x"]!!.jsonPrimitive.double, it["y"]!!.jsonPrimitive.double) }
    private fun pts(e: kotlinx.serialization.json.JsonElement) = (e as JsonArray).map(::pt)

    @Test fun stageConstantsMatch() {
        val s = fx["stage"]!!.jsonObject
        fun d(k: String) = s[k]!!.jsonPrimitive.double
        assertEquals(d("width"), LikelyLayout.WIDTH, 0.0)
        assertEquals(d("height"), LikelyLayout.HEIGHT, 0.0)
        assertEquals(d("arcY"), LikelyLayout.ARC_Y, 0.0)
        assertEquals(d("arcLift"), LikelyLayout.ARC_LIFT, 0.0)
        assertEquals(d("charSize"), LikelyLayout.CHAR_SIZE, 0.0)
        assertEquals(d("maxSpread"), LikelyLayout.MAX_SPREAD, 0.0)
        assertEquals(d("maxStep"), LikelyLayout.MAX_STEP, 0.0)
        assertEquals(d("congaDx"), LikelyLayout.CONGA_DX, 0.0)
        assertEquals(d("congaDy"), LikelyLayout.CONGA_DY, 0.0)
        assertEquals(s["congaStraight"]!!.jsonPrimitive.int, LikelyLayout.CONGA_STRAIGHT)
        assertEquals(d("curlRadius"), LikelyLayout.CURL_RADIUS, 0.0)
        assertEquals(d("curlShrink"), LikelyLayout.CURL_SHRINK, 0.0)
        assertEquals(d("curlStepDeg"), LikelyLayout.CURL_STEP_DEG, 0.0)
    }

    @Test fun juryArcsLtrAndRtl() {
        val arcs = fx["arcs"]!!.jsonObject
        for ((n, e) in arcs) {
            assertEquals("ltr $n", pts(e.jsonObject["ltr"]!!), LikelyLayout.juryArc(n.toInt(), rtl = false))
            assertEquals("rtl $n", pts(e.jsonObject["rtl"]!!), LikelyLayout.juryArc(n.toInt(), rtl = true))
        }
        assertEquals(12, arcs.size)
        assertEquals(emptyList<LikelyPt>(), LikelyLayout.juryArc(0))
    }

    @Test fun rtlMirrorsTheArc() {
        for (n in 1..12) {
            val ltr = LikelyLayout.juryArc(n)
            val rtl = LikelyLayout.juryArc(n, rtl = true)
            for (i in 0 until n) {
                assertEquals(LikelyLayout.WIDTH - ltr[i].x, rtl[i].x, 0.11)
                assertEquals(ltr[i].y, rtl[i].y, 0.0)
            }
        }
    }

    @Test fun congaLinesCurlAfterSix() {
        for ((name, e) in fx["conga"]!!.jsonObject) {
            val o = e.jsonObject
            val target = pt(o["target"]!!)
            val places = pts(o["places"]!!)
            // fixture-scenario.ts: left/right record the one-runner side, the edge cases the side of their 11-runner line.
            val sideCount = if (name.startsWith("edge")) places.size else 1
            assertEquals(name, o["side"]!!.jsonPrimitive.int, LikelyLayout.congaSide(target, sideCount))
            assertEquals(name, places, LikelyLayout.conga(target, places.size))
        }
    }

    @Test fun revealPositionsLtrAndRtl() {
        for (key in listOf("reveal", "revealRtl", "revealTie")) {
            val o = fx[key]!!.jsonObject
            val seatIds = o["seatIds"]!!.jsonArray.map { it.jsonPrimitive.content }
            val arc = pts(o["arc"]!!)
            val ballots = o["ballots"]!!.jsonArray.map { LikelyBallot(it.jsonObject["voterId"]!!.jsonPrimitive.content, it.jsonObject["targetId"]!!.jsonPrimitive.content) }
            val expected = o["positions"]!!.jsonObject.mapValues { pt(it.value) }
            assertEquals(key, expected, LikelyLayout.revealPositions(arc, seatIds, ballots))
        }
    }

    @Test fun roundingIsJsMathRound() {
        assertEquals(-12.0, LikelyLayout.r1(-12.05), 0.0) // Math.round(-120.5) = -120
        assertEquals(0.2, LikelyLayout.r1(0.15), 1e-12)
        assertEquals(332.9, LikelyLayout.r1(332.888), 1e-9)
    }

    /** Every place of every line size stays inside the safe area (shared layout.test.ts), LTR and RTL. */
    @Test fun congaLinesStayOnTheStage() {
        for (n in 1..12) for (rtl in listOf(false, true)) for (target in LikelyLayout.juryArc(n, rtl)) for (count in 1..11) {
            for (p in LikelyLayout.conga(target, count)) {
                org.junit.Assert.assertTrue("n=$n rtl=$rtl ${target.x} $count -> $p", p.x >= LikelyLayout.CONGA_MIN_X && p.x <= LikelyLayout.CONGA_MAX_X)
            }
        }
    }
}
