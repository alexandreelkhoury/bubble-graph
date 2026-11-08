package app.jamaa.tv.platform

import app.jamaa.tv.AvatarShape
import app.jamaa.tv.Constants
import app.jamaa.tv.TvFixtures
import app.jamaa.tv.protocol.MemberReaction
import app.jamaa.tv.protocol.Reactions
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MomentsCharactersWorldsTest {
    @Test
    fun momentTimelines() {
        assertEquals(1_100L, Moments.portal(firstOpenThisSession = true, reduced = false).totalMs)
        assertEquals(704L, Moments.portal(false, false).totalMs) // × 0.64 ≈ 700 ms
        assertEquals(150L, Moments.portal(true, reduced = true).totalMs)
        assertEquals(600L, Moments.portalBack(false).totalMs)
        val e = Moments.entrance(false, characters = 12)
        assertEquals(2_000L, e.totalMs) // 12 characters at 40 ms still land before the title settles
        assertTrue(e.totalMs + 500 <= Constants.ENTRANCE_GRACE_MS)
        assertEquals(750L, Moments.entrance(true).totalMs) // calm: crossfade + the title for 600 ms
        assertEquals(maxOf(450L + 2 * 70, 450L + 160), Moments.cup(3, false).totalMs) // the cup pop ends last
        assertEquals(450L + 23 * 70, Moments.cup(99, false).totalMs) // at most 24 flying stars
        // The repeat portal samples the same curve on a 0.64 clock.
        val first = Moments.portal(true, false).step("arch")!!
        val repeat = Moments.portal(false, false).step("arch")!!
        assertEquals(first.progress(400), repeat.progress(256), 1e-4f)
        assertEquals(0f, first.progress(100))
        assertEquals(1f, first.progress(700))
    }

    @Test
    fun everyReactionIsAnExpressionWithABurst() {
        assertEquals(6, Reactions.ALL.size)
        for (r in Reactions.ALL) {
            assertTrue(r, CharacterRules.expressionOf(r) != null)
            assertTrue(r, CharacterRules.burstOf(r) != null)
        }
        assertEquals(13, Expression.entries.size)
        for (s in AvatarShape.entries) {
            val b = CharacterRules.faceBox(s)
            assertTrue(s.name, b.x >= 0 && b.y >= 0 && b.x + b.w <= 24 && b.y + b.h <= 24)
            assertEquals(s.name, b.w / 12f, b.scale, 1e-6f) // features scale uniformly by w / 12
        }
        assertEquals(1.5f, CharacterRules.featureBoost(48f, AvatarShape.Circle))
        assertEquals(1.8f, CharacterRules.featureBoost(48f, AvatarShape.Bolt), 1e-5f)
        assertEquals(1f, CharacterRules.featureBoost(72f, AvatarShape.Bolt))
    }

    @Test
    fun expressionsComeFromPublicDataOnly() {
        val v = TvFixtures.room("playing.mishana.voting")
        val m = v.room.members[0]
        val env = v.game!!
        assertEquals(Expression.THINK, CharacterRules.expression(m, env, null)) // awaited
        assertEquals(Expression.DONE, CharacterRules.expression(m, env.copy(doneIds = listOf(m.id), awaitedIds = emptyList()), null))
        assertEquals(Expression.LAUGH, CharacterRules.expression(m, env, "laugh"))
        assertEquals(Expression.AWAY, CharacterRules.expression(m.copy(connected = false), env, "laugh"))
        assertEquals(Expression.IDLE, CharacterRules.expression(m, null, null))
        // Secrecy (§3.7): changing anything in the game's public payload (roles, words, votes) changes no expression.
        val tampered = env.copy(public = JsonObject(env.public + ("roleCounts" to JsonPrimitive("secret"))), me = JsonObject(mapOf("role" to JsonPrimitive("UNDERCOVER"))))
        for (mm in v.room.members) assertEquals(CharacterRules.expression(mm, env, null), CharacterRules.expression(mm, tampered, null))
    }

    @Test
    fun reactionsReplayByCounterForOnePointFiveSeconds() {
        val members = TvFixtures.room("hub").room.members
        val t = ReactionTracker()
        val with = members.mapIndexed { i, m -> if (i == 0) m.copy(reaction = MemberReaction("laugh", 3)) else m }
        assertTrue(t.update(with, 0).isEmpty()) // the first snapshot never replays old reactions
        val again = with.mapIndexed { i, m -> if (i == 0) m.copy(reaction = MemberReaction("laugh", 4)) else m }
        assertEquals(listOf(members[0].id), t.update(again, 1_000))
        assertEquals("laugh", t.activeFor(members[0].id, 2_499))
        assertNull(t.activeFor(members[0].id, 2_500))
        assertTrue(t.update(again, 3_000).isEmpty()) // same n: nothing new
    }

    @Test
    fun worldPalettesPassTheContrastRules() {
        for (w in WorldPalettes.ALL) {
            assertTrue(w.id, WorldPalettes.contrast(WorldPalettes.TEXT, w.deep) >= 4.5)
            assertTrue(w.id, WorldPalettes.contrast(WorldPalettes.TEXT, w.surface) >= 4.5)
            assertTrue(w.id, WorldPalettes.contrast(WorldPalettes.TEXT, w.elevated) >= 4.5)
            assertTrue(w.id, WorldPalettes.contrast(w.accentText, w.surface) >= 4.5)
            assertTrue(w.id, WorldPalettes.contrast(w.accent, w.deep) >= 3.0)
            assertTrue(w.id, WorldPalettes.contrast(w.onAccent, w.accent) >= 4.5)
        }
        assertEquals(WorldPalettes.NIGHT_MARKET, WorldPalettes.of("nope"))
        assertEquals(0xFF7F7F7FL, WorldPalettes.mix(0xFF000000, 0xFFFFFFFF, 0.5f))
        assertEquals(WorldPalettes.HAKAWATI_CAFE.deep, WorldPalettes.mix(WorldPalettes.NIGHT_MARKET.deep, WorldPalettes.HAKAWATI_CAFE.deep, 1f))
    }
}
