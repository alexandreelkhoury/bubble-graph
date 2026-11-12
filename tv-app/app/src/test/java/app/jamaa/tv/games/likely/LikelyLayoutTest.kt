package app.jamaa.tv.games.likely

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** GAME-LIKELY §12.7 / DESIGN-JAMAA §6.4.3: the Kotlin layout math equals shared/src/games/likely/layout.ts. */
class LikelyLayoutTest {
    private val fx: JsonObject = Json.parseToJsonElement(LikelyFixtures.text("layout.json")).jsonObject

    private fun pt(e: JsonElement) = e.jsonObject.let { LikelyPt(it["x"]!!.jsonPrimitive.double, it["y"]!!.jsonPrimitive.double) }
    private fun pts(e: JsonElement) = (e as JsonArray).map(::pt)
    private fun tokens(e: JsonElement) = e.jsonArray.map {
        val o = it.jsonObject
        val v = o["voterId"]!!
        LikelyToken(if (v is JsonNull) null else v.jsonPrimitive.content, o["targetId"]!!.jsonPrimitive.content, o["k"]!!.jsonPrimitive.int, pt(o["at"]!!))
    }

    @Test fun stageConstantsMatch() {
        val s = fx["stage"]!!.jsonObject
        fun d(k: String) = s[k]!!.jsonPrimitive.double
        assertEquals(d("width"), LikelyLayout.WIDTH, 0.0)
        assertEquals(d("height"), LikelyLayout.HEIGHT, 0.0)
        assertEquals(d("cardTop"), LikelyLayout.CARD_TOP, 0.0)
        assertEquals(d("cardWidth"), LikelyLayout.CARD_WIDTH, 0.0)
        assertEquals(d("cardHeight"), LikelyLayout.CARD_HEIGHT, 0.0)
        assertEquals(d("cardRevealScale"), LikelyLayout.CARD_REVEAL_SCALE, 0.0)
        assertEquals(d("rowY"), LikelyLayout.ROW_Y, 0.0)
        assertEquals(d("rowLift"), LikelyLayout.ROW_LIFT, 0.0)
        assertEquals(d("charSize"), LikelyLayout.CHAR_SIZE, 0.0)
        assertEquals(d("revealChar"), LikelyLayout.REVEAL_CHAR, 0.0)
        assertEquals(d("maxSpread"), LikelyLayout.MAX_SPREAD, 0.0)
        assertEquals(d("maxStep"), LikelyLayout.MAX_STEP, 0.0)
        assertEquals(d("bannerY"), LikelyLayout.BANNER_Y, 0.0)
        assertEquals(d("revealRowY"), LikelyLayout.REVEAL_ROW_Y, 0.0)
        assertEquals(d("stackTop"), LikelyLayout.STACK_TOP, 0.0)
        assertEquals(d("stackBottom"), LikelyLayout.STACK_BOTTOM, 0.0)
        assertEquals(d("cellMax"), LikelyLayout.CELL_MAX, 0.0)
        assertEquals(d("cellMin"), LikelyLayout.CELL_MIN, 0.0)
        assertEquals(s["stackColsMax"]!!.jsonPrimitive.int, LikelyLayout.STACK_COLS_MAX)
    }

    @Test fun rowsLtrRtlAndReveal() {
        val rows = fx["rows"]!!.jsonObject
        for ((n, e) in rows) {
            val o = e.jsonObject
            assertEquals("ltr $n", pts(o["ltr"]!!), LikelyLayout.row(n.toInt()))
            assertEquals("rtl $n", pts(o["rtl"]!!), LikelyLayout.row(n.toInt(), rtl = true))
            assertEquals("reveal $n", pts(o["reveal"]!!), LikelyLayout.row(n.toInt(), reveal = true))
            assertEquals("revealRtl $n", pts(o["revealRtl"]!!), LikelyLayout.row(n.toInt(), rtl = true, reveal = true))
        }
        assertEquals(12, rows.size)
        assertEquals(emptyList<LikelyPt>(), LikelyLayout.row(0))
    }

    @Test fun stackGrids() {
        for ((key, e) in fx["grids"]!!.jsonObject) {
            val (n, m) = key.split("x").map { it.toInt() }
            val o = e.jsonObject
            assertEquals(key, LikelyStackGrid(o["cols"]!!.jsonPrimitive.int, o["cell"]!!.jsonPrimitive.double), LikelyLayout.stackGrid(n, m))
        }
    }

    @Test fun publicAndSecretTokens() {
        for ((key, rtl) in listOf("publicTokens" to false, "publicTokensRtl" to true, "publicTokens12" to false)) {
            val o = fx[key]!!.jsonObject
            val ids = o["ids"]!!.jsonArray.map { it.jsonPrimitive.content }
            val ballots = o["ballots"]!!.jsonArray.map { LikelyBallot(it.jsonObject["voterId"]!!.jsonPrimitive.content, it.jsonObject["targetId"]!!.jsonPrimitive.content) }
            assertEquals(key, tokens(o["tokens"]!!), LikelyLayout.publicTokens(LikelyLayout.row(ids.size, rtl, reveal = true), ids, ballots, rtl))
        }
        val o = fx["secretTokens"]!!.jsonObject
        val ids = o["ids"]!!.jsonArray.map { it.jsonPrimitive.content }
        val counts = o["counts"]!!.jsonArray.map { LikelyCount(it.jsonObject["playerId"]!!.jsonPrimitive.content, it.jsonObject["count"]!!.jsonPrimitive.int, 0) }
        assertEquals(tokens(o["tokens"]!!), LikelyLayout.secretTokens(LikelyLayout.row(ids.size, reveal = true), ids, counts))
    }

    @Test fun roundingIsJsMathRound() {
        assertEquals(-12.0, LikelyLayout.r1(-12.05), 0.0) // Math.round(-120.5) = -120
        assertEquals(0.2, LikelyLayout.r1(0.15), 1e-12)
        assertEquals(332.9, LikelyLayout.r1(332.888), 1e-9)
    }

    /** Every token of every stack size stays on the stage and inside its target's column (shared layout.test.ts). */
    @Test fun stacksStayOnTheStageAndInTheirColumn() {
        for (n in 3..12) for (m in 1..n) for (rtl in listOf(false, true)) {
            val g = LikelyLayout.stackGrid(n, m)
            val step = LikelyLayout.rowStep(n)
            for (target in LikelyLayout.row(n, rtl, reveal = true)) for (k in 0 until m) {
                val p = LikelyLayout.stackSlot(target, k, m, g, rtl)
                assertTrue("n=$n m=$m", p.y + g.cell / 2 <= LikelyLayout.STACK_BOTTOM + 0.05 && p.y - g.cell / 2 >= LikelyLayout.STACK_TOP - 0.05)
                assertTrue("n=$n m=$m", p.x - g.cell / 2 >= -0.05 && p.x + g.cell / 2 <= LikelyLayout.WIDTH + 0.05)
                assertTrue("n=$n m=$m k=$k", kotlin.math.abs(p.x - target.x) + g.cell / 2 <= step / 2 + 0.05)
            }
        }
    }
}
