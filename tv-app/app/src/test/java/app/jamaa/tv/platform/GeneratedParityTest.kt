package app.jamaa.tv.platform

import app.jamaa.tv.AvatarShape
import app.jamaa.tv.Fixtures
import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.ChoreoSampler
import app.jamaa.tv.ui.characters.CharacterPaths
import androidx.compose.ui.graphics.toArgb
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.double
import kotlinx.serialization.json.float
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Lane D's generated Kotlin (Choreo.kt, CharacterPaths.kt, WorldColors.kt) against the shared fixtures, and the TV's
 * pure mirrors against the generated files (JAMAA-PLATFORM §3.7, §3.8 parity fixtures; TV acceptance item 6).
 */
class GeneratedParityTest {
    @Test
    fun samplerMatchesChoreoJson() {
        val root = Json.parseToJsonElement(Fixtures.v2("choreo.json")).jsonObject
        val moments = root["moments"]!!.jsonObject
        assertEquals(moments.keys, Choreo.moments.keys)
        var checked = 0
        for ((id, steps) in moments) {
            val kt = Choreo.moments.getValue(id)
            for ((i, s) in steps.jsonArray.withIndex()) {
                val o = s.jsonObject
                val step = kt[i]
                assertEquals("$id.${step.id}", o["id"]!!.jsonPrimitive.content, step.id)
                for (sample in o["samples"]!!.jsonArray) {
                    val t = sample.jsonObject["tMs"]!!.jsonPrimitive.double
                    val p = sample.jsonObject["p"]!!.jsonPrimitive.double
                    assertEquals("$id.${step.id}@$t", p, ChoreoSampler.sample(step, t), 1e-4)
                    checked++
                }
            }
        }
        assertTrue(checked > 50)
    }

    @Test
    fun characterGeometryMatchesCharactersJson() {
        val root = Json.parseToJsonElement(Fixtures.v2("characters.json")).jsonObject
        val boxes = root["faceBoxes"]!!.jsonObject
        for (shape in AvatarShape.entries) {
            val b = boxes[shape.name.lowercase()]!!.jsonObject
            val box = CharacterRules.faceBox(shape)
            assertEquals(shape.name, b["x"]!!.jsonPrimitive.float, box.x, 1e-5f)
            assertEquals(shape.name, b["w"]!!.jsonPrimitive.float, box.w, 1e-5f)
            assertEquals(root["bodies"]!!.jsonObject[shape.name.lowercase()]!!.jsonPrimitive.content, CharacterPaths.bodies[shape.name.lowercase()])
        }
        // The renderer looks expressions up by enum name: every one of the 13 has generated features.
        assertEquals(Expression.entries.map { it.name.lowercase() }.toSet(), CharacterPaths.expressions.keys)
        assertEquals(root["expressions"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content }, CharacterPaths.expressions.keys.toList())
        for ((r, e) in CharacterPaths.reactionExpression) assertEquals(e, CharacterRules.expressionOf(r)!!.name.lowercase())
        for ((r, b) in CharacterPaths.reactionBurst) assertEquals(b, "burst." + CharacterRules.burstOf(r)!!.name.lowercase())
    }

    @Test
    fun worldMirrorEqualsTheGeneratedPalettes() {
        val gen = app.jamaa.tv.ui.theme.Worlds.all
        assertEquals(gen.map { it.id }, WorldPalettes.ALL.map { it.id })
        for ((g, p) in gen.zip(WorldPalettes.ALL)) {
            fun eq(name: String, c: androidx.compose.ui.graphics.Color, v: Long) = assertEquals("${p.id}.$name", v.toInt(), c.toArgb())
            eq("deep", g.deep, p.deep); eq("stageTop", g.stageTop, p.stageTop); eq("surface", g.surface, p.surface)
            eq("elevated", g.elevated, p.elevated); eq("accent", g.accent, p.accent); eq("accentText", g.accentText, p.accentText)
            eq("onAccent", g.onAccent, p.onAccent); eq("glow", g.glow, p.glow)
            assertEquals(p.signal == null, g.signal == null)
        }
    }
}
